import { createMiddleware } from "hono/factory"
import * as v from "valibot"

import { $EnvVars, type Env } from "@/lib/schema/env"

const redactInputFromIssue = (issue: v.BaseIssue<unknown>) => ({
    ...issue,
    input: "<REDACTED>",
    received: "<REDACTED>",
})
export const envVarsValidator = createMiddleware<Env>(async (c, next) => {
    const envVarsParseResult = v.safeParse($EnvVars, c.env)
    if (envVarsParseResult.success) {
        Object.assign(c.env, envVarsParseResult.output)
        await next()
    } else {
        const { issues } = envVarsParseResult
        const [headIssue, ...tailIssues] = issues
        console.error({
            // https://developers.cloudflare.com/workers/observability/logs/workers-logs/#best-practices
            error: new v.ValiError([
                // issues.map(redactInputFromIssue) と書くと
                // 型が [T, ...T[]] から T[] にWidening
                redactInputFromIssue(headIssue),
                ...tailIssues.map(redactInputFromIssue),
            ]),
        })
        return c.text("Internal Server Error", 500)
    }
})
