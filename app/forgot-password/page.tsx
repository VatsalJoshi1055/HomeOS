"use client"

import { useActionState } from "react"
import Link from "next/link"
import { CheckCircle2, Home, Loader2 } from "lucide-react"
import { forgotPasswordAction } from "@/actions/auth"
import type { ActionState } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionState = {}

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial)

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50/50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-white p-8 shadow-sm">
        <Link href="/login" className="mb-6 flex items-center gap-2 font-semibold text-amber-600">
          <Home className="size-5" />
          HomeOS
        </Link>
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll email you a secure reset link.
        </p>

        <form action={action} className="mt-6 space-y-4">
          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}
          {state.message && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {state.message}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full bg-amber-500 text-base text-white hover:bg-amber-600"
          >
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Send reset link
          </Button>
        </form>
      </div>
    </div>
  )
}
