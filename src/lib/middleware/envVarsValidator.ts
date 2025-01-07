import { createMiddleware } from "hono/factory"
import * as v from "valibot"

import { $EnvVars, type Env } from "@/lib/schema/env"

export const envVarsValidator = createMiddleware<Env>(async (c, next) => {
    const envVarsParseResult = v.safeParse($EnvVars, c.env)
    if (envVarsParseResult.success) {
        Object.assign(c.env, envVarsParseResult.output)
        await next()
    } else {
        console.error(new v.ValiError(envVarsParseResult.issues))
        return c.text("Internal Server Error", 500)
    }
})
