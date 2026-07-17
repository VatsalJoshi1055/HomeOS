"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteListAction } from "@/actions/shopping"
import { Button } from "@/components/ui/button"

export function DeleteListButton({
  listId,
  listName,
}: {
  listId: string
  listName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      className="w-full text-red-600 hover:bg-red-50 sm:w-auto"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${listName}" and all its items?`)) return
        startTransition(async () => {
          const result = await deleteListAction(listId)
          if (result.error) toast.error(result.error)
          else {
            toast.success("List deleted")
            router.push("/dashboard/lists")
            router.refresh()
          }
        })
      }}
    >
      {pending ? (
        <Loader2 className="mr-1.5 size-4 animate-spin" />
      ) : (
        <Trash2 className="mr-1.5 size-4" />
      )}
      Delete list
    </Button>
  )
}
