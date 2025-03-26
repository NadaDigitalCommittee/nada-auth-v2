import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { AlertTitle, css } from "@mui/material"
import Alert from "@mui/material/Alert"
import { decode } from "decode-formdata"
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
import { App } from "@/components/App"
import { appSteps } from "@/components/AppStepper"
import { ProfileForm } from "@/components/islands/profile-form/server"
import { createLayout } from "@/components/layout"
import { type ErrorContext, reportErrorWithContext } from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import {
    $RequestToken,
    $Session,
    type AuthNRequestRecord,
    type Session,
} from "@/lib/schema/kvNamespaces"
import { $NadaAcWorkSpacePartialUser } from "@/lib/schema/nadaAc"
import { sharedCookieNames, sharedCookieOption } from "@/lib/utils/cookie"
import { shouldBeError } from "@/lib/utils/exceptions"

const ErrorAlert = ({ title, children }: { title: ReactNode; children: ReactNode }) => (
    <Alert
        severity="error"
        css={css`
            width: 100%;
        `}
    >
        <AlertTitle>{title}</AlertTitle>
        {children}
    </Alert>
)

const STEP = 0

const app = new Hono<Env>()
    .use(
        reactRenderer(({ children }) =>
            createLayout({ head: <title>{appSteps[STEP].nameVerbose}</title> })({
                children: <App activeStep={STEP}>{children}</App>,
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
                    setCookie(c, sharedCookieNames.sessionId, kvSessionId, {
                        ...sharedCookieOption,
                        sameSite: "Lax",
                    })
                    return kvSessionId
                } else return getCookie(c, sharedCookieNames.sessionId)
            })()
            if (!sessionId) {
                c.status(400)
                return c.render(<ErrorAlert title="Bad Request">トークンが無効です。</ErrorAlert>)
            }
            return c.render(<ProfileForm />)
        },
    )
    .post("/", async (c) => {
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
        const sessionId = getCookie(c, sharedCookieNames.sessionId)
        if (!sessionId)
            return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
        const rawSession = await sessionRecord.get(sessionId, "json").catch(shouldBeError)
        const sessionParseResult = v.safeParse($Session, rawSession)
        if (!sessionParseResult.success) {
            c.status(400)
            return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
        }
        const session = sessionParseResult.output
        await sessionRecord.put(
            sessionId,
            JSON.stringify({ ...session, userProfile } satisfies Session),
        )
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
    })

/**
 * @package
 */
export { app as authn }
