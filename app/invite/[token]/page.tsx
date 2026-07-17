import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SignupForm } from "@/components/auth/signup-form"

type PendingInvite = {
  id: string
  household_id: string
  email: string
  token: string
  status: string
  household_name: string | null
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: inviteRows, error } = await supabase.rpc(
    "get_pending_invite_by_token",
    { p_token: token }
  )

  const invite = (Array.isArray(inviteRows) ? inviteRows[0] : inviteRows) as
    | PendingInvite
    | null
    | undefined

  if (error || !invite) {
    const missingRpc =
      error?.message?.includes("get_pending_invite_by_token") ||
      error?.code === "PGRST202" ||
      error?.code === "42883"

    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">
            {missingRpc ? "Invite setup incomplete" : "Invite not found"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {missingRpc
              ? "Run migration 20260717000003_invite_lookup_rpc.sql in the Supabase SQL Editor, then try this link again."
              : "This invite may have expired or already been used."}
          </p>
        </div>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { error: acceptError } = await supabase.rpc(
      "accept_household_invite",
      { p_token: token }
    )
    if (!acceptError) {
      redirect("/dashboard")
    }
  }

  const householdName = invite.household_name ?? "a household"

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
