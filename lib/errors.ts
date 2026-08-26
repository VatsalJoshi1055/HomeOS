import { createClient } from "@/lib/supabase/client"
import { serializeErrorDetail } from "@/lib/error-utils"

export { toErrorMessage } from "@/lib/error-utils"

export async function reportClientError(
  operation: string,
  message: string,
  detail?: unknown
) {
  console.error(`[HomeOS] ${operation}:`, message, detail ?? "")
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from("app_error_logs").insert({
      user_id: user?.id ?? null,
      source: "client",
      operation,
      message,
      detail: serializeErrorDetail(detail),
    })
    if (error) {
      console.error("[HomeOS] failed to persist client error", error.message)
    }
  } catch (err) {
    console.error("[HomeOS] failed to persist client error", err)
  }
}
