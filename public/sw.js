const CACHE_NAME = "homeos-shell-v2"
const SHELL_URLS = [
  "/",
  "/login",
  "/signup",
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

function isShellAsset(pathname) {
  return SHELL_URLS.includes(pathname) || pathname.startsWith("/icons/")
}

function shouldBypassCache(request, url) {
  if (url.pathname.startsWith("/auth/")) return true
  if (url.pathname.startsWith("/dashboard")) return true
  if (url.pathname.startsWith("/invite")) return true
  if (url.pathname.startsWith("/onboarding")) return true
  if (url.pathname.startsWith("/_next/")) return true
  if (url.pathname.includes("supabase")) return true

  // Next.js App Router / RSC fetches must never be cache-first
  if (request.headers.get("RSC") === "1") return true
  if (request.headers.get("Next-Router-Prefetch") === "1") return true
  if (request.headers.get("Next-Router-State-Tree")) return true

  return false
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Cross-origin (Supabase REST/Realtime WebSocket) — never intercept
  if (url.origin !== self.location.origin) return

  if (shouldBypassCache(request, url)) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache known offline shell navigations
          if (isShellAsset(url.pathname) && response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached || caches.match("/offline")
        })
    )
    return
  }

  // Static shell assets only: cache-first. Everything else network-only.
  if (!isShellAsset(url.pathname)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
