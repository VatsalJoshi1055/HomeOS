"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Cross-browser Realtime + Auth lifecycle.
 *
 * Safari/iOS and Chromium throttle timers in background tabs, which can stall
 * JWT auto-refresh and leave the Realtime socket subscribed but silent.
 * On resume we nudge the session and let callers catch up / reconnect.
 */
export function bindRealtimeLifecycle(handlers: {
  onResume: () => void
  onBackground?: () => void
}): () => void {
  const supabase = createClient()

  const resume = () => {
    void supabase.auth.startAutoRefresh()
    void supabase.auth.getSession().finally(() => {
      handlers.onResume()
    })
  }

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      resume()
    } else {
      void supabase.auth.stopAutoRefresh()
      handlers.onBackground?.()
    }
  }

  const onOnline = () => {
    resume()
  }

  const onPageShow = (event: PageTransitionEvent) => {
    // bfcache restore (common on Safari / iOS)
    if (event.persisted || document.visibilityState === "visible") {
      resume()
    }
  }

  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("online", onOnline)
  window.addEventListener("pageshow", onPageShow)

  if (document.visibilityState === "visible") {
    void supabase.auth.startAutoRefresh()
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("online", onOnline)
    window.removeEventListener("pageshow", onPageShow)
  }
}

export function realtimeBackoffMs(attempt: number): number {
  // 1s, 2s, 4s, 8s, 15s cap
  return Math.min(1000 * 2 ** Math.max(0, attempt), 15_000)
}
