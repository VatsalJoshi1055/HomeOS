"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { DASHBOARD_NAV } from "@/components/dashboard/app-sidebar"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid h-[var(--mobile-nav-height)] max-w-lg grid-cols-5">
        {DASHBOARD_NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                className={cn(
                  "flex h-full min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] font-medium transition-colors sm:text-[10px]",
                  active ? "text-amber-600" : "text-gray-400"
                )}
              >
                <item.icon
                  className={cn("size-5 shrink-0", active && "stroke-[2.25px]")}
                  aria-hidden
                />
                <span className="max-w-full truncate">{item.shortTitle}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
