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
    <div className="page-stack">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard/lists"
            className="mb-0.5 inline-flex min-h-9 items-center gap-0.5 text-xs font-medium text-amber-600 hover:underline sm:mb-1 sm:min-h-11 sm:text-sm"
          >
            <ChevronLeft className="size-3.5 shrink-0 sm:size-4" />
            All lists
          </Link>
          <h1 className="page-title break-anywhere">{list.name}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
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
