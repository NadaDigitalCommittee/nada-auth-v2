import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import { Link } from "@mui/material"
import { type RESTGetAPIGuildPreviewResult, Routes } from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { drive_v3 } from "googleapis/build/src/apis/drive/v3"
import { sheets_v4 } from "googleapis/build/src/apis/sheets/v4"
import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import * as v from "valibot"

import { appSteps } from "../steps"

import { App } from "@/components/App"
import { ErrorAlert } from "@/components/ErrorAlert"
import { NotchedOutline } from "@/components/NotchedOutline"
import { SuccessAlert } from "@/components/SuccessAlert"
import { createLayout } from "@/components/layout"
import { guildConfigInit } from "@/lib/discord/constants"
import { type ErrorContext, reportErrorWithContext } from "@/lib/discord/utils"
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
        (result, c) => {
            if (!result.success) {
                return c.render(<ErrorAlert>フォームの入力内容が正しくありません。</ErrorAlert>)
            }
        },
    ),
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
        const { folderId } = c.req.valid("form")
        const sessionId = c.req.valid("cookie").sid
        const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
        await sessionRecord.delete(sessionId)
        const sessionParseResult = v.safeParse($SheetsOAuthSession, rawSession)
        if (!sessionParseResult.success) {
            c.status(400)
            deleteCookie(c, "sid")
            return c.render(<ErrorAlert title="Bad Request">セッションが無効です。</ErrorAlert>)
        }
        const session = sessionParseResult.output
        const rawGuildConfig = await guildConfigRecord.get(session.guildId, "json").catch(id)
        const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
        if (!guildConfigParseResult.success) {
            c.status(500)
            return c.render(
                <ErrorAlert title="Internal Server Error">
                    サーバーの設定データが破損しています。
                </ErrorAlert>,
            )
        }
        const guildConfig = guildConfigParseResult.output
        if (!guildConfig._sheet) {
            c.status(400)
            return c.render(
                <ErrorAlert title="Internal Server Error">セッションが不正です。</ErrorAlert>,
            )
        }
        const errorContext = {
            guildId: session.guildId,
        } as const satisfies ErrorContext

        const guildPreview = (await c.var.rest
            .get(Routes.guildPreview(session.guildId))
            .catch(id)) as RESTGetAPIGuildPreviewResult | Error

        if (guildPreview instanceof Error) {
            c.status(500)
            await reportErrorWithContext(guildPreview, errorContext, c.env)
            return c.render(
                <ErrorAlert title="Internal Server Error">
                    スプレッドシートを指定されたフォルダに作成することができませんでした。
                    {guildPreview.message}
                </ErrorAlert>,
            )
        }
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
            .catch(id<unknown, Error>)

        if (spreadsheetCreateResponse instanceof Error) {
            c.status(500)
            await reportErrorWithContext(spreadsheetCreateResponse, errorContext, c.env)
            return c.render(
                <ErrorAlert title="Internal Server Error">
                    スプレッドシートを指定されたフォルダに作成することができませんでした。
                    {spreadsheetCreateResponse.message}
                </ErrorAlert>,
            )
        }
        const spreadsheetId = spreadsheetCreateResponse.data.id
        if (!spreadsheetId) {
            c.status(500)
            await reportErrorWithContext(
                new Error("Could not get the ID of the created file."),
                errorContext,
                c.env,
            )
            return c.render(
                <ErrorAlert title="Internal Server Error">
                    作成したスプレッドシートの情報を取得することができませんでした。
                </ErrorAlert>,
            )
        }

        const sheetUpdateResponse = await sheets.spreadsheets
            .batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: spreadsheetInit,
                },
            })
            .catch(id<unknown, Error>)
        if (sheetUpdateResponse instanceof Error) {
            c.status(500)
            await reportErrorWithContext(sheetUpdateResponse, errorContext, c.env)
            return c.render(
                <ErrorAlert title="Internal Server Error">
                    作成したスプレッドシートに書き込むことができませんでした。
                </ErrorAlert>,
            )
        }
        guildConfig._sheet.spreadsheetId = spreadsheetId
        await guildConfigRecord.put(session.guildId, JSON.stringify(guildConfig))
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
