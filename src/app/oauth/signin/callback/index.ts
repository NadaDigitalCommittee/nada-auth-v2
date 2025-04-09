import { vValidator } from "@hono/valibot-validator"
import {
    type RESTPatchAPIGuildMemberJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    Routes,
    type Snowflake,
} from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { google } from "googleapis"
import { type Context, Hono } from "hono"
import { hc } from "hono/client"
import { deleteCookie } from "hono/cookie"
import * as v from "valibot"

import type { AppType } from "@/app"
import { guildConfigInit } from "@/lib/discord/constants"
import {
    type ErrorContext,
    Logger,
    getDiscordAPIErrorMessage,
    reportErrorWithContext,
} from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import {
    $GuildConfig,
    $Session,
    $SessionId,
    type GuildConfig,
    type Session,
} from "@/lib/schema/kvNamespaces"
import { oAuthCallbackQueryParams } from "@/lib/schema/oauth"
import { $Rule, type Rule, roleTransformAction } from "@/lib/schema/spreadsheet"
import { $TokenPayload } from "@/lib/schema/tokenPayload"
import { generateSchema } from "@/lib/schema/utils"
import { type NadaAcWorkSpaceUser, NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { orNull } from "@/lib/utils/exceptions"
import { formatNickname } from "@/lib/utils/formatNickname"
import { id } from "@/lib/utils/fp"
import { extractNadaACWorkSpaceUserFromTokenPayload } from "@/lib/utils/nadaAc"
import {
    sheetId as targetSheetId,
    valuesRangeA1,
    zeroBasedRangeToA1Notation,
} from "@/lib/utils/spreadsheet"

const processSpreadsheet = async ({
    context: c,
    guildConfig,
    session,
    workspaceUser,
    logger,
}: {
    context: Context<Env>
    guildConfig: GuildConfig
    session: Session
    workspaceUser: NadaAcWorkSpaceUser
    logger: Logger
}) => {
    if (!guildConfig._sheet?.spreadsheetId) return
    const oAuth2Client = new google.auth.OAuth2({
        clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
        credentials: {
            access_token: guildConfig._sheet.accessToken,
            refresh_token: guildConfig._sheet.refreshToken,
        },
    })
    if (guildConfig._sheet.accessTokenExpiry <= Date.now()) {
        const { credentials } = await oAuth2Client.refreshAccessToken()
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        guildConfig._sheet.accessToken = credentials.access_token!
        guildConfig._sheet.accessTokenExpiry = credentials.expiry_date!
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        await c.env.GuildConfigs.put(session.guildId, JSON.stringify(guildConfig))
    }
    const sheets = google.sheets({ version: "v4", auth: oAuth2Client })
    const spreadsheetMeta = await sheets.spreadsheets
        .get({
            spreadsheetId: guildConfig._sheet.spreadsheetId,
            includeGridData: false,
        })
        .catch(id<unknown, Error>)
    if (spreadsheetMeta instanceof Error) {
        await logger.error({
            title: "Failed to retrieve spreadsheet content",
            fields: [
                {
                    name: "Reason",
                    value: spreadsheetMeta.message,
                },
            ],
        })
        return
    }
    const sheetName = spreadsheetMeta.data.sheets?.find(
        (s) => s.properties?.sheetId === targetSheetId,
    )?.properties?.title
    if (!sheetName) {
        await logger.error({
            title: "Failed to retrieve spreadsheet content",
            fields: [
                {
                    name: "Reason",
                    value: `Could not find sheet with ID ${targetSheetId}.`,
                },
            ],
        })
        return
    }
    const spreadsheetValuesGetResponse = await sheets.spreadsheets.values
        .get({
            spreadsheetId: guildConfig._sheet.spreadsheetId,
            range: `${sheetName}!${valuesRangeA1}`,
            majorDimension: "ROWS",
        })
        .catch(id<unknown, Error>)
    if (spreadsheetValuesGetResponse instanceof Error) {
        await logger.error({
            title: "Failed to retrieve spreadsheet content",
            fields: [
                {
                    name: "Reason",
                    value: spreadsheetValuesGetResponse.message,
                },
            ],
        })
        return
    }
    const sheetValues = spreadsheetValuesGetResponse.data.values
    if (!sheetValues || !sheetValues.length) return
    const $NullableRule = v.nullable($Rule)
    const failedRuleIssueStack: v.InferIssue<typeof $NullableRule>[] = []
    const sheetValuesParseResult = v.safeParse(
        v.array(
            v.fallback($NullableRule, (output) => {
                const issue = output?.issues?.[0]
                if (issue) failedRuleIssueStack.push(issue)
                return null
            }),
        ),
        sheetValues,
    )
    if (!sheetValuesParseResult.success) {
        await logger.error({
            title: "Failed to parse spreadsheet contents",
            fields: [
                {
                    name: "Details",
                    value: `\`\`\`\n${sheetValuesParseResult.issues.map((issue) => issue.message).join("\n")}\`\`\``,
                },
            ],
        })
        return
    }
    type RuleSyntaxError = [rowIndex: number, message: string]
    const ruleSyntaxErrors: RuleSyntaxError[] = []
    const matchedRules = sheetValuesParseResult.output.reduce<
        Array<Omit<Rule, "schema"> & { rowIndex: number }>
    >((acc, rule, rowIndex) => {
        if (rule) {
            const { schema, ...rest } = rule
            if (v.safeParse(schema, workspaceUser).success)
                acc.push(Object.assign(rest, { rowIndex }))
        } else {
            const issue = failedRuleIssueStack.shift()
            if (!issue) return acc
            // 失敗しうるのはv.array($NadaAcWorkSpaceUserType)とv.array($CombinedGrade)
            const [{ key: colIndex }, { key: indexInCell }] = issue.path as [
                v.ArrayPathItem,
                v.ArrayPathItem,
            ]
            const errorStack = `  at ${zeroBasedRangeToA1Notation(colIndex, rowIndex + 1 /* ヘッダー1行分 */)} (item ${indexInCell})`
            ruleSyntaxErrors.push([rowIndex, `${issue.message}\n${errorStack}\n`])
        }
        return acc
    }, [])
    if (ruleSyntaxErrors.length) {
        const [rowIndices, messages] = ruleSyntaxErrors.reduce<[number[], string[]]>(
            (acc, cur) => {
                acc[0].push(cur[0])
                acc[1].push(cur[1])
                return acc
            },
            [[], []],
        )
        await logger.error({
            title: `Parsing matcher rules completed with errors. Skipping row(s): ${rowIndices.join(", ")}`,
            fields: [
                {
                    name: "Details",
                    value: `\`\`\`\n${messages.join("\n")}\`\`\``,
                },
            ],
        })
    }
    const nicknameFormat = matchedRules
        .values()
        .map((rule) => rule.nickname)
        .find((value) => value !== null)
    if (nicknameFormat) {
        const nicknameFormatResult = formatNickname(nicknameFormat, workspaceUser)
        if (nicknameFormatResult.warnings.length) {
            await logger.warn({
                title: "Formatting nickname completed with warnings",
                fields: [
                    {
                        name: "Details",
                        value: `\`\`\`\n${nicknameFormatResult.warnings
                            .map((w) => w.stack)
                            .join("\n\n")}\`\`\``,
                    },
                ],
            })
        }
        await c.var.rest
            .patch(Routes.guildMember(session.guildId, session.user.id), {
                body: {
                    nick: nicknameFormatResult.formatted,
                } satisfies RESTPatchAPIGuildMemberJSONBody,
            })
            .catch(async (e: unknown) => {
                await logger.error({
                    title: "Failed to modify nickname",
                    fields: [
                        {
                            name: "Reason",
                            value: getDiscordAPIErrorMessage(e),
                        },
                    ],
                })
            })
    }
    const roleOperationMap = new Map<Snowflake, number>()
    const roleSyntaxErrors: RuleSyntaxError[] = []
    matchedRules.forEach((rule) => {
        const rolesParseResult = v.safeParse(v.pipe(v.string(), roleTransformAction), rule.roles)
        if (!rolesParseResult.success) {
            const [issue] = rolesParseResult.issues
            const colIndex = 7 // ロールのcolIndexは7
            const [{ key: indexInCell }] = issue.path as [v.ArrayPathItem]
            const errorStack = `  at ${zeroBasedRangeToA1Notation(colIndex, rule.rowIndex + 1 /* ヘッダー1行分 */)} (item ${indexInCell})`
            roleSyntaxErrors.push([rule.rowIndex, `${issue.message}\n${errorStack}\n`])
            return
        }
        rolesParseResult.output.forEach(([roleId, op]) => {
            roleOperationMap.set(roleId, op + (roleOperationMap.get(roleId) ?? 0))
        })
    })
    if (roleSyntaxErrors.length) {
        const [rowIndices, messages] = roleSyntaxErrors.reduce<[number[], string[]]>(
            (acc, cur) => {
                acc[0].push(cur[0])
                acc[1].push(cur[1])
                return acc
            },
            [[], []],
        )
        await logger.error({
            title: `Parsing roles completed with errors. Skipping row(s): ${rowIndices.join(", ")}`,
            fields: [
                {
                    name: "Details",
                    value: `\`\`\`\n${messages.join("\n")}\`\`\``,
                },
            ],
        })
    }
    const userRoles = new Set(session.roles)
    // https://github.com/microsoft/TypeScript/issues/9998
    let rolesHaveChanges = false as boolean
    roleOperationMap.entries().forEach(([roleId, count]) => {
        if (count > 0) {
            userRoles.add(roleId)
        } else if (count < 0) {
            userRoles.delete(roleId)
        } else return
        rolesHaveChanges = true
    })
    if (!rolesHaveChanges) return
    await c.var.rest
        .patch(Routes.guildMember(session.guildId, session.user.id), {
            body: {
                roles: [...userRoles],
            } satisfies RESTPatchAPIGuildMemberJSONBody,
        })
        .catch(async (e: unknown) => {
            await logger.error({
                title: "Failed to modify roles",
                fields: [
                    {
                        name: "Reason",
                        value: getDiscordAPIErrorMessage(e),
                    },
                ],
            })
        })
}

const app = new Hono<Env>().get(
    "/",
    vValidator("query", oAuthCallbackQueryParams),
    vValidator(
        "cookie",
        v.object({
            sid: $SessionId,
        }),
    ),
    async (c) => {
        const sessionRecord = c.env.Sessions
        const guildConfigRecord = c.env.GuildConfigs
        const { rest } = c.var
        const AUTHN_FAILED_MESSAGE = `:x: 認証に失敗しました。以下の点を確認し、再試行してください。
* 学校から配付された Google アカウントでログインしていること。
* メールアドレスとプロフィール情報へのアクセスを許可していること。
* 正しいプロフィール情報を入力したこと。`
        const sessionId = c.req.valid("cookie").sid
        deleteCookie(c, "sid")
        const query = c.req.valid("query")
        const { state } = query
        const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
        await sessionRecord.delete(sessionId)
        const sessionParseResult = v.safeParse($Session, rawSession)
        if (!sessionParseResult.success) return c.text("Session Expired", 401)
        const session = sessionParseResult.output
        if (!(session.state && session.nonce)) return c.text("Unauthorized", 401)
        if (state !== session.state) return c.text("Unauthorized", 401)

        const errorContext = {
            guildId: session.guildId,
            user: session.user,
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
                content: ":x: 認証に失敗しました。理由: 内部エラー",
                components: [],
            })
            return c.text("Internal Server Error", 500)
        }
        const guildConfig = guildConfigParseResult.output
        if (query.error !== undefined) {
            await editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            return c.text(query.error, 400)
        }
        const honoClient = hc<AppType>(c.env.ORIGIN)
        const redirectUri = honoClient.oauth.signin.callback.$url()
        const oAuth2client = new OAuth2Client({
            clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
            redirectUri: redirectUri.href,
        })
        const { code } = query
        const { tokens } = await oAuth2client.getToken(code)
        if (!(tokens.id_token && tokens.access_token)) {
            await editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            return c.text("Missing or Insufficient Tokens", 401)
        }
        const loginTicket = await oAuth2client.verifyIdToken({
            idToken: tokens.id_token,
            audience: c.env.GOOGLE_OAUTH_CLIENT_ID,
        })
        const rawTokenPayload = loginTicket.getPayload()
        const tokenPayloadParseResult = v.safeParse(
            v.required($TokenPayload, ["email", "hd", "given_name", "family_name"]),
            rawTokenPayload,
        )
        if (!tokenPayloadParseResult.success) {
            await editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            return c.text("Insufficient Identification Information", 401)
        }
        const tokenPayload = tokenPayloadParseResult.output
        if (tokenPayload.nonce !== session.nonce) {
            await editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            return c.text("Unauthorized", 401)
        }
        const logger = new Logger({
            context: c,
            webhook: guildConfig._loggingWebhook,
            author: session.user,
            timestampInSeconds: tokenPayload.iat,
        })
        if (!c.env.ALLOWED_EMAIL_DOMAINS.includes(tokenPayload.hd)) {
            await editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            await logger
                .error({
                    title: "Failed authentication",
                    fields: [
                        {
                            name: "Reason",
                            value: "Email domain not allowed",
                        },
                    ],
                })
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                })
            return c.text("Forbidden", 403)
        }
        const nadaACWorkSpaceUser = extractNadaACWorkSpaceUserFromTokenPayload(tokenPayload)
        const userProfileValidationResult =
            session.userProfile &&
            v.safeParse(generateSchema(session.userProfile), nadaACWorkSpaceUser)
        if (userProfileValidationResult?.success !== true) {
            const logMessage = `\`\`\`${
                userProfileValidationResult?.issues
                    .map(
                        (issue) =>
                            `${issue.message} (path: ${issue.path?.map((path) => String(path.key)).join(" > ") || "<none>"})`,
                    )
                    .join("\n") ?? "User bypassed the profile entry process."
            }\`\`\``
            if (guildConfig.strictIntegrityCheck === true) {
                await editOriginal({
                    content: AUTHN_FAILED_MESSAGE,
                    components: [],
                })
                await logger
                    .error({
                        title: "Failed authentication",
                        fields: [
                            {
                                name: "Reason",
                                value: "Profile Information Mismatch",
                            },
                            {
                                name: "Details",
                                value: logMessage,
                            },
                        ],
                    })
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    })
                return c.text("Forbidden", 403)
            } else {
                await logger
                    .warn({
                        title: "Warnings while authentication",
                        fields: [
                            {
                                name: "Details",
                                value: logMessage,
                            },
                        ],
                    })
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    })
            }
        }
        await processSpreadsheet({
            context: c,
            guildConfig,
            session,
            workspaceUser: nadaACWorkSpaceUser,
            logger,
        })
        const embedFields = (() => {
            const { type: userType, profile: userProfile } = nadaACWorkSpaceUser
            const commonEmbedFields = [
                {
                    name: "名前",
                    value: `${userProfile.lastName} ${userProfile.firstName} (<@${session.user.id}>)`,
                },
                {
                    name: "メールアドレス",
                    value: userProfile.email,
                },
            ]
            switch (userType) {
                case NadaAcWorkSpaceUserType.Student: {
                    return [
                        {
                            name: "学年",
                            value: `${userProfile.studentType}${userProfile.grade} (${userProfile.cohort}回生)`,
                            inline: true,
                        },
                        {
                            name: "組",
                            value: `${userProfile.class}組`,
                            inline: true,
                        },
                        {
                            name: "出席番号",
                            value: `${userProfile.number}番`,
                            inline: true,
                        },
                        ...commonEmbedFields,
                    ]
                }
                case NadaAcWorkSpaceUserType.Others:
                    return commonEmbedFields
            }
        })()
        await logger
            .info({
                fields: embedFields,
            })
            .catch(async (e: unknown) => {
                if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
            })

        await editOriginal({
            content: ":white_check_mark: 認証が完了しました。",
            components: [],
        })
        return c.text("Success")
    },
)

/**
 * @package
 */
export { app as callback }
