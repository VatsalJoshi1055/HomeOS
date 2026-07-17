import type { createClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type MembershipResult = "has_household" | "joined" | "created" | "none"

/**
 * After auth (login / email confirm callback), attach the user to a household.
 * Prefers invite token from user metadata, then pending invite by email.
 * Only creates a new household when `createIfMissing` is true (normal signup confirm).
 */
export async function ensureHouseholdAfterAuth(
  supabase: Supabase,
  options: {
    createIfMissing?: boolean
    householdName?: string
  } = {}
): Promise<MembershipResult> {
  const { createIfMissing = false, householdName } = options

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return "none"

  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Member"
  const inviteToken = (
    user.user_metadata?.invite_token as string | undefined
  )?.trim()

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      email: (user.email ?? "").toLowerCase(),
      role: "MEMBER",
    },
    { onConflict: "id" }
  )

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.household_id) return "has_household"

  if (inviteToken) {
    const { error } = await supabase.rpc("accept_household_invite", {
      p_token: inviteToken,
    })
    if (!error) {
      await clearInviteToken(supabase)
      return "joined"
    }
  }

  const { error: emailAcceptError } = await supabase.rpc(
    "accept_pending_invite_for_current_user"
  )
  if (!emailAcceptError) {
    await clearInviteToken(supabase)
    return "joined"
  }

  // Invite signups must not silently create a separate household.
  if (inviteToken) return "none"

  if (createIfMissing) {
    const { error } = await supabase.rpc("create_household_for_current_user", {
      p_name: householdName?.trim() || `${fullName}'s Household`,
    })
    if (!error) return "created"
  }

  return "none"
}

async function clearInviteToken(supabase: Supabase) {
  try {
    await supabase.auth.updateUser({
      data: { invite_token: null },
    })
  } catch {
    /* non-fatal */
  }
}
