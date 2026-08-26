"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteListAction } from "@/actions/shopping"
import { reportClientError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DeleteListButton({
  listId,
  listName,
}: {
  listId: string
  listName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full text-red-600 hover:bg-red-50 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1.5 size-4" />
        Delete list
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{listName}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the list and all of its items.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteListAction(listId)
                  if (result.error) {
                    toast.error(result.error)
                    void reportClientError("delete_list", result.error, { listId })
                    return
                  }
                  toast.success("List deleted")
                  setOpen(false)
                  router.push("/dashboard/lists")
                  router.refresh()
                })
              }}
            >
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
