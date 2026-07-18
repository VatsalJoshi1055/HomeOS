"use client"

import { useActionState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { updateProfileAction } from "@/actions/shopping"
import type { ActionState, Profile } from "@/types/database"
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

export function SettingsForms({ profile }: { profile: Profile }) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initial
  )

  return (
    <div className="page-stack">
      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">Profile</CardTitle>
          <CardDescription>
            Update how your name appears to family.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="max-w-md space-y-4">
            {profileState.message && <Success msg={profileState.message} />}
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
              className="min-h-11 w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
            >
              {profilePending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">Appearance</CardTitle>
          <CardDescription>
            HomeOS uses a light amber theme optimized for shopping outdoors and
            indoors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Theme is fixed to light mode for clarity on phones while grocery
            shopping. Dark mode is not offered yet.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">Notifications</CardTitle>
          <CardDescription>
            Realtime updates stay on for connected family members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Item changes sync instantly via Supabase Realtime. Keep the list
            open on your phone while shopping for live check-offs. Toast
            messages appear when someone else updates a list.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">
            Application preferences
          </CardTitle>
          <CardDescription>
            Defaults that keep HomeOS fast and reliable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Live sync reconnects automatically after sleep or offline.</p>
          <p>• Voice input uses your device microphone when supported.</p>
          <p>• Install HomeOS to your home screen for a full-screen shopping app.</p>
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
