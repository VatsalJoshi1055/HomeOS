"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { signupAction } from "@/actions/auth"
import type { ActionState } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionState = {}

export function SignupForm({ inviteToken }: { inviteToken?: string }) {
  const [state, action, pending] = useActionState(signupAction, initial)
  const [show, setShow] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    household_name: "",
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  return (
    <form action={action} className="space-y-5">
      {inviteToken && (
        <input type="hidden" name="invite_token" value={inviteToken} />
      )}

      {state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          autoCapitalize="words"
          required
          value={form.full_name}
          onChange={set("full_name")}
          placeholder="Alex Sharma"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={form.email}
          onChange={set("email")}
          placeholder="you@family.com"
        />
      </div>

      {!inviteToken && (
        <div className="space-y-2">
          <Label htmlFor="household_name">Household name</Label>
          <Input
            id="household_name"
            name="household_name"
            autoComplete="organization"
            value={form.household_name}
            onChange={set("household_name")}
            placeholder="Sharma Family"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Create password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={set("password")}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center text-gray-400"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <div className="relative">
          <Input
            id="confirm_password"
            name="confirm_password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            value={form.confirm_password}
            onChange={set("confirm_password")}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center text-gray-400"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full bg-amber-500 text-base text-white hover:bg-amber-600"
      >
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {pending ? "Creating…" : inviteToken ? "Join household" : "Create account"}
      </Button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-amber-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
