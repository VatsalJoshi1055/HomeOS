"use client"

import { useSyncExternalStore } from "react"
import { formatRelativeTime } from "@/lib/utils"

function subscribe() {
  return () => {}
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function formatStableDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/** Avoids SSR/client mismatch from Date.now()-based relative labels. */
export function RelativeTime({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  if (!value) return null

  return (
    <time dateTime={value} className={className}>
      {mounted ? formatRelativeTime(value) : formatStableDate(value)}
    </time>
  )
}
