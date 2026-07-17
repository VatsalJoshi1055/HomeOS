import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 45) return "just now"
  if (seconds < 90) return "1 minute ago"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 5400) return "1 hour ago"
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 172800) return "yesterday"
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}
