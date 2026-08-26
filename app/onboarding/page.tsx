import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { ensureHouseholdAfterAuth } from "@/lib/ensure-membership"
import { INVITE_COOKIE } from "@/lib/invite-cookie"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const membership = await ensureHouseholdAfterAuth(supabase, {
    createIfMissing: false,
    user,
  })

  if (membership === "joined" || membership === "has_household") {
    redirect("/dashboard")
  }

  const inviteToken = (await cookies()).get(INVITE_COOKIE)?.value?.trim()

  return <OnboardingForm inviteFailed={Boolean(inviteToken)} />
}
