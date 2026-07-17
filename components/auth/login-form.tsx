"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { loginAction } from "@/actions/auth"
import type { ActionState } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial: ActionState = {}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
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
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@family.com"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="min-h-11 content-center text-sm font-medium text-amber-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center text-gray-400 hover:text-gray-600"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm text-gray-600">
        <input
          type="checkbox"
          name="remember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="size-5 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
        />
        Remember me
      </label>

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full bg-amber-500 text-base text-white hover:bg-amber-600"
      >
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-gray-500">
        New to HomeOS?{" "}
        <Link href="/signup" className="font-medium text-amber-600 hover:underline">
          Create account
        </Link>
      </p>
    </form>
  )
}
