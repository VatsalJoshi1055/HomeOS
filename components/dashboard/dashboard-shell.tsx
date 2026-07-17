"use client"

import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav"
import { Button } from "@/components/ui/button"

export function DashboardShell({
  householdName,
  userName,
  children,
}: {
  householdName: string
  userName: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <div className="flex min-h-dvh min-h-svh bg-[var(--background)]">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-dvh h-svh">
          <AppSidebar householdName={householdName} userName={userName} />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative z-10 flex h-full w-[min(18.5rem,88vw)] max-w-full animate-in slide-in-from-left duration-200">
            <AppSidebar
              householdName={householdName}
              userName={userName}
              onNavigate={() => setOpen(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-2 z-20"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border/60 bg-white/95 px-2 backdrop-blur-md safe-pt sm:gap-3 sm:px-4 lg:min-h-16 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 py-2">
            <p className="truncate text-sm font-semibold text-gray-900">
              HomeOS
            </p>
            <p className="truncate text-xs text-muted-foreground lg:hidden">
              {householdName}
            </p>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 overflow-x-clip px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8 pb-mobile-nav lg:pb-8">
          {children}
        </main>

        <MobileBottomNav />
      </div>
    </div>
  )
}
