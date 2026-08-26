import { createClient } from "@/lib/supabase/client"
import { detectCategory } from "@/lib/categories"
import type { ItemPriority, ShoppingItem } from "@/types/database"

export type ClientActionResult<T = void> = {
  error?: string
  data?: T
}

function fail(error: string): ClientActionResult<never> {
  return { error }
}

export async function clientToggleItem(input: {
  itemId: string
  householdId: string
  userId: string
  completed: boolean
}): Promise<ClientActionResult> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("shopping_items")
    .update({
      completed: input.completed,
      completed_by: input.completed ? input.userId : null,
      completed_at: input.completed ? now : null,
      updated_by: input.userId,
      updated_at: now,
    })
    .eq("id", input.itemId)
    .eq("household_id", input.householdId)

  if (error) return fail(error.message)
  return {}
}

export async function clientDeleteItem(input: {
  itemId: string
  householdId: string
}): Promise<ClientActionResult> {
  const supabase = createClient()
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", input.itemId)
    .eq("household_id", input.householdId)

  if (error) return fail(error.message)
  return {}
}

export async function clientInsertItem(input: {
  listId: string
  householdId: string
  userId: string
  title: string
  quantity: number
  unit: string | null
  category: string | null
  notes: string | null
  estimated_price: number
  priority: ItemPriority
  sort_order: number
}): Promise<ClientActionResult<ShoppingItem>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("shopping_items")
    .insert({
      list_id: input.listId,
      household_id: input.householdId,
      title: input.title,
      quantity: input.quantity,
      unit: input.unit,
      category: input.category ?? detectCategory(input.title),
      notes: input.notes,
      estimated_price: input.estimated_price,
      priority: input.priority,
      sort_order: input.sort_order,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("*")
    .single()

  if (error || !data) return fail(error?.message ?? "Failed to add item.")
  return { data: data as ShoppingItem }
}

export async function clientInsertItemsBulk(input: {
  listId: string
  householdId: string
  userId: string
  sortStart: number
  items: Array<{ title: string; quantity: number; unit: string | null }>
}): Promise<ClientActionResult<ShoppingItem[]>> {
  if (!input.items.length) return fail("No items to add.")
  const supabase = createClient()
  let sort = input.sortStart
  const rows = input.items.map((item) => ({
    list_id: input.listId,
    household_id: input.householdId,
    title: item.title,
    quantity: item.quantity,
    unit: item.unit,
    category: detectCategory(item.title),
    estimated_price: 0,
    priority: "MEDIUM" as ItemPriority,
    sort_order: sort++,
    created_by: input.userId,
    updated_by: input.userId,
  }))

  const { data, error } = await supabase
    .from("shopping_items")
    .insert(rows)
    .select("*")

  if (error) return fail(error.message)
  return { data: (data ?? []) as ShoppingItem[] }
}

export async function clientUpdateItem(input: {
  itemId: string
  householdId: string
  userId: string
  title: string
  quantity: number
  unit: string | null
  category: string | null
  notes: string | null
  estimated_price: number
  priority: ItemPriority
}): Promise<ClientActionResult<ShoppingItem>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("shopping_items")
    .update({
      title: input.title,
      quantity: input.quantity,
      unit: input.unit,
      category: input.category,
      notes: input.notes,
      estimated_price: input.estimated_price,
      priority: input.priority,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("household_id", input.householdId)
    .select("*")
    .single()

  if (error || !data) return fail(error?.message ?? "Failed to update item.")
  return { data: data as ShoppingItem }
}

export async function clientDuplicateItem(input: {
  item: ShoppingItem
  householdId: string
  userId: string
}): Promise<ClientActionResult<ShoppingItem>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("shopping_items")
    .insert({
      list_id: input.item.list_id,
      household_id: input.householdId,
      title: `${input.item.title} (copy)`,
      quantity: input.item.quantity,
      unit: input.item.unit,
      category: input.item.category,
      notes: input.item.notes,
      estimated_price: input.item.estimated_price,
      priority: input.item.priority,
      sort_order: input.item.sort_order + 1,
      created_by: input.userId,
      updated_by: input.userId,
      completed: false,
    })
    .select("*")
    .single()

  if (error || !data) return fail(error?.message ?? "Failed to duplicate.")
  return { data: data as ShoppingItem }
}

export async function clientBulkComplete(input: {
  householdId: string
  userId: string
  itemIds: string[]
}): Promise<ClientActionResult> {
  if (!input.itemIds.length) return fail("No items selected.")
  const supabase = createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("shopping_items")
    .update({
      completed: true,
      completed_by: input.userId,
      completed_at: now,
      updated_by: input.userId,
      updated_at: now,
    })
    .in("id", input.itemIds)
    .eq("household_id", input.householdId)

  if (error) return fail(error.message)
  return {}
}

export async function clientBulkDelete(input: {
  householdId: string
  itemIds: string[]
}): Promise<ClientActionResult> {
  if (!input.itemIds.length) return fail("No items selected.")
  const supabase = createClient()
  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .in("id", input.itemIds)
    .eq("household_id", input.householdId)

  if (error) return fail(error.message)
  return {}
}
