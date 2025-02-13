import { Alert } from "@chakra-ui/react"
import { css } from "@emotion/react"
import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import {
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageResult,
    Routes,
} from "discord-api-types/v10"
import { Hono } from "hono"
import { hc } from "hono/client"
import { getCookie, setCookie } from "hono/cookie"
import type { ReactNode } from "react"
import * as v from "valibot"

import type { AppType } from "@/app"
import { createLayout } from "@/components/layout"
import { type ErrorContext, reportErrorWithContext } from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $RequestToken, $Session, type AuthNRequestRecord } from "@/lib/schema/kvNamespaces"
import { sharedCookieNames, sharedCookieOption } from "@/lib/utils/cookie"
import { shouldBeError } from "@/lib/utils/exceptions"

const ErrorAlert = ({ title, description }: { title: ReactNode; description: ReactNode }) => (
    <Alert.Root
        status="error"
        css={css`
            max-width: 70rem;
        `}
    >
        <Alert.Indicator />
        <Alert.Content>
            <Alert.Title>{title}</Alert.Title>
            <Alert.Description>{description}</Alert.Description>
        </Alert.Content>
    </Alert.Root>
)

const app = new Hono<Env>().get(
    "/",
    reactRenderer(({ children }) =>
        createLayout({ head: <title>Google でサインイン</title> })({
            children: (
                <main
                    css={css`
                        padding: 1rem;
                    `}
                >
                    {children}
                </main>
            ),
        }),
    ),
    vValidator(
        "query",
        v.object({
            token: $RequestToken,
        }),
        (result, c) => {
            if (!result.success) {
                c.status(400)
                return c.render(
                    <ErrorAlert
                        title="Bad Request"
                        description={<span>トークンが指定されませんでした。</span>}
                    ></ErrorAlert>,
                )
            }
        },
    ),
    async (c) => {
        const authNRequestRecord = c.env.AuthNRequests
        const sessionRecord = c.env.Sessions
        const { rest } = c.var
        const sessionId = await (async () => {
            const requestToken = c.req.valid("query").token
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
            c.status(400)
            return c.render(
                <ErrorAlert
                    title="Bad Request"
                    description={<span>トークンが無効です。</span>}
                ></ErrorAlert>,
            )
        }
        const rawSession = await sessionRecord.get(sessionId, "json").catch(shouldBeError)
        const sessionParseResult = v.safeParse($Session, rawSession)
        if (!sessionParseResult.success) {
            c.status(400)
            return c.render(
                <ErrorAlert
                    title="Bad Request"
                    description={<span>セッションが無効です。</span>}
                ></ErrorAlert>,
            )
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
