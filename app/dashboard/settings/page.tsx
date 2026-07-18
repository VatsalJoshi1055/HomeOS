import { getCurrentProfile } from "@/lib/household"
import { SettingsForms } from "@/components/settings/settings-forms"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) return null

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your profile, appearance, and app preferences.
        </p>
      </div>

      <SettingsForms profile={profile} />
    </div>
  )
}
