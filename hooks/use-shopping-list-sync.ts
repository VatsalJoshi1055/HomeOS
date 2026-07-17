"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { ShoppingItemWithPeople } from "@/types/database"

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

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel(`shopping-list:${listId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `list_id=eq.${listId}`,
        },
        () => {
          void refreshItems()
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
        setLive(status === "SUBSCRIBED")
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[HomeOS] realtime", status, err)
          if (retryTimer) clearTimeout(retryTimer)
          retryTimer = setTimeout(() => {
            void refreshItems()
          }, 1500)
        }
      })

    // Catch-up refresh in case events were missed while connecting
    void refreshItems()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      void supabase.removeChannel(channel)
    }
  }, [listId, householdId, currentUserId, refreshItems])

  return { items, setItems, live, refreshItems }
}
