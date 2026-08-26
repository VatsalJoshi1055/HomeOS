import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"
import type { createClient } from "@/lib/supabase/server"
import { INVITE_COOKIE, inviteCookieOptions } from "@/lib/invite-cookie"

type Supabase = Awaited<ReturnType<typeof createClient>>

export type MembershipResult = "has_household" | "joined" | "created" | "none"

/**
 * After auth (login / email confirm callback), attach the user to a household.
 * Prefers invite token (explicit, metadata, cookie), then pending invite by email.
 * Only creates a new household when `createIfMissing` is true AND no invite is in play.
 */
export async function ensureHouseholdAfterAuth(
  supabase: Supabase,
  options: {
    createIfMissing?: boolean
    householdName?: string
    inviteToken?: string
    user?: User | null
  } = {}
): Promise<MembershipResult> {
  const { createIfMissing = false, householdName } = options

  const user =
    options.user ??
    (
      await supabase.auth.getUser()
    ).data.user
  if (!user) return "none"

  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Member"

  const cookieToken = await readInviteCookie()
  const inviteToken = (
    options.inviteToken ||
    (user.user_metadata?.invite_token as string | undefined) ||
    cookieToken ||
    ""
  ).trim()

  const { data: existing } = await supabase
    .from("profiles")
    .select("household_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle()

  if (!existing) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName,
        email: (user.email ?? "").toLowerCase(),
      },
      { onConflict: "id" }
    )
  }

  const { data: profile } = existing
    ? { data: existing }
    : await supabase
        .from("profiles")
        .select("household_id, role")
        .eq("id", user.id)
        .maybeSingle()

  if (profile?.household_id) {
    if (profile.role !== "OWNER") {
      await repairCreatorOwnerRole(supabase, user.id, profile.household_id)
    }
    await clearInviteCookie()
    return "has_household"
  }

  if (inviteToken) {
    const { error } = await supabase.rpc("accept_household_invite", {
      p_token: inviteToken,
    })
    if (!error) {
      await clearInviteToken(supabase)
      await clearInviteCookie()
      return "joined"
    }
  }

  const { error: emailAcceptError } = await supabase.rpc(
    "accept_pending_invite_for_current_user"
  )
  if (!emailAcceptError) {
    await clearInviteToken(supabase)
    await clearInviteCookie()
    return "joined"
  }

  // Invite signups must not silently create a separate household.
  if (inviteToken) return "none"

  if (createIfMissing) {
    const { error } = await supabase.rpc("create_household_for_current_user", {
      p_name: householdName?.trim() || `${fullName}'s Household`,
    })
    if (!error) {
      await clearInviteCookie()
      return "created"
    }
  }

  return "none"
}

/** If this user created the household, ensure their profile role is OWNER. */
export async function repairCreatorOwnerRole(
  supabase: Supabase,
  userId: string,
  householdId: string
): Promise<void> {
  const { data: household } = await supabase
    .from("households")
    .select("created_by")
    .eq("id", householdId)
    .maybeSingle()

  if (!household || household.created_by !== userId) return

  await supabase
    .from("profiles")
    .update({ role: "OWNER" })
    .eq("id", userId)
    .neq("role", "OWNER")
}

async function readInviteCookie(): Promise<string> {
  try {
    const store = await cookies()
    return store.get(INVITE_COOKIE)?.value?.trim() ?? ""
  } catch {
    return ""
  }
}

async function clearInviteCookie() {
  try {
    const store = await cookies()
    store.set(INVITE_COOKIE, "", { ...inviteCookieOptions(0), maxAge: 0 })
  } catch {
    /* non-fatal — Server Component cookie lock, etc. */
  }
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
