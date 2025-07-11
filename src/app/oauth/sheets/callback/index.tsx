import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import type { RESTPatchAPIWebhookWithTokenMessageJSONBody } from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { hc } from "hono/client"
import { deleteCookie } from "hono/cookie"
import { HTTPException } from "hono/http-exception"
import * as v from "valibot"

import { appSteps } from "../steps"

import type { AppType } from "@/app"
import { App } from "@/components/App"
import { DrivePicker } from "@/components/islands/drive-picker/server"
import { createLayout } from "@/components/layout"
import { guildConfigInit } from "@/lib/discord/constants"
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
    vValidator("query", oAuthCallbackQueryParams, (result) => {
        if (!result.success) {
            throw new HTTPException(400, {
                message: "無効なリクエストです。",
            })
        }
    }),
    vValidator(
        "cookie",
        v.object({
            sid: $SessionId,
        }),
        (result) => {
            if (!result.success) {
                throw new HTTPException(400, {
                    message: "セッションが無効です。",
                })
            }
        },
    ),
    async (c) => {
        const sessionRecord = c.env.Sessions
        const guildConfigRecord = c.env.GuildConfigs
        const OAUTH_FAILED_MESSAGE = `:x: 認証に失敗しました。`
        const sessionId = c.req.valid("cookie").sid
        const query = c.req.valid("query")
        const { state } = query
        const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
        const sessionParseResult = v.safeParse($SheetsOAuthSession, rawSession)
        if (!sessionParseResult.success) {
            deleteCookie(c, "sid")
            throw new HTTPException(400, {
                message: "セッションが無効です。",
            })
        }
        const session = sessionParseResult.output
        if (state !== session.state) {
            throw new HTTPException(401, {
                message: "無効なリクエストです。",
            })
        }

        const editOriginal = (body: RESTPatchAPIWebhookWithTokenMessageJSONBody) => {
            c.executionCtx.waitUntil(
                c.var.discord.webhooks.editMessage(
                    c.env.DISCORD_APPLICATION_ID,
                    session.interactionToken,
                    "@original",
                    body,
                ),
            )
        }
        const rawGuildConfig = await guildConfigRecord.get(session.guildId, "json").catch(id)
        const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
        if (!guildConfigParseResult.success) {
            editOriginal({
                content: ":x: サーバーの設定データが破損しています。",
                components: [],
            })
            throw new HTTPException(500, {
                message: "サーバーの設定データが破損しています。",
            })
        }
        const guildConfig = guildConfigParseResult.output
        if (query.error !== undefined) {
            editOriginal({
                content: OAUTH_FAILED_MESSAGE,
                components: [],
            })
            throw new HTTPException(400, {
                message: query.error,
            })
        }
        const honoClient = hc<AppType>(c.env.ORIGIN)
        const redirectUri = honoClient.oauth.sheets.callback.$url()
        const oAuth2Client = new OAuth2Client({
            clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
            redirectUri: redirectUri.href,
        })
        const getTokenResponse = await oAuth2Client.getToken(query.code).catch(() => {
            throw new HTTPException(400, {
                message: "無効なリクエストです。",
            })
        })
        const { tokens } = getTokenResponse
        if (!(tokens.access_token && tokens.expiry_date && tokens.refresh_token)) {
            editOriginal({
                content: OAUTH_FAILED_MESSAGE,
                components: [],
            })
            throw new HTTPException(401, {
                message: "資格情報が不足しています。",
            })
        }
        guildConfig._sheet = Object.assign(guildConfig._sheet ?? {}, {
            refreshToken: tokens.refresh_token,
            accessToken: tokens.access_token,
            accessTokenExpiry: tokens.expiry_date,
        })
        session.accessToken = tokens.access_token
        c.executionCtx.waitUntil(
            Promise.all([
                guildConfigRecord.put(session.guildId, JSON.stringify(guildConfig)),
                sessionRecord.put(sessionId, JSON.stringify(session)),
            ]),
        )
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
