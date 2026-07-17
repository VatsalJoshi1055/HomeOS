"use client"

import { useActionState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteHouseholdAction,
  inviteMemberAction,
  leaveHouseholdAction,
  updateHouseholdAction,
  updateProfileAction,
} from "@/actions/shopping"
import type { ActionState, Household, Profile } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const initial: ActionState = {}

export function SettingsForms({
  profile,
  household,
  isOwner,
}: {
  profile: Profile
  household: Household
  isOwner: boolean
}) {
  const router = useRouter()
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initial
  )
  const [houseState, houseAction, housePending] = useActionState(
    updateHouseholdAction,
    initial
  )
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteMemberAction,
    initial
  )
  const [leaving, startLeave] = useTransition()
  const [deleting, startDelete] = useTransition()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>Update how your name appears to family.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="max-w-md space-y-4">
            {profileState.message && (
              <Success msg={profileState.message} />
            )}
            {profileState.error && <ErrorMsg msg={profileState.error} />}
            <div className="space-y-2">
              <Label htmlFor="full_name">Display name</Label>
              <Input
                id="full_name"
                name="full_name"
                autoComplete="name"
                defaultValue={profile.full_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-gray-50" />
            </div>
            <Button
              type="submit"
              disabled={profilePending}
              className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
            >
              {profilePending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Household name</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={houseAction} className="max-w-md space-y-4">
              {houseState.message && <Success msg={houseState.message} />}
              {houseState.error && <ErrorMsg msg={houseState.error} />}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={household.name}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={housePending}
                className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
              >
                {housePending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save household
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invite members</CardTitle>
            <CardDescription>
              Send an invite link so family can join this household.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={inviteAction} className="max-w-md space-y-4">
              {inviteState.message && <Success msg={inviteState.message} />}
              {inviteState.error && <ErrorMsg msg={inviteState.error} />}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="family@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={invitePending}
                className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
              >
                {invitePending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Create invite link
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Realtime updates are always on for connected family members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Item changes sync instantly via Supabase Realtime. Keep this tab
            open on your phone while shopping for live check-offs.
          </p>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {!isOwner && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={leaving}
              onClick={() => {
                if (!confirm("Leave this household?")) return
                startLeave(async () => {
                  const r = await leaveHouseholdAction()
                  if (r.error) toast.error(r.error)
                  else {
                    toast.success("You left the household")
                    router.push("/onboarding")
                    router.refresh()
                  }
                })
              }}
            >
              {leaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Leave household
            </Button>
          )}
          {isOwner && (
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={deleting}
              onClick={() => {
                if (
                  !confirm(
                    "Delete this household and ALL shopping data? This cannot be undone."
                  )
                )
                  return
                startDelete(async () => {
                  const r = await deleteHouseholdAction()
                  if (r.error) toast.error(r.error)
                  else {
                    toast.success("Household deleted")
                    router.push("/onboarding")
                    router.refresh()
                  }
                })
              }}
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete household
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Success({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      <span className="break-all">{msg}</span>
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {msg}
    </div>
  )
}
