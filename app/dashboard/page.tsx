import Link from "next/link"
import {
  CheckCircle2,
  IndianRupee,
  ListPlus,
  Package,
  ShoppingBag,
} from "lucide-react"
import {
  getActivityFeed,
  getDashboardMetrics,
  getListsWithStats,
} from "@/actions/queries"
import { getCurrentHousehold, getCurrentProfile } from "@/lib/household"
import { CreateListDialog } from "@/components/shopping/create-list-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [profile, household, metrics, lists, activity] = await Promise.all([
    getCurrentProfile(),
    getCurrentHousehold(),
    getDashboardMetrics(),
    getListsWithStats(),
    getActivityFeed(8),
  ])

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="page-title">
            Hi, {profile?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {household?.name ?? "Your household"} · shopping command center
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-2">
          <CreateListDialog triggerLabel="Create List" />
          {lists[0] && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={`/dashboard/lists/${lists[0].id}`}>Quick Add</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
        <MetricCard
          label="Items remaining"
          value={String(metrics.remainingCount)}
          icon={Package}
        />
        <MetricCard
          label="Completed today"
          value={String(metrics.completedTodayCount)}
          icon={CheckCircle2}
        />
        <MetricCard
          label="Estimated cost"
          value={`₹${metrics.estimatedCost.toLocaleString("en-IN")}`}
          icon={IndianRupee}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your lists</CardTitle>
            <CardDescription>Jump back into a shopping list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 sm:space-y-2">
            {lists.length === 0 ? (
              <p className="text-sm text-gray-400">No lists yet — create one.</p>
            ) : (
              lists.slice(0, 5).map((list) => (
                <Link
                  key={list.id}
                  href={`/dashboard/lists/${list.id}`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2 hover:bg-amber-50/50 sm:min-h-14 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-amber-500" />
                    <span className="text-sm font-medium">{list.name}</span>
                  </div>
                  <Badge variant="outline">
                    {list.remaining_items} left
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Family activity</CardTitle>
            <CardDescription>Who changed what, recently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet.</p>
            ) : (
              activity.map((a) => (
                <div key={a.id} className="flex gap-2 text-xs sm:gap-3 sm:text-sm">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700 sm:size-8 sm:text-xs">
                    {(a.actor_name ?? "?")
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-gray-800">{a.message}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {a.list_name ? ` · ${a.list_name}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/dashboard/activity">View all activity</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recently added</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.recentlyAdded.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing added yet.</p>
            ) : (
              metrics.recentlyAdded.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-gray-800">{item.title}</span>
                  <span className="text-xs text-gray-400">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently purchased</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.recentlyPurchased.length === 0 ? (
              <p className="text-sm text-gray-400">No purchases today.</p>
            ) : (
              metrics.recentlyPurchased.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-gray-800 line-through decoration-amber-400">
                    {item.title}
                  </span>
                  <CheckCircle2 className="size-4 text-green-500" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {lists.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ListPlus className="size-10 text-amber-500" />
            <p className="font-medium text-gray-800">Create your first list</p>
            <CreateListDialog />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="py-2 md:py-4">
      <CardContent className="flex items-center gap-2 pt-0 sm:gap-4 sm:pt-1">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 sm:size-11 sm:rounded-xl">
          <Icon className="size-3.5 sm:size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p className="truncate text-base font-semibold tracking-tight sm:text-2xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
