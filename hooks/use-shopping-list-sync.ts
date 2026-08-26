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

type PendingPatch = Partial<ShoppingItemWithPeople> & { _deleted?: boolean }

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

function mergePending(
  items: ShoppingItemWithPeople[],
  pending: Map<string, PendingPatch>
): ShoppingItemWithPeople[] {
  if (pending.size === 0) return items
  const result: ShoppingItemWithPeople[] = []
  for (const item of items) {
    const patch = pending.get(item.id)
    if (patch?._deleted) continue
    result.push(patch ? { ...item, ...patch } : item)
  }
  return result
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
  const pendingRef = useRef<Map<string, PendingPatch>>(new Map())

  const applyPending = useCallback((rows: ShoppingItemWithPeople[]) => {
    return mergePending(rows, pendingRef.current)
  }, [])

  const setPendingPatch = useCallback((id: string, patch: PendingPatch) => {
    pendingRef.current.set(id, {
      ...pendingRef.current.get(id),
      ...patch,
    })
  }, [])

  const clearPending = useCallback((id: string) => {
    pendingRef.current.delete(id)
  }, [])

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

    const nameMap = new Map<string, string>(
      ((profiles ?? []) as Array<{ id: string; full_name: string }>).map((p) => [
        p.id,
        p.full_name,
      ])
    )
    nameCache.current = nameMap

    if (seq !== refreshSeq.current) return

    setItems(
      applyPending(
        mapItemsWithNames((rows ?? []) as Record<string, unknown>[], nameMap)
      )
    )
  }, [listId, householdId, applyPending])

  const applyItemChange = useCallback(
    (payload: RealtimePostgresChangesPayload<ShoppingItem>) => {
      const event = payload.eventType

      if (event === "DELETE") {
        const oldRow = payload.old as Partial<ShoppingItem>
        if (!oldRow.id) {
          void refreshItems()
          return
        }
        const pending = pendingRef.current.get(oldRow.id)
        if (pending && !pending._deleted) {
          // Local add/update still in flight — ignore stale delete
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

      if (row.list_id && row.list_id !== listId) return

      const pending = pendingRef.current.get(row.id)
      if (pending?._deleted) return

      const next = withNames(row, nameCache.current)
      const merged = pending ? { ...next, ...pending } : next

      setItems((prev) => {
        const index = prev.findIndex((item) => item.id === merged.id)
        if (index === -1) return sortByOrder([...prev, merged])
        const copy = [...prev]
        copy[index] = {
          ...copy[index],
          ...merged,
          creator_name: merged.creator_name ?? copy[index].creator_name,
          completer_name: merged.completer_name ?? copy[index].completer_name,
        }
        return sortByOrder(copy)
      })

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
        await supabase.auth.getSession()
        await teardownChannel()

        if (cancelled) return

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
            (payload: RealtimePostgresChangesPayload<ShoppingItem>) => {
              applyItemChange(payload)
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
            (payload: { new: { actor_id?: string | null; list_id?: string | null; message?: string } }) => {
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
          .subscribe((status: string, err?: Error) => {
            if (cancelled) return

            if (status === "SUBSCRIBED") {
              liveRef.current = true
              setLive(true)
              retryAttempt = 0
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

  return {
    items,
    setItems,
    live,
    refreshItems,
    setPendingPatch,
    clearPending,
  }
}
