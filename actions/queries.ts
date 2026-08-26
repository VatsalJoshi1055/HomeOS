"use server"

import { createClient } from "@/lib/supabase/server"
import { requireHousehold } from "@/lib/household"
import { reportServerError, toErrorMessage } from "@/lib/errors-server"
import type {
  ActivityLogWithActor,
  Profile,
  ShoppingItemWithPeople,
  ShoppingListWithStats,
} from "@/types/database"

export async function getListsWithStats(): Promise<ShoppingListWithStats[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const [{ data: lists, error: listError }, { data: items, error: itemError }] =
      await Promise.all([
        supabase
          .from("shopping_lists")
          .select("*")
          .eq("household_id", household.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("shopping_items")
          .select("list_id, completed, estimated_price")
          .eq("household_id", household.id),
      ])

    if (listError) throw listError
    if (itemError) throw itemError

    return (lists ?? []).map((list) => {
      const listItems = (items ?? []).filter((i) => i.list_id === list.id)
      const completed = listItems.filter((i) => i.completed).length
      const total = listItems.length
      const cost = listItems
        .filter((i) => !i.completed)
        .reduce((sum, i) => sum + Number(i.estimated_price ?? 0), 0)

      return {
        ...list,
        total_items: total,
        remaining_items: total - completed,
        completed_items: completed,
        estimated_cost: cost,
      } as ShoppingListWithStats
    })
  } catch (err) {
    await reportServerError(
      "getListsWithStats",
      toErrorMessage(err, "Failed to load lists")
    )
    return []
  }
}

export async function getListById(id: string) {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("id", id)
      .eq("household_id", household.id)
      .maybeSingle()
    if (error) throw error
    return data
  } catch (err) {
    await reportServerError(
      "getListById",
      toErrorMessage(err, "Failed to load list"),
      { id }
    )
    return null
  }
}

export async function getListItems(
  listId: string
): Promise<ShoppingItemWithPeople[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const [{ data: items, error: itemError }, { data: profiles, error: profileError }] =
      await Promise.all([
        supabase
          .from("shopping_items")
          .select("*")
          .eq("list_id", listId)
          .eq("household_id", household.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("household_id", household.id),
      ])

    if (itemError) throw itemError
    if (profileError) throw profileError

    const nameMap = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name as string])
    )

    return (items ?? []).map((item) => ({
      ...item,
      creator_name: item.created_by
        ? nameMap.get(item.created_by) ?? null
        : null,
      completer_name: item.completed_by
        ? nameMap.get(item.completed_by) ?? null
        : null,
    })) as ShoppingItemWithPeople[]
  } catch (err) {
    await reportServerError(
      "getListItems",
      toErrorMessage(err, "Failed to load items"),
      { listId }
    )
    return []
  }
}

export async function getHouseholdMembers(): Promise<Profile[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("household_id", household.id)
      .order("created_at")
    if (error) throw error
    return (data ?? []) as Profile[]
  } catch (err) {
    await reportServerError(
      "getHouseholdMembers",
      toErrorMessage(err, "Failed to load members")
    )
    return []
  }
}

export async function getActivityFeed(
  limit = 40
): Promise<ActivityLogWithActor[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const [{ data: logs, error: logError }, { data: profiles }, { data: lists }] =
      await Promise.all([
        supabase
          .from("activity_log")
          .select("*")
          .eq("household_id", household.id)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("household_id", household.id),
        supabase
          .from("shopping_lists")
          .select("id, name")
          .eq("household_id", household.id),
      ])

    if (logError) throw logError

    const names = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name as string])
    )
    const listNames = new Map(
      (lists ?? []).map((l) => [l.id, l.name as string])
    )

    return (logs ?? []).map((log) => ({
      ...log,
      actor_name: log.actor_id ? names.get(log.actor_id) ?? null : null,
      list_name: log.list_id ? listNames.get(log.list_id) ?? null : null,
    })) as ActivityLogWithActor[]
  } catch (err) {
    await reportServerError(
      "getActivityFeed",
      toErrorMessage(err, "Failed to load activity")
    )
    return []
  }
}

export async function getDashboardMetrics() {
  const empty = {
    remainingCount: 0,
    completedTodayCount: 0,
    estimatedCost: 0,
    recentlyAdded: [] as Array<{
      id: string
      title: string
      quantity: number
      unit: string | null
    }>,
    recentlyPurchased: [] as Array<{ id: string; title: string }>,
  }

  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const todayStart = `${today}T00:00:00.000Z`

    const [
      remainingRes,
      completedRes,
      costRes,
      addedRes,
      purchasedRes,
    ] = await Promise.all([
      supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("household_id", household.id)
        .eq("completed", false),
      supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("household_id", household.id)
        .eq("completed", true)
        .gte("completed_at", todayStart),
      supabase
        .from("shopping_items")
        .select("estimated_price")
        .eq("household_id", household.id)
        .eq("completed", false),
      supabase
        .from("shopping_items")
        .select("id, title, quantity, unit")
        .eq("household_id", household.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("shopping_items")
        .select("id, title")
        .eq("household_id", household.id)
        .eq("completed", true)
        .gte("completed_at", todayStart)
        .order("completed_at", { ascending: false })
        .limit(5),
    ])

    const estimatedCost = (costRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.estimated_price ?? 0),
      0
    )

    return {
      remainingCount: remainingRes.count ?? 0,
      completedTodayCount: completedRes.count ?? 0,
      estimatedCost,
      recentlyAdded: addedRes.data ?? [],
      recentlyPurchased: purchasedRes.data ?? [],
    }
  } catch (err) {
    await reportServerError(
      "getDashboardMetrics",
      toErrorMessage(err, "Failed to load metrics")
    )
    return empty
  }
}
