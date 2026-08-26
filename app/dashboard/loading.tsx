import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="page-stack">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
        <Skeleton className="h-16 rounded-xl sm:h-20" />
        <Skeleton className="h-16 rounded-xl sm:h-20" />
        <Skeleton className="h-16 rounded-xl sm:h-20" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  )
}
