import { notFound } from "next/navigation"
import { getListById, getListItems } from "@/actions/queries"
import { requireHousehold } from "@/lib/household"
import { ListWorkspace } from "@/components/shopping/list-workspace"

export const dynamic = "force-dynamic"

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, household } = await requireHousehold()
  const [list, items] = await Promise.all([getListById(id), getListItems(id)])

  if (!list) notFound()

  return (
    <ListWorkspace
      list={list}
      householdId={household.id}
      currentUserId={profile.id}
      initialItems={items}
    />
  )
}
