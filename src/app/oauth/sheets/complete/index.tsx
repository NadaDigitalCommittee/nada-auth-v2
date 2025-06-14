import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { Link } from "@mui/material"
import { OAuth2Client } from "google-auth-library"
import { drive_v3 } from "googleapis/build/src/apis/drive/v3"
import { sheets_v4 } from "googleapis/build/src/apis/sheets/v4"
import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import { HTTPException } from "hono/http-exception"
import * as v from "valibot"

import { appSteps } from "../steps"

import { App } from "@/components/App"
import { NotchedOutline } from "@/components/NotchedOutline"
import { SuccessAlert } from "@/components/SuccessAlert"
import { createLayout } from "@/components/layout"
import { guildConfigInit } from "@/lib/discord/constants"
import { getDiscordAPIErrorMessage } from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $GuildConfig, $SessionId, $SheetsOAuthSession } from "@/lib/schema/kvNamespaces"
import type { AppPropertiesV1 } from "@/lib/schema/spreadsheet"
import { orNull } from "@/lib/utils/exceptions"
import { id } from "@/lib/utils/fp"
import { spreadsheetInit } from "@/lib/utils/spreadsheet"

const STEP = 3

const app = new Hono<Env>().post(
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
    vValidator(
        "form",
        v.object({
            folderId: v.string(),
        }),
        (result) => {
            if (!result.success) {
                throw new HTTPException(400, {
                    message: "フォームの入力内容が正しくありません。",
                })
            }
        },
    ),
    vValidator(
        "cookie",
        v.object({
            sid: $SessionId,
        }),
        (result) => {
            if (!result.success) {
                throw new HTTPException(400, { message: "セッションが無効です。" })
            }
        },
    ),

    async (c) => {
        const sessionRecord = c.env.Sessions
        const guildConfigRecord = c.env.GuildConfigs
        const { folderId } = c.req.valid("form")
        const sessionId = c.req.valid("cookie").sid
        const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
        c.executionCtx.waitUntil(sessionRecord.delete(sessionId))
        const sessionParseResult = v.safeParse($SheetsOAuthSession, rawSession)
        if (!sessionParseResult.success) {
            deleteCookie(c, "sid")
            throw new HTTPException(400, { message: "セッションが無効です。" })
        }
        const session = sessionParseResult.output
        const rawGuildConfig = await guildConfigRecord.get(session.guildId, "json").catch(id)
        const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
        if (!guildConfigParseResult.success) {
            throw new HTTPException(500, { message: "サーバーの設定データが破損しています。" })
        }
        const guildConfig = guildConfigParseResult.output
        if (!guildConfig._sheet) {
            throw new HTTPException(400, { message: "セッションが不正です。" })
        }
        const guildPreview = await c.var.discord.guilds
            .getPreview(session.guildId)
            .catch((e: unknown) => {
                throw new HTTPException(500, {
                    message: `スプレッドシートを指定されたフォルダに作成することができませんでした。\n${getDiscordAPIErrorMessage(e)}`,
                    cause: e,
                })
            })

        const oAuth2Client = new OAuth2Client({
            credentials: {
                access_token: session.accessToken,
            },
        })
        const drive = new drive_v3.Drive({ auth: oAuth2Client })
        const sheets = new sheets_v4.Sheets({ auth: oAuth2Client })

        const spreadsheetName = `認証システム管理シート（${guildPreview.name}）`
        const spreadsheetCreateResponse = await drive.files
            .create({
                requestBody: {
                    name: spreadsheetName,
                    mimeType: "application/vnd.google-apps.spreadsheet",
                    parents: [folderId],
                    appProperties: {
                        version: "1",
                    } satisfies AppPropertiesV1,
                },
                fields: "id",
                supportsAllDrives: true,
            })
            .catch((e: unknown) => {
                throw new HTTPException(500, {
                    message:
                        "スプレッドシートを指定されたフォルダに作成することができませんでした。",
                    cause: e,
                })
            })
        const spreadsheetId = spreadsheetCreateResponse.data.id
        if (!spreadsheetId) {
            throw new HTTPException(500, {
                message: "作成したスプレッドシートの情報を取得することができませんでした。",
            })
        }

        c.executionCtx.waitUntil(
            sheets.spreadsheets
                .batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: spreadsheetInit,
                    },
                })
                .catch((e: unknown) => {
                    throw new HTTPException(500, {
                        message: "作成したスプレッドシートに書き込むことができませんでした。",
                        cause: e,
                    })
                }),
        )
        guildConfig._sheet.spreadsheetId = spreadsheetId
        c.executionCtx.waitUntil(
            guildConfigRecord.put(session.guildId, JSON.stringify(guildConfig)),
        )
        return c.render(
            <>
                <SuccessAlert>スプレッドシートが作成され、初期化されました。</SuccessAlert>
                <NotchedOutline label="作成されたスプレッドシート">
                    <Link
                        href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                        underline="hover"
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        {spreadsheetName}
                    </Link>
                </NotchedOutline>
            </>,
        )
    },
)

export { app as complete }
