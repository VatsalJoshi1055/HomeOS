import { createClient } from "@/lib/supabase/server"
import { serializeErrorDetail, toErrorMessage } from "@/lib/error-utils"

export { toErrorMessage }

export async function reportServerError(
  operation: string,
  message: string,
  detail?: unknown
) {
  console.error(`[HomeOS] ${operation}:`, message, detail ?? "")
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from("app_error_logs").insert({
      user_id: user?.id ?? null,
      source: "server",
      operation,
      message,
      detail: serializeErrorDetail(detail),
    })
    if (error) {
      console.error("[HomeOS] failed to persist server error", error.message)
    }
  } catch (err) {
    console.error("[HomeOS] failed to persist server error", err)
  }
}
