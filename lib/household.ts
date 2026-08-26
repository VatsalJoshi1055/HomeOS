import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Household, Profile } from "@/types/database"

export const getAuthContext = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, profile: null as Profile | null, household: null as Household | null }
  }

  const { data } = await supabase
    .from("profiles")
    .select("*, household:households(*)")
    .eq("id", user.id)
    .maybeSingle()

  if (!data) {
    return { user, profile: null as Profile | null, household: null as Household | null }
  }

  const { household: joinedHousehold, ...profileFields } = data as Profile & {
    household: Household | Household[] | null
  }
  const household = Array.isArray(joinedHousehold)
    ? (joinedHousehold[0] ?? null)
    : joinedHousehold

  return {
    user,
    profile: profileFields as Profile,
    household: (household as Household | null) ?? null,
  }
})

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const { profile } = await getAuthContext()
    return profile
  } catch {
    return null
  }
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) throw new Error("Not authenticated.")
  return profile
}

export async function getCurrentHousehold(): Promise<Household | null> {
  try {
    const { household } = await getAuthContext()
    return household
  } catch {
    return null
  }
}

export async function requireHousehold(): Promise<{
  profile: Profile
  household: Household
}> {
  const { profile, household } = await getAuthContext()
  if (!profile) throw new Error("Not authenticated.")
  if (!household) throw new Error("No household found.")
  return { profile, household }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}
