import { redirect } from "next/navigation"
import { getCurrentHousehold, getCurrentProfile } from "@/lib/household"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  if (!profile.household_id) {
    redirect("/onboarding")
  }

  const household = await getCurrentHousehold()

  return (
    <DashboardShell
      householdName={household?.name ?? "My Household"}
      userName={profile.full_name}
    >
      {children}
    </DashboardShell>
  )
}
