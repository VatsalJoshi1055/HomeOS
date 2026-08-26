import { getHouseholdMembers } from "@/actions/queries"
import { getAuthContext } from "@/lib/household"
import { createClient } from "@/lib/supabase/server"
import { repairCreatorOwnerRole } from "@/lib/ensure-membership"
import { HouseholdPanel } from "@/components/household/household-panel"

export const dynamic = "force-dynamic"

export default async function HouseholdPage() {
  const { profile, household } = await getAuthContext()
  if (!profile || !household) return null

  let displayProfile = profile
  if (profile.id === household.created_by && profile.role !== "OWNER") {
    const supabase = await createClient()
    await repairCreatorOwnerRole(supabase, profile.id, household.id)
    displayProfile = { ...profile, role: "OWNER" }
  }

  const members = await getHouseholdMembers()

  return (
    <HouseholdPanel
      profile={displayProfile}
      household={household}
      members={members}
    />
  )
}
