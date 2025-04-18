import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { hc } from "hono/client"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import * as v from "valibot"

import { callback } from "./callback"
import { complete } from "./complete"
import { appSteps } from "./steps"

import type { AppType } from "@/app"
import { App } from "@/components/App"
import { ErrorAlert } from "@/components/ErrorAlert"
import { createLayout } from "@/components/layout"
import type { Env } from "@/lib/schema/env"
import { $RequestToken, $SheetsOAuthSession, type AuthNRequest } from "@/lib/schema/kvNamespaces"
import { sharedCookieOption } from "@/lib/utils/cookie"
import { orNull } from "@/lib/utils/exceptions"
import { generateSecret } from "@/lib/utils/secret"

const STEP = 0

const app = new Hono<Env>()
    .use(
        reactRenderer(({ children }) =>
            createLayout({ head: <title>{appSteps[STEP].nameVerbose}</title> })({
                children: (
                    <App appSteps={appSteps} activeStep={STEP}>
                        {children}
                    </App>
                ),
            }),
        ),
    )
    .get(
        "/",
        vValidator(
            "query",
            v.object({
                token: $RequestToken,
            }),
            (result, c) => {
                if (!result.success) {
                    c.status(400)
                    return c.render(
                        <ErrorAlert title="Bad Request">
                            トークンが指定されませんでした。
                        </ErrorAlert>,
                    )
                }
            },
        ),
        async (c) => {
            const authNRequestRecord = c.env.AuthNRequests
            const sessionRecord = c.env.Sessions
            const sessionId = await (async () => {
                const requestToken = c.req.valid("query").token
                const kvSessionIdKey = `requestToken:${requestToken}` satisfies AuthNRequest
                const kvSessionId = await authNRequestRecord.get(kvSessionIdKey)
                if (kvSessionId) {
                    c.executionCtx.waitUntil(authNRequestRecord.delete(kvSessionIdKey))
                    setCookie(c, "sid", kvSessionId, {
                        ...sharedCookieOption,
                        sameSite: "Lax",
                    })
                    return kvSessionId
                } else return getCookie(c, "sid")
            })()
            if (!sessionId) {
                c.status(400)
                return c.render(<ErrorAlert title="Bad Request">トークンが無効です。</ErrorAlert>)
            }
            const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
            const sessionParseResult = v.safeParse($SheetsOAuthSession, rawSession)
            if (!sessionParseResult.success) {
                c.status(400)
                deleteCookie(c, "sid")
                return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
            }
            const session = sessionParseResult.output
            if (session.state) {
                c.status(400)
                return c.render(<ErrorAlert title="Bad Request">セッションが不正です。</ErrorAlert>)
            }
            const honoClient = hc<AppType>(c.env.ORIGIN)
            const redirectUri = honoClient.oauth.sheets.callback.$url()
            const state = generateSecret(64)
            Object.assign(session, { state })
            c.executionCtx.waitUntil(sessionRecord.put(sessionId, JSON.stringify(session)))
            const oAuth2Client = new OAuth2Client()
            const authUrl = oAuth2Client.generateAuthUrl({
                response_type: "code",
                access_type: "offline",
                prompt: "consent",
                client_id: c.env.GOOGLE_OAUTH_CLIENT_ID,
                redirect_uri: redirectUri.href,
                scope: "https://www.googleapis.com/auth/drive.file",
                state,
            })
            c.executionCtx.waitUntil(
                c.var.discord.webhooks.editMessage(
                    c.env.DISCORD_APPLICATION_ID,
                    session.interactionToken,
                    "@original",
                    {
                        content: ":tickets: リンクが使用されました。",
                        components: [],
                    },
                ),
            )
            return c.redirect(authUrl)
        },
    )
    .route("/callback", callback)
    .route("/complete", complete)

export { app as sheets }
