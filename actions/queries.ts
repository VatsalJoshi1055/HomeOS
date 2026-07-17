"use server"

import { createClient } from "@/lib/supabase/server"
import { requireHousehold } from "@/lib/household"
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

    const [{ data: lists }, { data: items }] = await Promise.all([
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
  } catch {
    return []
  }
}

export async function getListById(id: string) {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()
    const { data } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("id", id)
      .eq("household_id", household.id)
      .maybeSingle()
    return data
  } catch {
    return null
  }
}

export async function getListItems(
  listId: string
): Promise<ShoppingItemWithPeople[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const [{ data: items }, { data: profiles }] = await Promise.all([
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
  } catch {
    return []
  }
}

export async function getHouseholdMembers(): Promise<Profile[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("household_id", household.id)
      .order("created_at")
    return (data ?? []) as Profile[]
  } catch {
    return []
  }
}

export async function getActivityFeed(
  limit = 40
): Promise<ActivityLogWithActor[]> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const [{ data: logs }, { data: profiles }, { data: lists }] =
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
  } catch {
    return []
  }
}

export async function getDashboardMetrics() {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: items } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", household.id)

    const all = items ?? []
    const remaining = all.filter((i) => !i.completed)
    const completedToday = all.filter(
      (i) =>
        i.completed &&
        i.completed_at &&
        String(i.completed_at).slice(0, 10) === today
    )
    const estimatedCost = remaining.reduce(
      (s, i) => s + Number(i.estimated_price ?? 0),
      0
    )
    const recentlyAdded = [...all]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5)
    const recentlyPurchased = [...completedToday]
      .sort(
        (a, b) =>
          new Date(b.completed_at ?? 0).getTime() -
          new Date(a.completed_at ?? 0).getTime()
      )
      .slice(0, 5)

    return {
      remainingCount: remaining.length,
      completedTodayCount: completedToday.length,
      estimatedCost,
      recentlyAdded,
      recentlyPurchased,
    }
  } catch {
    return {
      remainingCount: 0,
      completedTodayCount: 0,
      estimatedCost: 0,
      recentlyAdded: [],
      recentlyPurchased: [],
    }
  }
}
