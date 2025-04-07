import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { type RESTPatchAPIWebhookWithTokenMessageJSONBody, Routes } from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { hc } from "hono/client"
import { deleteCookie } from "hono/cookie"
import * as v from "valibot"

import { appSteps } from "../steps"

import type { AppType } from "@/app"
import { App } from "@/components/App"
import { ErrorAlert } from "@/components/ErrorAlert"
import { DrivePicker } from "@/components/islands/drive-picker/server"
import { createLayout } from "@/components/layout"
import { guildConfigInit } from "@/lib/discord/constants"
import { type ErrorContext, reportErrorWithContext } from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $GuildConfig, $SessionId, $SheetsOAuthSession } from "@/lib/schema/kvNamespaces"
import { oAuthCallbackQueryParams } from "@/lib/schema/oauth"
import { orNull } from "@/lib/utils/exceptions"
import { id } from "@/lib/utils/fp"

const STEP = 2

const app = new Hono<Env>().get(
    "/",
    reactRenderer(({ children }) =>
        createLayout({ head: <title>{appSteps[STEP].nameVerbose}</title> })({
            children: (
                <App appSteps={appSteps} activeStep={STEP}>
                    {children}
                </App>
            ),
        }),
    ),
    vValidator("query", oAuthCallbackQueryParams, (result, c) => {
        if (!result.success) {
            c.status(400)
            return c.render(<ErrorAlert title="Bad Request">無効なリクエストです。</ErrorAlert>)
        }
    }),
    vValidator(
        "cookie",
        v.object({
            sid: $SessionId,
        }),
        (result, c) => {
            if (!result.success) {
                c.status(400)
                return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
            }
        },
    ),
    async (c) => {
        const sessionRecord = c.env.Sessions
        const guildConfigRecord = c.env.GuildConfigs
        const { rest } = c.var
        const OAUTH_FAILED_MESSAGE = `:x: 認証に失敗しました。`
        const sessionId = c.req.valid("cookie").sid
        const query = c.req.valid("query")
        const { state } = query
        const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
        const sessionParseResult = v.safeParse($SheetsOAuthSession, rawSession)
        if (!sessionParseResult.success) {
            c.status(400)
            deleteCookie(c, "sid")
            return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
        }
        const session = sessionParseResult.output
        if (state !== session.state) {
            c.status(401)
            return c.render(<ErrorAlert title="Unauthorized">無効なリクエストです。</ErrorAlert>)
        }

        const errorContext = {
            guildId: session.guildId,
        } as const satisfies ErrorContext
        const originalInteractionResRoute = Routes.webhookMessage(
            c.env.DISCORD_APPLICATION_ID,
            session.interactionToken,
            "@original",
        )
        const editOriginal = async (
            body: RESTPatchAPIWebhookWithTokenMessageJSONBody,
        ): Promise<void> =>
            void (await rest
                .patch(originalInteractionResRoute, { body })
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                }))
        const rawGuildConfig = await guildConfigRecord.get(session.guildId, "json").catch(id)
        const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
        if (!guildConfigParseResult.success) {
            await editOriginal({
                content: ":x: サーバーの設定データが破損しています。",
                components: [],
            })
            c.status(500)
            return c.render(
                <ErrorAlert title="Internal Server Error">
                    サーバーの設定データが破損しています。
                </ErrorAlert>,
            )
        }
        const guildConfig = guildConfigParseResult.output
        if (query.error !== undefined) {
            await editOriginal({
                content: OAUTH_FAILED_MESSAGE,
                components: [],
            })
            c.status(400)
            return c.render(<ErrorAlert title="Bad Request">{query.error}</ErrorAlert>)
        }
        const honoClient = hc<AppType>(c.env.ORIGIN)
        const redirectUri = honoClient.oauth.sheets.callback.$url()
        const oAuth2Client = new OAuth2Client({
            clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
            redirectUri: redirectUri.href,
        })
        const getTokenResponse = await oAuth2Client.getToken(query.code).catch(orNull)
        if (!getTokenResponse) {
            c.status(400)
            return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
        }
        const { tokens } = getTokenResponse
        if (!(tokens.access_token && tokens.expiry_date && tokens.refresh_token)) {
            await editOriginal({
                content: OAUTH_FAILED_MESSAGE,
                components: [],
            })
            c.status(401)
            return c.render(
                <ErrorAlert title="Unauthorized">資格情報が不足しています。</ErrorAlert>,
            )
        }
        guildConfig._sheet = Object.assign(guildConfig._sheet ?? {}, {
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            accessTokenExpiry: tokens.expiry_date,
        })
        await guildConfigRecord.put(session.guildId, JSON.stringify(guildConfig))
        session.accessToken = tokens.access_token
        await sessionRecord.put(sessionId, JSON.stringify(session))
        return c.render(
            <DrivePicker
                formAction="./complete"
                accessToken={session.accessToken}
                apiKey={c.env.GOOGLE_PICKER_API_KEY}
                appId={c.env.GOOGLE_CLOUD_PROJECT_NUMBER}
            />,
        )
    },
)

export { app as callback }
