import { redirect } from "next/navigation"
import { getAuthContext } from "@/lib/household"
import { isDeveloperEmail } from "@/lib/developer"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, household } = await getAuthContext()
  if (!user || !profile) redirect("/login")

  if (!profile.household_id || !household) {
    redirect("/onboarding")
  }

  return (
    <DashboardShell
      householdName={household.name}
      userName={profile.full_name}
      userId={profile.id}
      isDeveloper={isDeveloperEmail(user.email ?? profile.email)}
    >
      {children}
    </DashboardShell>
  )
}
