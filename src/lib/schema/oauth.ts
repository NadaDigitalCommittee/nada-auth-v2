import * as v from "valibot"

export const oAuthCallbackQueryParams = v.union([
    v.object({
        state: v.string(),
        code: v.string(),
        error: v.optional(v.undefined()),
    }),
    v.object({
        state: v.string(),
        error: v.string(),
    }),
])
