import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    const user = data.user

    if (user) {
      const fullName =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "Member"
      const inviteToken = user.user_metadata?.invite_token as string | undefined

      await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: fullName,
          email: user.email ?? "",
          role: "MEMBER",
        },
        { onConflict: "id" }
      )

      const { data: profile } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", user.id)
        .maybeSingle()

      if (!profile?.household_id) {
        if (inviteToken) {
          const { error: acceptError } = await supabase.rpc("accept_household_invite", {
            p_token: inviteToken,
          })
          if (acceptError) {
            await supabase.rpc("create_household_for_current_user", {
              p_name: `${fullName}'s Household`,
            })
          }
        } else {
          await supabase.rpc("create_household_for_current_user", {
            p_name: `${fullName}'s Household`,
          })
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
