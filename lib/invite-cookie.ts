export const INVITE_COOKIE = "homeos_invite"
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 14

export function inviteCookieOptions(maxAge = INVITE_COOKIE_MAX_AGE) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}
