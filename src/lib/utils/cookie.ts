import type { CookieOptions } from "hono/utils/cookie"

export const sharedCookieOption = {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
} as const satisfies CookieOptions
