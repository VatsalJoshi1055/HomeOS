import { notFound } from "next/navigation"
import { getDeveloperOverview } from "@/actions/developer"
import { DeveloperDashboard } from "@/components/dev/developer-dashboard"

export const dynamic = "force-dynamic"

export default async function DeveloperPage() {
  const { data, error, forbidden } = await getDeveloperOverview()
  if (forbidden) notFound()

  return <DeveloperDashboard data={data} error={error} />
}
