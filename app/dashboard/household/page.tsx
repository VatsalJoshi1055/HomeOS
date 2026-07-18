import { getHouseholdMembers } from "@/actions/queries"
import {
  getCurrentHousehold,
  getCurrentProfile,
} from "@/lib/household"
import { createClient } from "@/lib/supabase/server"
import { repairCreatorOwnerRole } from "@/lib/ensure-membership"
import { HouseholdPanel } from "@/components/household/household-panel"

export const dynamic = "force-dynamic"

export default async function HouseholdPage() {
  const [profile, household] = await Promise.all([
    getCurrentProfile(),
    getCurrentHousehold(),
  ])

  if (!profile || !household) return null

  // Self-heal if creator role was wiped to MEMBER
  if (profile.id === household.created_by && profile.role !== "OWNER") {
    const supabase = await createClient()
    await repairCreatorOwnerRole(supabase, profile.id, household.id)
  }

  const [freshProfile, members] = await Promise.all([
    getCurrentProfile(),
    getHouseholdMembers(),
  ])

  if (!freshProfile) return null

  return (
    <HouseholdPanel
      profile={freshProfile}
      household={household}
      members={members}
    />
  )
}
