export const DEVELOPER_EMAIL = "vatsal02015@gmail.com"

export function isDeveloperEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEVELOPER_EMAIL
}
