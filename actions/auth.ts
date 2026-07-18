"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { ensureHouseholdAfterAuth } from "@/lib/ensure-membership"
import type { ActionState } from "@/types/database"

export async function signupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm_password") ?? "")
  const householdName =
    String(formData.get("household_name") ?? "").trim() ||
    `${fullName || "My"}'s Household`
  const inviteToken = String(formData.get("invite_token") ?? "").trim()

  if (!fullName) return { error: "Full name is required." }
  if (!email) return { error: "Email is required." }
  if (password.length < 6) return { error: "Password must be at least 6 characters." }
  if (password !== confirm) return { error: "Passwords do not match." }

  try {
    const supabase = await createClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        data: {
          full_name: fullName,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        },
      },
    })

    if (error) return { error: error.message }
    if (!data.user) return { error: "Signup failed. Please try again." }

    // Ensure profile exists (trigger defaults role to MEMBER).
    // Do not set role here — that would wipe OWNER after household creation.
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        full_name: fullName,
        email,
      },
      { onConflict: "id" }
    )

    // No session yet (email confirmation required) — join/create on confirm or next login
    if (!data.session) {
      return {
        success: true,
        message: inviteToken
          ? "Check your email to confirm your account, then sign in to join the household."
          : "Check your email to confirm your account, then sign in.",
      }
    }

    const membership = await ensureHouseholdAfterAuth(supabase, {
      createIfMissing: !inviteToken,
      householdName,
    })

    if (membership === "none" && inviteToken) {
      return {
        error:
          "Account created but invite could not be accepted. Sign in again, or ask for a new invite.",
      }
    }

    if (membership === "none") {
      return {
        error:
          "Account created but household setup failed. Sign in and try again from onboarding.",
      }
    }

    revalidatePath("/", "layout")
    redirect("/dashboard")
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err
    console.error("[signupAction]", err)
    return { error: "Unable to create account. Please try again." }
  }
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return { error: "Email and password are required." }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    // Invitees who confirmed email often land on /login — join here.
    await ensureHouseholdAfterAuth(supabase, { createIfMissing: false })

    revalidatePath("/", "layout")
    redirect("/dashboard")
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err
    return { error: "Unable to sign in. Please try again." }
  }
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }

  try {
    const supabase = await createClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/dashboard/settings`,
    })
    if (error) return { error: error.message }
    return {
      success: true,
      message: "Check your email for a password reset link.",
    }
  } catch {
    return { error: "Unable to send reset email." }
  }
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
