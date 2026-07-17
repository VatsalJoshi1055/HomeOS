import { createClient } from "@/lib/supabase/server"
import type { Household, Profile } from "@/types/database"

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    return (data as Profile | null) ?? null
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
    const profile = await getCurrentProfile()
    if (!profile?.household_id) return null

    const supabase = await createClient()
    const { data } = await supabase
      .from("households")
      .select("*")
      .eq("id", profile.household_id)
      .maybeSingle()

    return (data as Household | null) ?? null
  } catch {
    return null
  }
}

export async function requireHousehold(): Promise<{
  profile: Profile
  household: Household
}> {
  const profile = await requireProfile()
  if (!profile.household_id) throw new Error("No household found.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("households")
    .select("*")
    .eq("id", profile.household_id)
    .maybeSingle()

  if (error || !data) throw new Error("Household not found.")
  return { profile, household: data as Household }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}
