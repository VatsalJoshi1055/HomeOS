"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireHousehold, requireProfile } from "@/lib/household"
import { detectCategory } from "@/lib/categories"
import { reportServerError } from "@/lib/errors-server"
import type { ActionState, ItemPriority } from "@/types/database"

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

async function logActivity(
  supabase: ServerSupabase,
  householdId: string,
  actorId: string,
  action: string,
  message: string,
  listId?: string | null,
  itemId?: string | null
) {
  const { error } = await supabase.from("activity_log").insert({
    household_id: householdId,
    actor_id: actorId,
    action,
    message,
    list_id: listId ?? null,
    item_id: itemId ?? null,
  })
  if (error) {
    await reportServerError("logActivity", error.message, { action })
  }
}

export async function createListAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "List name is required." }

  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({
        household_id: household.id,
        name,
        created_by: profile.id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    await logActivity(
      supabase,
      household.id,
      profile.id,
      "list_created",
      `${profile.full_name} created list "${name}"`,
      data.id
    )

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/lists")
    return { success: true, message: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create list." }
  }
}

export async function deleteListAction(listId: string): Promise<ActionState> {
  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()

    const { data: list } = await supabase
      .from("shopping_lists")
      .select("name")
      .eq("id", listId)
      .eq("household_id", household.id)
      .maybeSingle()

    const { error } = await supabase
      .from("shopping_lists")
      .delete()
      .eq("id", listId)
      .eq("household_id", household.id)

    if (error) return { error: error.message }

    await logActivity(
      supabase,
      household.id,
      profile.id,
      "list_deleted",
      `${profile.full_name} deleted list "${list?.name ?? "Untitled"}"`
    )

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/lists")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete list." }
  }
}

export async function createItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const listId = String(formData.get("list_id") ?? "").trim()
  const title = String(formData.get("title") ?? "").trim()
  const quantity = parseFloat(String(formData.get("quantity") ?? "1")) || 1
  const unit = String(formData.get("unit") ?? "").trim() || null
  const category =
    String(formData.get("category") ?? "").trim() || detectCategory(title)
  const notes = String(formData.get("notes") ?? "").trim() || null
  const estimated_price =
    parseFloat(String(formData.get("estimated_price") ?? "0")) || 0
  const priority = (String(formData.get("priority") ?? "MEDIUM") ||
    "MEDIUM") as ItemPriority

  if (!listId) return { error: "List is required." }
  if (!title) return { error: "Item title is required." }

  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()

    const { data: maxRow } = await supabase
      .from("shopping_items")
      .select("sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const sort_order = (maxRow?.sort_order ?? 0) + 1

    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        list_id: listId,
        household_id: household.id,
        title,
        quantity,
        unit,
        category,
        notes,
        estimated_price,
        priority,
        sort_order,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }
    return { success: true, message: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add item." }
  }
}

export async function createItemsBulkAction(
  listId: string,
  items: Array<{ title: string; quantity: number; unit: string | null }>
): Promise<ActionState> {
  if (!items.length) return { error: "No items to add." }

  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()

    const { data: maxRow } = await supabase
      .from("shopping_items")
      .select("sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    let sort = (maxRow?.sort_order ?? 0) + 1
    const rows = items.map((item) => ({
      list_id: listId,
      household_id: household.id,
      title: item.title,
      quantity: item.quantity,
      unit: item.unit,
      category: detectCategory(item.title),
      estimated_price: 0,
      priority: "MEDIUM" as ItemPriority,
      sort_order: sort++,
      created_by: profile.id,
      updated_by: profile.id,
    }))

    const { error } = await supabase.from("shopping_items").insert(rows)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add items." }
  }
}

export async function updateItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim()
  const title = String(formData.get("title") ?? "").trim()
  const quantity = parseFloat(String(formData.get("quantity") ?? "1")) || 1
  const unit = String(formData.get("unit") ?? "").trim() || null
  const category = String(formData.get("category") ?? "").trim() || null
  const notes = String(formData.get("notes") ?? "").trim() || null
  const estimated_price =
    parseFloat(String(formData.get("estimated_price") ?? "0")) || 0
  const priority = (String(formData.get("priority") ?? "MEDIUM") ||
    "MEDIUM") as ItemPriority

  if (!id || !title) return { error: "Invalid item." }

  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()

    const { error } = await supabase
      .from("shopping_items")
      .update({
        title,
        quantity,
        unit,
        category,
        notes,
        estimated_price,
        priority,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("household_id", household.id)

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update item." }
  }
}

export async function toggleItemCompleteAction(
  itemId: string,
  completed: boolean
): Promise<ActionState> {
  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()

    const { data: item } = await supabase
      .from("shopping_items")
      .select("title, list_id")
      .eq("id", itemId)
      .eq("household_id", household.id)
      .maybeSingle()

    if (!item) return { error: "Item not found." }

    const { error } = await supabase
      .from("shopping_items")
      .update({
        completed,
        completed_by: completed ? profile.id : null,
        completed_at: completed ? new Date().toISOString() : null,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("household_id", household.id)

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update item." }
  }
}

export async function deleteItemAction(itemId: string): Promise<ActionState> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const { data: item } = await supabase
      .from("shopping_items")
      .select("title, list_id")
      .eq("id", itemId)
      .eq("household_id", household.id)
      .maybeSingle()

    if (!item) return { error: "Item not found." }

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", itemId)
      .eq("household_id", household.id)

    if (error) return { error: error.message }
    return { success: true, message: item.list_id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete item." }
  }
}

export async function duplicateItemAction(itemId: string): Promise<ActionState> {
  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()

    const { data: item } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("id", itemId)
      .eq("household_id", household.id)
      .maybeSingle()

    if (!item) return { error: "Item not found." }

    const { error } = await supabase.from("shopping_items").insert({
      list_id: item.list_id,
      household_id: household.id,
      title: `${item.title} (copy)`,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      notes: item.notes,
      estimated_price: item.estimated_price,
      priority: item.priority,
      sort_order: item.sort_order + 1,
      created_by: profile.id,
      updated_by: profile.id,
      completed: false,
    })

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to duplicate." }
  }
}

export async function bulkCompleteAction(
  listId: string,
  itemIds: string[]
): Promise<ActionState> {
  if (!itemIds.length) return { error: "No items selected." }
  try {
    const { profile, household } = await requireHousehold()
    const supabase = await createClient()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from("shopping_items")
      .update({
        completed: true,
        completed_by: profile.id,
        completed_at: now,
        updated_by: profile.id,
        updated_at: now,
      })
      .in("id", itemIds)
      .eq("household_id", household.id)

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bulk complete failed." }
  }
}

export async function bulkDeleteAction(
  listId: string,
  itemIds: string[]
): Promise<ActionState> {
  if (!itemIds.length) return { error: "No items selected." }
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .in("id", itemIds)
      .eq("household_id", household.id)

    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Bulk delete failed." }
  }
}

export async function reorderItemsAction(
  listId: string,
  orderedIds: string[]
): Promise<ActionState> {
  try {
    const { household } = await requireHousehold()
    const supabase = await createClient()

    await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("shopping_items")
          .update({ sort_order: index + 1 })
          .eq("id", id)
          .eq("household_id", household.id)
      )
    )

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Reorder failed." }
  }
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const full_name = String(formData.get("full_name") ?? "").trim()
  if (!full_name) return { error: "Name is required." }

  try {
    const profile = await requireProfile()
    const supabase = await createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ full_name })
      .eq("id", profile.id)
    if (error) return { error: error.message }
    revalidatePath("/dashboard", "layout")
    return { success: true, message: "Profile updated." }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed." }
  }
}

export async function updateHouseholdAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Household name is required." }

  try {
    const { profile, household } = await requireHousehold()
    if (profile.role !== "OWNER" && profile.id !== household.created_by) {
      return { error: "Only owners can rename." }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("households")
      .update({ name })
      .eq("id", household.id)
    if (error) return { error: error.message }
    revalidatePath("/dashboard", "layout")
    return { success: true, message: "Household updated." }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Update failed." }
  }
}

export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }

  try {
    const { profile, household } = await requireHousehold()
    if (profile.role !== "OWNER" && profile.id !== household.created_by) {
      return { error: "Only owners can invite." }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("household_invites")
      .insert({
        household_id: household.id,
        email,
        invited_by: profile.id,
      })
      .select("token")
      .single()

    if (error) return { error: error.message }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    const inviteUrl = `${siteUrl}/invite/${data.token}`

    await logActivity(
      supabase,
      household.id,
      profile.id,
      "member_invited",
      `${profile.full_name} invited ${email}`
    )

    revalidatePath("/dashboard/household")
    revalidatePath("/dashboard", "layout")
    return {
      success: true,
      message: "Invite link ready to share.",
      inviteUrl,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invite failed." }
  }
}

export async function leaveHouseholdAction(): Promise<ActionState> {
  try {
    const { profile, household } = await requireHousehold()
    if (profile.role === "OWNER") {
      return {
        error: "Owners must delete the household or transfer ownership first.",
      }
    }

    const supabase = await createClient()
    await logActivity(
      supabase,
      household.id,
      profile.id,
      "member_left",
      `${profile.full_name} left the household`
    )

    const { error } = await supabase
      .from("profiles")
      .update({ household_id: null, role: "MEMBER" })
      .eq("id", profile.id)

    if (error) return { error: error.message }
    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Leave failed." }
  }
}

export async function createHouseholdOnboardingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "Household name is required." }

  try {
    const profile = await requireProfile()
    if (profile.household_id) {
      return { success: true, message: "already_joined" }
    }

    const supabase = await createClient()
    const { data: household, error } = await supabase.rpc(
      "create_household_for_current_user",
      { p_name: name }
    )

    if (error || !household) {
      return { error: error?.message ?? "Failed to create household." }
    }

    revalidatePath("/", "layout")
    return { success: true, message: "created" }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create household.",
    }
  }
}

export async function deleteHouseholdAction(): Promise<ActionState> {
  try {
    const { profile, household } = await requireHousehold()
    if (profile.role !== "OWNER" && profile.id !== household.created_by) {
      return { error: "Only owners can delete." }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("households")
      .delete()
      .eq("id", household.id)

    if (error) return { error: error.message }
    revalidatePath("/", "layout")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed." }
  }
}
