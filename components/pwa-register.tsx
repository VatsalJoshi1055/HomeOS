"use client"

import { useEffect } from "react"

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      } catch {
        /* ignore registration failures in unsupported environments */
      }
    }

    void register()
  }, [])

  return null
}
