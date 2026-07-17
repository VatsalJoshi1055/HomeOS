import { getActivityFeed } from "@/actions/queries"
import { requireHousehold } from "@/lib/household"
import { LiveActivityFeed } from "@/components/activity/live-activity-feed"

export const dynamic = "force-dynamic"

export default async function ActivityPage() {
  const [{ profile, household }, activity] = await Promise.all([
    requireHousehold(),
    getActivityFeed(80),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          A live timeline of everything your household changed.
        </p>
      </div>

      <LiveActivityFeed
        householdId={household.id}
        currentUserId={profile.id}
        initialActivity={activity}
      />
    </div>
  )
}
