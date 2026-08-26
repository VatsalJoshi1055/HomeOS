import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { ensureHouseholdAfterAuth } from "@/lib/ensure-membership"
import { INVITE_COOKIE } from "@/lib/invite-cookie"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    const store = await cookies()
    const inviteToken = store.get(INVITE_COOKIE)?.value?.trim() ?? ""

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const metadataToken = (
      user?.user_metadata?.invite_token as string | undefined
    )?.trim()
    const token = metadataToken || inviteToken

    // Never create a new household when an invite is in play.
    await ensureHouseholdAfterAuth(supabase, {
      createIfMissing: !token,
      inviteToken: token,
      user,
    })
  }

  return NextResponse.redirect(`${origin}${next}`)
}
