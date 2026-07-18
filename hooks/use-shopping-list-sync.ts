"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  bindRealtimeLifecycle,
  realtimeBackoffMs,
} from "@/lib/realtime-lifecycle"
import type { ShoppingItem, ShoppingItemWithPeople } from "@/types/database"

function mapItemsWithNames(
  rows: Record<string, unknown>[],
  nameMap: Map<string, string>
): ShoppingItemWithPeople[] {
  return rows.map((item) => ({
    ...(item as unknown as ShoppingItemWithPeople),
    creator_name: item.created_by
      ? nameMap.get(item.created_by as string) ?? null
      : null,
    completer_name: item.completed_by
      ? nameMap.get(item.completed_by as string) ?? null
      : null,
  }))
}

function withNames(
  item: ShoppingItem,
  nameMap: Map<string, string>
): ShoppingItemWithPeople {
  return {
    ...item,
    creator_name: item.created_by
      ? nameMap.get(item.created_by) ?? null
      : null,
    completer_name: item.completed_by
      ? nameMap.get(item.completed_by) ?? null
      : null,
  }
}

function sortByOrder(items: ShoppingItemWithPeople[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

function isTerminalStatus(status: string) {
  return (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  )
}

export function useShoppingListSync({
  listId,
  householdId,
  currentUserId,
  initialItems,
}: {
  listId: string
  householdId: string
  currentUserId: string
  initialItems: ShoppingItemWithPeople[]
}) {
  const [items, setItems] = useState(initialItems)
  const [live, setLive] = useState(false)
  const refreshSeq = useRef(0)
  const nameCache = useRef<Map<string, string>>(new Map())
  const liveRef = useRef(false)
  const reconnectRef = useRef<(() => void) | null>(null)

  const refreshItems = useCallback(async () => {
    const seq = ++refreshSeq.current
    const supabase = createClient()

    const [{ data: rows, error }, { data: profiles }] = await Promise.all([
      supabase
        .from("shopping_items")
        .select("*")
        .eq("list_id", listId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("household_id", householdId),
    ])

    if (error) {
      console.error("[HomeOS] refreshItems", error.message)
      return
    }

    const nameMap = new Map(
      (profiles ?? []).map((p) => [p.id as string, p.full_name as string])
    )
    nameCache.current = nameMap

    if (seq !== refreshSeq.current) return

    setItems(mapItemsWithNames((rows ?? []) as Record<string, unknown>[], nameMap))
  }, [listId, householdId])

  const applyItemChange = useCallback(
    (payload: RealtimePostgresChangesPayload<ShoppingItem>) => {
      const event = payload.eventType

      if (event === "DELETE") {
        const oldRow = payload.old as Partial<ShoppingItem>
        if (!oldRow.id) {
          void refreshItems()
          return
        }
        setItems((prev) => prev.filter((item) => item.id !== oldRow.id))
        return
      }

      const row = payload.new as ShoppingItem | null
      if (!row?.id) {
        void refreshItems()
        return
      }

      // Ignore events for other lists (defensive; filter should already scope)
      if (row.list_id && row.list_id !== listId) return

      const next = withNames(row, nameCache.current)

      setItems((prev) => {
        const index = prev.findIndex((item) => item.id === next.id)
        if (index === -1) return sortByOrder([...prev, next])
        const copy = [...prev]
        copy[index] = {
          ...copy[index],
          ...next,
          // Keep known names if payload users aren't in cache yet
          creator_name: next.creator_name ?? copy[index].creator_name,
          completer_name: next.completer_name ?? copy[index].completer_name,
        }
        return sortByOrder(copy)
      })

      // Fill missing profile names without blocking UI
      const candidateIds = [row.created_by, row.completed_by, row.updated_by]
      const missingIds = candidateIds.filter(
        (id): id is string => typeof id === "string" && !nameCache.current.has(id)
      )
      if (missingIds.length > 0) {
        void refreshItems()
      }
    },
    [listId, refreshItems]
  )

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: RealtimeChannel | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retryAttempt = 0
    let connecting = false

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    const teardownChannel = async () => {
      if (!channel) return
      const current = channel
      channel = null
      try {
        await supabase.removeChannel(current)
      } catch {
        /* ignore */
      }
    }

    const connect = async () => {
      if (cancelled || connecting) return
      connecting = true
      clearRetry()

      try {
        // Ensure JWT is fresh before (re)joining Realtime — critical on Safari
        await supabase.auth.getSession()
        await teardownChannel()

        if (cancelled) return

        // Unique topic per connect avoids stuck Phoenix channel reuse after errors
        const topic = `shopping-list:${listId}:${Date.now()}`

        channel = supabase
          .channel(topic)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "shopping_items",
              filter: `list_id=eq.${listId}`,
            },
            (payload) => {
              applyItemChange(
                payload as RealtimePostgresChangesPayload<ShoppingItem>
              )
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "activity_log",
              filter: `household_id=eq.${householdId}`,
            },
            (payload) => {
              const row = payload.new as {
                actor_id?: string | null
                list_id?: string | null
                message?: string
              }
              if (
                row.actor_id &&
                row.actor_id !== currentUserId &&
                row.message &&
                (!row.list_id || row.list_id === listId)
              ) {
                toast.message(row.message)
              }
            }
          )
          .subscribe((status, err) => {
            if (cancelled) return

            if (status === "SUBSCRIBED") {
              liveRef.current = true
              setLive(true)
              retryAttempt = 0
              // Catch-up after (re)subscribe — covers missed events while down
              void refreshItems()
              return
            }

            liveRef.current = false
            setLive(false)

            if (isTerminalStatus(status)) {
              console.warn("[HomeOS] realtime", status, err?.message ?? err)
              scheduleReconnect()
            }
          })
      } finally {
        connecting = false
      }
    }

    const scheduleReconnect = () => {
      if (cancelled || retryTimer) return
      const delay = realtimeBackoffMs(retryAttempt)
      retryAttempt += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        void connect()
      }, delay)
    }

    reconnectRef.current = () => {
      retryAttempt = 0
      void connect()
    }

    void connect()

    const unbindLifecycle = bindRealtimeLifecycle({
      onResume: () => {
        // Always reconcile after wake/focus/online — root fix for Safari→Chrome gaps
        void refreshItems()
        if (!liveRef.current) {
          reconnectRef.current?.()
        }
      },
    })

    return () => {
      cancelled = true
      reconnectRef.current = null
      clearRetry()
      unbindLifecycle()
      liveRef.current = false
      setLive(false)
      void teardownChannel()
    }
  }, [listId, householdId, currentUserId, refreshItems, applyItemChange])

  return { items, setItems, live, refreshItems }
}
