"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { ShoppingListBoard } from "@/components/shopping/shopping-list-board"
import { DeleteListButton } from "@/components/shopping/delete-list-button"
import type { ShoppingItemWithPeople, ShoppingList } from "@/types/database"

export function ListWorkspace({
  list,
  householdId,
  currentUserId,
  initialItems,
}: {
  list: ShoppingList
  householdId: string
  currentUserId: string
  initialItems: ShoppingItemWithPeople[]
}) {
  const initialRemaining = initialItems.filter((i) => !i.completed)
  const [stats, setStats] = useState({
    remaining: initialRemaining.length,
    estimatedCost: initialRemaining.reduce(
      (sum, i) => sum + Number(i.estimated_price ?? 0),
      0
    ),
    total: initialItems.length,
  })

  const handleStatsChange = useCallback(
    (next: { remaining: number; estimatedCost: number; total: number }) => {
      setStats(next)
    },
    []
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard/lists"
            className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
          >
            <ChevronLeft className="size-4 shrink-0" />
            All lists
          </Link>
          <h1 className="break-anywhere text-2xl font-semibold tracking-tight">
            {list.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.remaining} remaining · ₹
            {stats.estimatedCost.toLocaleString("en-IN")} estimated
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <DeleteListButton listId={list.id} listName={list.name} />
        </div>
      </div>

      <ShoppingListBoard
        key={list.id}
        listId={list.id}
        householdId={householdId}
        currentUserId={currentUserId}
        initialItems={initialItems}
        onStatsChange={handleStatsChange}
      />
    </div>
  )
}
