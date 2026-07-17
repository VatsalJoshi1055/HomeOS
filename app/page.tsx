import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/household"

export default async function HomePage() {
  const profile = await getCurrentProfile()
  redirect(profile ? "/dashboard" : "/login")
}
