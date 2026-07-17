import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignupForm } from "@/components/auth/signup-form"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: invite } = await supabase
    .from("household_invites")
    .select("*, households(name)")
    .eq("token", token)
    .eq("status", "PENDING")
    .maybeSingle()

  if (!invite) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            This invite may have expired or already been used.
          </p>
        </div>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase
      .from("profiles")
      .update({ household_id: invite.household_id, role: "MEMBER" })
      .eq("id", user.id)
    await supabase
      .from("household_invites")
      .update({ status: "ACCEPTED" })
      .eq("id", invite.id)
    redirect("/dashboard")
  }

  const householdName =
    (invite.households as { name?: string } | null)?.name ?? "a household"

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50/50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Join {householdName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create your HomeOS account to join this household.
        </p>
        <div className="mt-6">
          <SignupForm inviteToken={token} />
        </div>
      </div>
    </div>
  )
}
