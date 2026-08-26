"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import {
  bindRealtimeLifecycle,
  realtimeBackoffMs,
} from "@/lib/realtime-lifecycle"
import type { ActivityLogWithActor } from "@/types/database"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RelativeTime } from "@/components/relative-time"

function initials(name: string | null | undefined) {
  return (name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function isTerminalStatus(status: string) {
  return (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  )
}

export function LiveActivityFeed({
  householdId,
  currentUserId,
  initialActivity,
}: {
  householdId: string
  currentUserId: string
  initialActivity: ActivityLogWithActor[]
}) {
  const [activity, setActivity] = useState(initialActivity)
  const [live, setLive] = useState(false)
  const liveRef = useRef(false)
  const reconnectRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const [{ data: logs }, { data: profiles }, { data: lists }] =
      await Promise.all([
        supabase
          .from("activity_log")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("household_id", householdId),
        supabase
          .from("shopping_lists")
          .select("id, name")
          .eq("household_id", householdId),
      ])

    const names = new Map<string, string>(
      ((profiles ?? []) as Array<{ id: string; full_name: string }>).map((p) => [
        p.id,
        p.full_name,
      ])
    )
    const listNames = new Map<string, string>(
      ((lists ?? []) as Array<{ id: string; name: string }>).map((l) => [
        l.id,
        l.name,
      ])
    )

    setActivity(
      ((logs ?? []) as ActivityLogWithActor[]).map((row) => ({
        ...(row as ActivityLogWithActor),
        actor_name: row.actor_id
          ? names.get(row.actor_id as string) ?? null
          : null,
        list_name: row.list_id
          ? listNames.get(row.list_id as string) ?? null
          : null,
      }))
    )
  }, [householdId])

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

        const topic = `activity:${householdId}:${Date.now()}`

        channel = supabase
          .channel(topic)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "activity_log",
              filter: `household_id=eq.${householdId}`,
            },
            (payload: { new: { actor_id?: string | null; message?: string } }) => {
              const row = payload.new
              if (
                row.actor_id &&
                row.actor_id !== currentUserId &&
                row.message
              ) {
                toast.message(row.message)
              }
              void refresh()
            }
          )
          .subscribe((status: string, err?: Error) => {
            if (cancelled) return

            if (status === "SUBSCRIBED") {
              liveRef.current = true
              setLive(true)
              retryAttempt = 0
              void refresh()
              return
            }

            liveRef.current = false
            setLive(false)

            if (isTerminalStatus(status)) {
              console.warn("[HomeOS] activity realtime", status, err?.message ?? err)
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
        void refresh()
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
  }, [householdId, currentUserId, refresh])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Family timeline</CardTitle>
            <CardDescription>
              Live updates — see who added, changed, or bought each item.
            </CardDescription>
          </div>
          <span
            className={
              live
                ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                : "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
            }
          >
            <span
              className={
                live
                  ? "size-1.5 animate-pulse rounded-full bg-emerald-500"
                  : "size-1.5 rounded-full bg-amber-500"
              }
            />
            {live ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No activity yet. Start shopping together!
          </p>
        ) : (
          <ol className="relative ml-2.5 space-y-0 border-l border-amber-200 sm:ml-3">
            {activity.map((a) => (
              <li key={a.id} className="relative pb-4 pl-6 last:pb-0 sm:pb-8 sm:pl-8">
                <span className="absolute top-0 -left-2.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white ring-2 ring-white sm:-left-3 sm:size-6 sm:text-[10px] sm:ring-4">
                  {initials(a.actor_name).slice(0, 1)}
                </span>
                <div className="flex items-start gap-2 sm:gap-3">
                  <Avatar className="hidden size-9 sm:flex">
                    <AvatarFallback>{initials(a.actor_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 sm:text-sm">
                      {a.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400 sm:text-xs">
                      <RelativeTime value={a.created_at} />
                      {a.list_name ? ` · ${a.list_name}` : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
