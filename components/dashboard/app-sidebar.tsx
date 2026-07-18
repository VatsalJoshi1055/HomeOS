"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react"
import { logoutAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export const DASHBOARD_NAV = [
  {
    title: "Dashboard",
    shortTitle: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Grocery Lists",
    shortTitle: "Lists",
    href: "/dashboard/lists",
    icon: ShoppingCart,
  },
  {
    title: "Activity",
    shortTitle: "Activity",
    href: "/dashboard/activity",
    icon: Activity,
  },
  {
    title: "Household",
    shortTitle: "Family",
    href: "/dashboard/household",
    icon: Users,
  },
  {
    title: "Settings",
    shortTitle: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
] as const

interface AppSidebarProps {
  householdName: string
  userName: string
  onNavigate?: () => void
}

export function AppSidebar({
  householdName,
  userName,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border/60 bg-white lg:w-64">
      <div className="safe-pt border-b border-border/60 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
            <Home className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{householdName}</p>
            <p className="truncate text-xs text-muted-foreground">{userName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {DASHBOARD_NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-sm transition-colors",
                active
                  ? "bg-amber-50 font-medium text-amber-700"
                  : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
              )}
            >
              <item.icon className="size-5 shrink-0" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      <div className="safe-pb border-t border-border/60 p-2">
        <Separator className="mb-2" />
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-12 w-full justify-start gap-3 text-muted-foreground"
          >
            <LogOut className="size-5" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  )
}
