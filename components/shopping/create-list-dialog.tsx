"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createListAction } from "@/actions/shopping"
import type { ActionState } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const initial: ActionState = {}

export function CreateListDialog({
  triggerLabel = "New List",
}: {
  triggerLabel?: string
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createListAction, initial)

  useEffect(() => {
    if (state.success && state.message) {
      router.push(`/dashboard/lists/${state.message}`)
      router.refresh()
    }
  }, [state, router])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create shopping list</DialogTitle>
          <DialogDescription>
            Examples: Monthly Grocery, Vegetables, Costco, Diwali Shopping.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">List name</Label>
            <Input id="name" name="name" required placeholder="Monthly Grocery" autoFocus />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-amber-500 text-white hover:bg-amber-600 sm:w-auto"
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
