import type { WebhooksAPI } from "@discordjs/core/http-only"
import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { decode } from "decode-formdata"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { hc } from "hono/client"
import { getCookie, setCookie } from "hono/cookie"
import * as v from "valibot"

import { callback } from "./callback"
import { appSteps } from "./steps"

import type { AppType } from "@/app"
import { App } from "@/components/App"
import { ErrorAlert } from "@/components/ErrorAlert"
import { ProfileForm } from "@/components/islands/profile-form/server"
import { createLayout } from "@/components/layout"
import { type ErrorContext, reportErrorWithContext } from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $RequestToken, $Session, type AuthNRequestRecord } from "@/lib/schema/kvNamespaces"
import { $NadaAcWorkSpacePartialUser } from "@/lib/schema/nadaAc"
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
            const sessionId = await (async () => {
                const requestToken = c.req.valid("query").token
                const kvSessionIdKey =
                    `requestToken:${requestToken}` satisfies keyof AuthNRequestRecord
                const kvSessionId = await authNRequestRecord.get(kvSessionIdKey)
                if (kvSessionId) {
                    await authNRequestRecord.delete(kvSessionIdKey)
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
            return c.render(<ProfileForm />)
        },
    )
    .post(
        "/",
        vValidator(
            "cookie",
            v.object({
                sid: v.string(),
            }),
            (result, c) => {
                if (!result.success) {
                    return c.render(
                        <ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>,
                    )
                }
            },
        ),
        async (c) => {
            const formDataParseResult = v.safeParse(
                $NadaAcWorkSpacePartialUser,
                decode(await c.req.formData(), {
                    numbers: ["type", "profile.cohort", "profile.class", "profile.number"],
                }),
            )
            if (!formDataParseResult.success) {
                c.status(400)
                return c.render(
                    <>
                        <ErrorAlert title="Bad Request">
                            フォームの入力内容が正しくありません。
                        </ErrorAlert>
                        <ProfileForm />
                    </>,
                )
            }
            const userProfile = formDataParseResult.output
            const sessionRecord = c.env.Sessions
            const sessionId = c.req.valid("cookie").sid
            const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
            const sessionParseResult = v.safeParse($Session, rawSession)
            if (!sessionParseResult.success) {
                c.status(400)
                return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
            }
            const session = sessionParseResult.output
            if (session.state || session.nonce) {
                c.status(400)
                return c.render(<ErrorAlert title="Bad Request">セッションが不正です。</ErrorAlert>)
            }
            const honoClient = hc<AppType>(c.env.ORIGIN)
            const redirectUri = honoClient.oauth.signin.callback.$url()
            const state = generateSecret(64)
            const nonce = generateSecret(64)
            const oAuth2Client = new OAuth2Client()
            const authUrl = oAuth2Client.generateAuthUrl({
                response_type: "code",
                client_id: c.env.GOOGLE_OAUTH_CLIENT_ID,
                redirect_uri: redirectUri.href,
                scope: "openid email profile",
                state,
                nonce,
            })
            Object.assign(session, { state, nonce, userProfile })
            await sessionRecord.put(sessionId, JSON.stringify(session))
            const errorContext = {
                guildId: session.guildId,
                user: session.user,
            } as const satisfies ErrorContext
            const originalInteractions = [
                c.env.DISCORD_APPLICATION_ID,
                session.interactionToken,
                "@original",
            ] satisfies Parameters<WebhooksAPI["getMessage"]>
            const originalResponse = await c.var.discord.webhooks
                .getMessage(...originalInteractions)
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    return null
                })
            if (originalResponse?.components?.length) {
                await c.var.discord.webhooks
                    .editMessage(...originalInteractions, {
                        content: ":tickets: リンクが使用されました。",
                        components: [],
                    })
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    })
            }
            return c.redirect(authUrl)
        },
    )
    .route("/callback", callback)

/**
 * @package
 */
export { app as signin }
