"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Home, Loader2 } from "lucide-react"
import { createHouseholdOnboardingAction } from "@/actions/shopping"
import type { ActionState } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionState = {}

export default function OnboardingPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    createHouseholdOnboardingAction,
    initial
  )

  useEffect(() => {
    if (state.success) {
      router.push("/dashboard")
      router.refresh()
    }
  }, [state.success, router])

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50/50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-white p-8 shadow-sm">
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-amber-500 text-white">
          <Home className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold">Create your household</h1>
        <p className="mt-1 text-sm text-gray-500">
          You don&apos;t belong to a household yet. Create one to start shopping
          together.
        </p>

        <form action={action} className="mt-6 space-y-4">
          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Household name</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Sharma Family"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full bg-amber-500 text-base text-white hover:bg-amber-600"
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create household
          </Button>
        </form>
      </div>
    </div>
  )
}
