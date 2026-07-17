"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
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

  useEffect(() => {
    const supabase = createClient()

    async function refresh() {
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

      const names = new Map(
        (profiles ?? []).map((p) => [p.id as string, p.full_name as string])
      )
      const listNames = new Map(
        (lists ?? []).map((l) => [l.id as string, l.name as string])
      )

      setActivity(
        (logs ?? []).map((row) => ({
          ...(row as ActivityLogWithActor),
          actor_name: row.actor_id
            ? names.get(row.actor_id as string) ?? null
            : null,
          list_name: row.list_id
            ? listNames.get(row.list_id as string) ?? null
            : null,
        }))
      )
    }

    const channel = supabase
      .channel(`activity-${householdId}`)
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
            message?: string
          }
          if (row.actor_id && row.actor_id !== currentUserId && row.message) {
            toast.message(row.message)
          }
          void refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, currentUserId])

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No activity yet. Start shopping together!
          </p>
        ) : (
          <ol className="relative ml-3 space-y-0 border-l border-amber-200">
            {activity.map((a) => (
              <li key={a.id} className="relative pb-8 pl-8 last:pb-0">
                <span className="absolute top-0 -left-3 flex size-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white ring-4 ring-white">
                  {initials(a.actor_name).slice(0, 1)}
                </span>
                <div className="flex items-start gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials(a.actor_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {a.message}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
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
