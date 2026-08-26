type ErrorDetail = Record<string, unknown> | null

export function serializeErrorDetail(detail: unknown): ErrorDetail {
  if (detail == null) return null
  try {
    return JSON.parse(JSON.stringify(detail)) as Record<string, unknown>
  } catch {
    return { value: String(detail) }
  }
}

export function toErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err.trim()) return err
  return fallback
}
