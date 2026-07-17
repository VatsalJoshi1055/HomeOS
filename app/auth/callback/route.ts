import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureHouseholdAfterAuth } from "@/lib/ensure-membership"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // Invitees: join household. Regular confirm: create household if needed.
    // Never create a new household when an invite token is present.
    await ensureHouseholdAfterAuth(supabase, { createIfMissing: true })
  }

  return NextResponse.redirect(`${origin}${next}`)
}
