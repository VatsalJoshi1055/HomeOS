import { getHouseholdMembers } from "@/actions/queries"
import {
  getCurrentHousehold,
  getCurrentProfile,
} from "@/lib/household"
import { SettingsForms } from "@/components/settings/settings-forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [profile, household, members] = await Promise.all([
    getCurrentProfile(),
    getCurrentHousehold(),
    getHouseholdMembers(),
  ])

  if (!profile || !household) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your household, members and profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Household members</CardTitle>
          <CardDescription>
            Everyone here can edit shared shopping lists in real time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {m.full_name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.full_name}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </div>
              </div>
              <Badge
                className={
                  m.role === "OWNER"
                    ? "bg-amber-500 text-white"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }
                variant={m.role === "OWNER" ? "default" : "outline"}
              >
                {m.role === "OWNER" ? "Owner" : "Member"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <SettingsForms
        profile={profile}
        household={household}
        isOwner={profile.role === "OWNER"}
      />
    </div>
  )
}
