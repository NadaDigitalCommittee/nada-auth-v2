import { createMiddleware } from "hono/factory"
import * as v from "valibot"

import { $EnvVars, type Env } from "@/lib/schema/env"

export const envVarsValidator = createMiddleware<Env>(async (c, next) => {
    const envVarsParseResult = v.safeParse($EnvVars, c.env)
    if (envVarsParseResult.success) {
        Object.assign(c.env, envVarsParseResult.output)
        await next()
    } else {
        console.error({
            // https://developers.cloudflare.com/workers/observability/logs/workers-logs/#best-practices
            error: {
                name: "ValiError",
                issues: envVarsParseResult.issues.map((issue) => ({
                    message: issue.message,
                    dotPath: v.getDotPath(issue),
                })),
            },
        })
        return c.text("Internal Server Error", 500)
    }
})
