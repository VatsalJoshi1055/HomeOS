import { getCurrentProfile } from "@/lib/household"
import { SettingsForms } from "@/components/settings/settings-forms"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) return null

  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Your profile, appearance, and app preferences.
        </p>
      </div>

      <SettingsForms profile={profile} />
    </div>
  )
}
