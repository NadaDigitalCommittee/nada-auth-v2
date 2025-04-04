import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { decode } from "decode-formdata"
import {
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageResult,
    Routes,
} from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { hc } from "hono/client"
import { getCookie, setCookie } from "hono/cookie"
import * as v from "valibot"

import { callback } from "./callback"

import type { AppType } from "@/app"
import { App, type AppStep } from "@/components/App"
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

const appSteps = [
    {
        name: "情報入力",
        nameVerbose: "プロフィール情報を入力",
    },
    {
        name: "サインイン",
        nameVerbose: "Google でサインイン",
    },
    {
        name: "アクセス許可",
        nameVerbose: "アクセス許可",
    },
    {
        name: "完了",
        nameVerbose: "完了",
    },
] as const satisfies AppStep[]

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
            const { rest } = c.var
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
            return c.redirect(authUrl)
        },
    )
    .route("/callback", callback)

/**
 * @package
 */
export { app as signin }
