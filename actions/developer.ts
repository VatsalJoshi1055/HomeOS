"use server"

import { createClient } from "@/lib/supabase/server"
import { isDeveloperEmail } from "@/lib/developer"
import { reportServerError } from "@/lib/errors-server"

export type DeveloperOverview = {
  users_total: number
  households_total: number
  active_24h: number
  active_7d: number
  errors_24h: number
  errors_7d: number
  lists_total: number
  items_total: number
  pending_invites: number
  generated_at: string
  recent_errors: Array<{
    id: string
    user_id: string | null
    household_id: string | null
    source: string
    operation: string | null
    message: string
    detail: Record<string, unknown> | null
    created_at: string
  }>
  recent_users: Array<{
    id: string
    full_name: string
    email: string
    household_id: string | null
    role: string
    last_seen_at: string | null
    created_at: string
  }>
  migration_required?: boolean
}

export async function getDeveloperOverview(): Promise<
  { data: DeveloperOverview | null; error: string | null; forbidden: boolean }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isDeveloperEmail(user?.email)) {
    return { data: null, error: "Not authorized.", forbidden: true }
  }

  const { data, error } = await supabase.rpc("developer_overview")
  if (error) {
    const missing =
      error.message?.includes("developer_overview") ||
      error.code === "PGRST202" ||
      error.code === "42883"
    if (missing) {
      return {
        data: { ...emptyOverview(), migration_required: true },
        error: null,
        forbidden: false,
      }
    }
    await reportServerError("developer_overview", error.message)
    return { data: null, error: error.message, forbidden: false }
  }

  return {
    data: data as DeveloperOverview,
    error: null,
    forbidden: false,
  }
}

function emptyOverview(): DeveloperOverview {
  return {
    users_total: 0,
    households_total: 0,
    active_24h: 0,
    active_7d: 0,
    errors_24h: 0,
    errors_7d: 0,
    lists_total: 0,
    items_total: 0,
    pending_invites: 0,
    generated_at: new Date().toISOString(),
    recent_errors: [],
    recent_users: [],
  }
}

