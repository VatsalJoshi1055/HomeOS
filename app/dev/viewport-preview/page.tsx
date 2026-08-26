"use client"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ShoppingListBoard } from "@/components/shopping/shopping-list-board"
import { LiveActivityFeed } from "@/components/activity/live-activity-feed"
import { CreateListDialog } from "@/components/shopping/create-list-dialog"
import type {
  ActivityLogWithActor,
  ShoppingItemWithPeople,
} from "@/types/database"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ShoppingBag } from "lucide-react"

const mockItems: ShoppingItemWithPeople[] = [
  {
    id: "1",
    list_id: "list-1",
    household_id: "hh-1",
    title: "Milk",
    quantity: 2,
    unit: "L",
    category: "Dairy",
    notes: null,
    estimated_price: 60,
    priority: "MEDIUM",
    completed: false,
    sort_order: 1,
    created_by: "u1",
    updated_by: "u1",
    completed_by: null,
    created_at: "2026-07-17T10:00:00.000Z",
    updated_at: "2026-07-17T10:00:00.000Z",
    completed_at: null,
    creator_name: "Vatsal Joshi",
    completer_name: null,
  },
  {
    id: "2",
    list_id: "list-1",
    household_id: "hh-1",
    title: "Extra-long specialty Himalayan basmati rice pack",
    quantity: 5,
    unit: "kg",
    category: "Grains",
    notes: "Prefer the yellow bag if available at the store",
    estimated_price: 450,
    priority: "HIGH",
    completed: false,
    sort_order: 2,
    created_by: "u2",
    updated_by: "u2",
    completed_by: null,
    created_at: "2026-07-17T09:50:00.000Z",
    updated_at: "2026-07-17T09:50:00.000Z",
    completed_at: null,
    creator_name: "Mom",
    completer_name: null,
  },
  {
    id: "3",
    list_id: "list-1",
    household_id: "hh-1",
    title: "Chicken",
    quantity: 1,
    unit: "kg",
    category: "Meat",
    notes: null,
    estimated_price: 0,
    priority: "MEDIUM",
    completed: true,
    sort_order: 3,
    created_by: "u1",
    updated_by: "u1",
    completed_by: "u2",
    created_at: "2026-07-17T09:30:00.000Z",
    updated_at: "2026-07-17T09:45:00.000Z",
    completed_at: "2026-07-17T09:45:00.000Z",
    creator_name: "Vatsal Joshi",
    completer_name: "Mom",
  },
]

const mockActivity: ActivityLogWithActor[] = [
  {
    id: "a1",
    household_id: "hh-1",
    list_id: "list-1",
    item_id: "1",
    actor_id: "u1",
    action: "item_added",
    message: "Vatsal Joshi added Milk, Chicken and Rice via voice",
    created_at: "2026-07-17T10:05:00.000Z",
    actor_name: "Vatsal Joshi",
    list_name: "July Groceries",
  },
  {
    id: "a2",
    household_id: "hh-1",
    list_id: "list-1",
    item_id: "3",
    actor_id: "u2",
    action: "item_completed",
    message: "Mom completed Chicken",
    created_at: "2026-07-17T09:45:00.000Z",
    actor_name: "Mom",
    list_name: "July Groceries",
  },
]

export default function ViewportPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Viewport preview is only available in development.
        </p>
      </div>
    )
  }

  return (
    <DashboardShell householdName="Joshi's Family Household" userName="Vatsal Joshi" userId="preview">
      <div className="space-y-8">
        <section className="space-y-3" data-testid="preview-dashboard">
          <h1 className="break-anywhere text-2xl font-semibold tracking-tight">
            Hi, Vatsal
          </h1>
          <p className="text-sm text-muted-foreground">
            Joshi&apos;s Family Household · family shopping command center
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Items remaining", "Completed today", "Estimated cost"].map(
              (label, i) => (
                <Card key={label}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold">
                      {i === 2 ? "₹510" : i === 0 ? "2" : "1"}
                    </p>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </section>

        <section className="space-y-3" data-testid="preview-lists">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Shopping Lists</h2>
              <p className="text-sm text-muted-foreground">
                Multiple lists for groceries, parties, stores and more.
              </p>
            </div>
            <CreateListDialog />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingBag className="size-5 text-amber-500" />
                  <span className="break-anywhere">July Groceries</span>
                </CardTitle>
                <CardDescription>Updated just now</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline">2 remaining</Badge>
                <Badge variant="outline">33% done</Badge>
                <Badge className="bg-amber-100 text-amber-800">₹510</Badge>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-3" data-testid="preview-list-detail">
          <div>
            <Link
              href="/dashboard/lists"
              className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-amber-600"
            >
              All lists
            </Link>
            <h2 className="break-anywhere text-2xl font-semibold">
              July Groceries
            </h2>
            <p className="text-sm text-muted-foreground">
              2 remaining · ₹510 estimated
            </p>
          </div>
          <ShoppingListBoard
            listId="list-1"
            householdId="hh-1"
            currentUserId="u1"
            initialItems={mockItems}
          />
        </section>

        <section data-testid="preview-activity">
          <LiveActivityFeed
            householdId="hh-1"
            currentUserId="u1"
            initialActivity={mockActivity}
          />
        </section>
      </div>
    </DashboardShell>
  )
}
