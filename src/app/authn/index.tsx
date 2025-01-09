import { vValidator } from "@hono/valibot-validator"
import {
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageResult,
    Routes,
} from "discord-api-types/v10"
import { Hono } from "hono"
import { hc } from "hono/client"
import { getCookie, setCookie } from "hono/cookie"
import { Style } from "hono/css"
import type { FC } from "hono/jsx"
import * as v from "valibot"

import type { AppType } from "@/app"
import { type ErrorContext, reportErrorWithContext } from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $RequestToken, $Session, type AuthNRequestRecord } from "@/lib/schema/kvNamespaces"
import { sharedCookieNames, sharedCookieOption } from "@/lib/utils/cookie"
import { wrapWithTryCatchAsync } from "@/lib/utils/exceptions"

const Layout: FC = ({ children }) => {
    return (
        <html>
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                <title>Google でサインイン</title>
                <Style />
            </head>
            <body>
                <main>{children}</main>
            </body>
        </html>
    )
}

const app = new Hono<Env>().get(
    "/",
    vValidator(
        "query",
        v.object({
            token: v.optional($RequestToken),
        }),
    ),
    async (c) => {
        const authNRequestRecord = c.env.AuthNRequests
        const sessionRecord = c.env.Sessions
        const { rest } = c.var
        const sessionId = await (async () => {
            const requestToken = c.req.valid("query").token
            if (!requestToken) return
            const kvSessionIdKey = `requestToken:${requestToken}` satisfies keyof AuthNRequestRecord
            const kvSessionId = await authNRequestRecord.get(kvSessionIdKey)
            if (kvSessionId) {
                await authNRequestRecord.delete(kvSessionIdKey)
                setCookie(c, sharedCookieNames.sessionId, kvSessionId, {
                    ...sharedCookieOption,
                    sameSite: "Lax",
                })
                return kvSessionId
            } else return getCookie(c, sharedCookieNames.sessionId)
        })()
        if (!sessionId) {
            return c.html(<Layout>トークンが無効です。</Layout>, 400)
        }
        const rawSession = await wrapWithTryCatchAsync(
            async () => await sessionRecord.get(sessionId, "json"),
        )
        const sessionParseResult = v.safeParse($Session, rawSession)
        if (!sessionParseResult.success) {
            await reportErrorWithContext(new v.ValiError(sessionParseResult.issues), {}, c.env)
            return c.html(<Layout>セッションが無効です。</Layout>)
        }
        const session = sessionParseResult.output
        const errorContext = {
            guildId: session.guildId,
            user: session.user,
        } as const satisfies ErrorContext
        const originalInteractionResRoute = Routes.webhookMessage(
            c.env.DISCORD_APPLICATION_ID,
            session.interactionToken,
            "@original",
        )
        const originalResponse = (await rest
            .get(originalInteractionResRoute)
            .catch(async (e: unknown) => {
                if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                return null
            })) as RESTPatchAPIWebhookWithTokenMessageResult | null
        if (originalResponse?.components?.length) {
            await rest
                .patch(originalInteractionResRoute, {
                    body: {
                        content: ":tickets: リンクが使用されました。",
                        components: [],
                    } satisfies RESTPatchAPIWebhookWithTokenMessageJSONBody,
                })
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                })
        }
        const honoClient = hc<AppType>(new URL(c.req.url).origin)
        const apiOAuthUrl: URL = honoClient.api.oauth.$url()
        apiOAuthUrl.protocol = "https:"
        return c.redirect(apiOAuthUrl)
    },
)

/**
 * @package
 */
export { app as authn }
