import type { CookieOptions } from "hono/utils/cookie"

export const sharedCookieNames = {
    sessionId: "sid",
} as const satisfies Record<string, string>

export const sharedCookieOption = {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
} as const satisfies CookieOptions
