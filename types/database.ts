export type HouseholdRole = "OWNER" | "MEMBER"

export type ItemPriority = "LOW" | "MEDIUM" | "HIGH"

export type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED"

export interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface Profile {
  id: string
  household_id: string | null
  full_name: string
  email: string
  role: HouseholdRole
  avatar_url: string | null
  created_at: string
}

export interface ShoppingList {
  id: string
  household_id: string
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ShoppingItem {
  id: string
  list_id: string
  household_id: string
  title: string
  quantity: number
  unit: string | null
  category: string | null
  notes: string | null
  estimated_price: number
  priority: ItemPriority
  completed: boolean
  sort_order: number
  created_by: string | null
  updated_by: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface ActivityLog {
  id: string
  household_id: string
  list_id: string | null
  item_id: string | null
  actor_id: string | null
  action: string
  message: string
  created_at: string
}

export interface HouseholdInvite {
  id: string
  household_id: string
  email: string
  invited_by: string | null
  token: string
  status: InviteStatus
  created_at: string
}

export interface ShoppingListWithStats extends ShoppingList {
  total_items: number
  remaining_items: number
  completed_items: number
  estimated_cost: number
}

export interface ShoppingItemWithPeople extends ShoppingItem {
  creator_name?: string | null
  completer_name?: string | null
}

export interface ActivityLogWithActor extends ActivityLog {
  actor_name?: string | null
  list_name?: string | null
}

export type ActionState = {
  error?: string
  success?: boolean
  message?: string
}
