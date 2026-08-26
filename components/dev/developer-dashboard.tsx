import type { DeveloperOverview } from "@/actions/developer"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function DeveloperDashboard({
  data,
  error,
}: {
  data: DeveloperOverview | null
  error: string | null
}) {
  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Developer</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Production visibility for the HomeOS operator account.
        </p>
      </div>

      {data?.migration_required && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run migration{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs">
            20260826000000_perf_invites_errors_admin.sql
          </code>{" "}
          in the Supabase SQL Editor to enable counts, error logs, and health
          stats.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Users" value={data.users_total} />
            <Stat label="Households" value={data.households_total} />
            <Stat label="Active 24h" value={data.active_24h} />
            <Stat label="Active 7d" value={data.active_7d} />
            <Stat label="Errors 24h" value={data.errors_24h} warn={data.errors_24h > 0} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Lists" value={data.lists_total} />
            <Stat label="Items" value={data.items_total} />
            <Stat label="Pending invites" value={data.pending_invites} />
            <Stat label="Errors 7d" value={data.errors_7d} warn={data.errors_7d > 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Health</CardTitle>
              <CardDescription>
                Snapshot at {formatWhen(data.generated_at)}. Active users use
                last-seen from the installed/browser app.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              <p>
                {data.errors_24h === 0
                  ? "No application errors logged in the last 24 hours."
                  : `${data.errors_24h} failed operations were logged in the last 24 hours.`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent users</CardTitle>
              <CardDescription>Newest accounts first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recent_users.length === 0 ? (
                <p className="text-sm text-gray-400">No users yet.</p>
              ) : (
                data.recent_users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.full_name || "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="outline">{user.role}</Badge>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {user.last_seen_at
                          ? `Seen ${formatWhen(user.last_seen_at)}`
                          : "Never seen"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application errors</CardTitle>
              <CardDescription>
                Failed operations from client and server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recent_errors.length === 0 ? (
                <p className="text-sm text-gray-400">No errors logged yet.</p>
              ) : (
                data.recent_errors.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-red-100 bg-red-50/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{row.source}</Badge>
                      {row.operation && (
                        <span className="text-xs font-medium text-red-800">
                          {row.operation}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {formatWhen(row.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-800">{row.message}</p>
                    {row.detail && (
                      <pre className="mt-1 overflow-x-auto text-[11px] text-gray-500">
                        {JSON.stringify(row.detail)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <Card className="py-3">
      <CardContent className="pt-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={`text-xl font-semibold tabular-nums ${
            warn ? "text-red-600" : "text-gray-900"
          }`}
        >
          {value.toLocaleString("en-IN")}
        </p>
      </CardContent>
    </Card>
  )
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}
