import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { getListsWithStats } from "@/actions/queries"
import { CreateListDialog } from "@/components/shopping/create-list-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function ListsPage() {
  const lists = await getListsWithStats()

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Grocery Lists</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Multiple lists for groceries, parties, stores and more.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <CreateListDialog />
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-white py-12 text-center sm:py-20">
          <ShoppingBag className="mx-auto size-10 text-gray-200 sm:size-12" />
          <p className="mt-2 text-sm font-medium text-gray-700 sm:mt-3">
            No lists yet
          </p>
          <p className="mt-1 text-xs text-gray-400 sm:text-sm">
            Create Monthly Grocery, Vegetables, Costco, or anything you need.
          </p>
          <div className="mt-3 flex justify-center sm:mt-4">
            <CreateListDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {lists.map((list) => {
            const pct =
              list.total_items === 0
                ? 0
                : Math.round((list.completed_items / list.total_items) * 100)

            return (
              <Link key={list.id} href={`/dashboard/lists/${list.id}`}>
                <Card className="h-full transition-shadow active:scale-[0.99] hover:shadow-md">
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] sm:text-lg">
                      <ShoppingBag className="size-4 shrink-0 text-amber-500 sm:size-5" />
                      <span className="break-words">{list.name}</span>
                    </CardTitle>
                    <CardDescription>
                      Updated{" "}
                      {new Date(list.updated_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{list.remaining_items} remaining</Badge>
                      <Badge variant="outline">{pct}% done</Badge>
                      <Badge className="bg-amber-100 text-amber-800">
                        ₹{list.estimated_cost.toLocaleString("en-IN")}
                      </Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
