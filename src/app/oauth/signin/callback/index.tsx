import { codeBlock, userMention } from "@discordjs/formatters"
import { reactRenderer } from "@hono/react-renderer"
import { vValidator } from "@hono/valibot-validator"
import type { RESTPatchAPIWebhookWithTokenMessageJSONBody, Snowflake } from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { sheets_v4 } from "googleapis/build/src/apis/sheets/v4"
import { Hono } from "hono"
import { hc } from "hono/client"
import { deleteCookie } from "hono/cookie"
import { HTTPException } from "hono/http-exception"
import * as v from "valibot"

import { appSteps } from "../steps"

import type { AppType } from "@/app"
import { App } from "@/components/App"
import { SuccessAlert } from "@/components/SuccessAlert"
import { createLayout } from "@/components/layout"
import { guildConfigInit } from "@/lib/discord/constants"
import {
    type ErrorContext,
    Logger,
    getDiscordAPIErrorMessage,
    reportErrorWithContext,
} from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $GuildConfig, $Session, $SessionId } from "@/lib/schema/kvNamespaces"
import { oAuthCallbackQueryParams } from "@/lib/schema/oauth"
import { $Rule, type Rule, roleTransformAction } from "@/lib/schema/spreadsheet"
import { $TokenPayload } from "@/lib/schema/tokenPayload"
import { generateSchema } from "@/lib/schema/utils"
import { NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { orNull } from "@/lib/utils/exceptions"
import { formatNickname } from "@/lib/utils/formatNickname"
import { id } from "@/lib/utils/fp"
import { extractNadaACWorkSpaceUserFromTokenPayload, mergeProfile } from "@/lib/utils/nadaAc"
import {
    sheetId as targetSheetId,
    valuesRangeA1,
    zeroBasedRangeToA1Notation,
} from "@/lib/utils/spreadsheet"

const STEP = 3

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
        const AUTHN_FAILED_MESSAGE = `:x: 認証に失敗しました。以下の点を確認し、再試行してください。
* 学校から配付された Google アカウントでログインしていること。
* メールアドレスとプロフィール情報へのアクセスを許可していること。
* 正しいプロフィール情報を入力したこと。`
        const sessionId = c.req.valid("cookie").sid
        deleteCookie(c, "sid")
        const query = c.req.valid("query")
        const { state } = query
        const rawSession = await sessionRecord.get(sessionId, "json").catch(orNull)
        c.executionCtx.waitUntil(sessionRecord.delete(sessionId))
        const sessionParseResult = v.safeParse($Session, rawSession)
        if (!sessionParseResult.success) {
            deleteCookie(c, "sid")
            throw new HTTPException(400, {
                message: "セッションが無効です。",
            })
        }
        const session = sessionParseResult.output
        if (!(session.state && session.nonce)) {
            throw new HTTPException(400, {
                message: "セッションが無効です。",
            })
        }
        if (state !== session.state) {
            throw new HTTPException(401, {
                message: "無効なリクエストです。",
            })
        }

        const errorContext = {
            guildId: session.guildId,
            user: session.user,
        } as const satisfies ErrorContext
        const editOriginal = (body: RESTPatchAPIWebhookWithTokenMessageJSONBody) => {
            c.executionCtx.waitUntil(
                c.var.discord.webhooks
                    .editMessage(
                        c.env.DISCORD_APPLICATION_ID,
                        session.interactionToken,
                        "@original",
                        body,
                    )
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    }),
            )
        }
        const rawGuildConfig = await guildConfigRecord.get(session.guildId, "json").catch(id)
        const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
        if (!guildConfigParseResult.success) {
            editOriginal({
                content: ":x: Discordサーバー側の問題により認証に失敗しました。",
                components: [],
            })
            throw new HTTPException(500, {
                message: "Discordサーバー側の問題により認証に失敗しました。",
            })
        }
        const guildConfig = guildConfigParseResult.output
        if (query.error !== undefined) {
            editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            throw new HTTPException(400, {
                message: query.error,
            })
        }
        const honoClient = hc<AppType>(c.env.ORIGIN)
        const redirectUri = honoClient.oauth.signin.callback.$url()
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
        if (!(tokens.id_token && tokens.access_token)) {
            editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            throw new HTTPException(401, {
                message: "資格情報が不足しています。",
            })
        }
        const loginTicket = await oAuth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: c.env.GOOGLE_OAUTH_CLIENT_ID,
        })
        const rawTokenPayload = loginTicket.getPayload()
        const tokenPayloadParseResult = v.safeParse(
            v.required($TokenPayload, ["email", "hd", "given_name", "family_name"]),
            rawTokenPayload,
        )
        if (!tokenPayloadParseResult.success) {
            editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            throw new HTTPException(401, {
                message: "学内のユーザーであることを確認できませんでした。",
            })
        }
        const tokenPayload = tokenPayloadParseResult.output
        if (tokenPayload.nonce !== session.nonce) {
            editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            throw new HTTPException(401, {
                message: "無効なリクエストです。",
            })
        }
        using logger = new Logger({
            context: c,
            webhook: guildConfig._loggingWebhook,
            author: session.user,
            timestampInSeconds: tokenPayload.iat,
        })
        if (!c.env.ALLOWED_EMAIL_DOMAINS.includes(tokenPayload.hd)) {
            editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            logger.error({
                title: "Failed authentication",
                fields: [
                    {
                        name: "Reason",
                        value: "Email domain not allowed",
                    },
                ],
            })
            throw new HTTPException(401, {
                message: "学内のユーザーであることを確認できませんでした。",
            })
        }
        const nadaACWorkSpaceUser = extractNadaACWorkSpaceUserFromTokenPayload(tokenPayload)
        const userProfileValidationResult =
            session.userProfile &&
            v.safeParse(generateSchema(session.userProfile), nadaACWorkSpaceUser)
        if (userProfileValidationResult?.success !== true) {
            const logMessage = codeBlock(
                userProfileValidationResult?.issues
                    .map((issue) => `${issue.message}\n  at ${v.getDotPath(issue) ?? "<none>"}`)
                    .join("\n\n") ?? "User bypassed the profile entry process.",
            )
            if (guildConfig.strictIntegrityCheck === true) {
                editOriginal({
                    content: AUTHN_FAILED_MESSAGE,
                    components: [],
                })
                logger.error({
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
                throw new HTTPException(401, {
                    message: "入力されたプロフィール情報とアカウント情報が一致しません。",
                })
            } else {
                logger.warn({
                    title: "Warnings while authentication",
                    fields: [
                        {
                            name: "Details",
                            value: logMessage,
                        },
                    ],
                })
                if (session.userProfile && guildConfig.profileFallback !== false)
                    mergeProfile(session.userProfile, nadaACWorkSpaceUser, tokenPayload.iat)
            }
        }
        await (async function processSpreadsheet() {
            if (!guildConfig._sheet?.spreadsheetId) return
            const oAuth2Client = new OAuth2Client({
                clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
                clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
                credentials: {
                    access_token: guildConfig._sheet.accessToken,
                    refresh_token: guildConfig._sheet.refreshToken,
                },
            })
            if (guildConfig._sheet.accessTokenExpiry <= Date.now()) {
                const accessTokenRefreshResponse = await oAuth2Client
                    .refreshAccessToken()
                    .catch(id<unknown, Error>)
                if (accessTokenRefreshResponse instanceof Error) {
                    logger.error({
                        title: "Failed to retrieve spreadsheet content",
                        fields: [
                            {
                                name: "Reason",
                                value: `Failed to refresh access token`,
                            },
                        ],
                    })
                    return
                }
                const { credentials } = accessTokenRefreshResponse
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                guildConfig._sheet.accessToken = credentials.access_token!
                guildConfig._sheet.accessTokenExpiry = credentials.expiry_date!
                /* eslint-enable @typescript-eslint/no-non-null-assertion */
                c.executionCtx.waitUntil(
                    c.env.GuildConfigs.put(session.guildId, JSON.stringify(guildConfig)),
                )
            }
            const sheets = new sheets_v4.Sheets({ auth: oAuth2Client })
            const spreadsheetMeta = await sheets.spreadsheets
                .get({
                    spreadsheetId: guildConfig._sheet.spreadsheetId,
                    includeGridData: false,
                })
                .catch(id<unknown, Error>)
            if (spreadsheetMeta instanceof Error) {
                logger.error({
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
                logger.error({
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
                logger.error({
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
                logger.error({
                    title: "Failed to parse spreadsheet contents",
                    fields: [
                        {
                            name: "Details",
                            value: codeBlock(
                                sheetValuesParseResult.issues
                                    .map((issue) => issue.message)
                                    .join("\n\n"),
                            ),
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
                    if (v.safeParse(schema, nadaACWorkSpaceUser).success)
                        acc.push(Object.assign(rest, { rowIndex }))
                } else {
                    const issue = failedRuleIssueStack.shift()
                    if (!issue) return acc
                    // 失敗しうるのはv.array($NadaAcWorkSpaceUserType)とv.array($Grade)
                    const [{ key: colIndex }, { key: indexInCell }] = issue.path as [
                        v.ArrayPathItem,
                        v.ArrayPathItem,
                    ]
                    const errorStack = `  at ${zeroBasedRangeToA1Notation(colIndex, rowIndex + 1 /* ヘッダー1行分 */)} (item ${indexInCell})`
                    ruleSyntaxErrors.push([rowIndex, `${issue.message}\n${errorStack}`])
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
                logger.error({
                    title: `Parsing matcher rules completed with errors. Skipping row(s): ${rowIndices.join(", ")}`,
                    fields: [
                        {
                            name: "Details",
                            value: codeBlock(messages.join("\n\n")),
                        },
                    ],
                })
            }
            const nicknameFormat = matchedRules
                .values()
                .map((rule) => rule.nickname)
                .find((value) => value !== null)
            if (nicknameFormat) {
                const nicknameFormatResult = formatNickname(nicknameFormat, nadaACWorkSpaceUser)
                if (nicknameFormatResult.warnings.length) {
                    logger.warn({
                        title: "Formatting nickname completed with warnings",
                        fields: [
                            {
                                name: "Details",
                                value: codeBlock(
                                    nicknameFormatResult.warnings.map((w) => w.stack).join("\n\n"),
                                ),
                            },
                        ],
                    })
                }
                c.executionCtx.waitUntil(
                    c.var.discord.guilds
                        .editMember(session.guildId, session.user.id, {
                            nick: nicknameFormatResult.formatted,
                        })
                        .catch((e: unknown) => {
                            logger.error({
                                title: "Failed to modify nickname",
                                fields: [
                                    {
                                        name: "Reason",
                                        value: getDiscordAPIErrorMessage(e),
                                    },
                                ],
                            })
                        }),
                )
            }
            const roleOperationMap = new Map<Snowflake, number>()
            const roleSyntaxErrors: RuleSyntaxError[] = []
            matchedRules.forEach((rule) => {
                const rolesParseResult = v.safeParse(
                    v.pipe(v.string(), roleTransformAction),
                    rule.roles,
                )
                if (!rolesParseResult.success) {
                    const [issue] = rolesParseResult.issues
                    const colIndex = 7 // ロールのcolIndexは7
                    const [{ key: indexInCell }] = issue.path as [v.ArrayPathItem]
                    const errorStack = `  at ${zeroBasedRangeToA1Notation(colIndex, rule.rowIndex + 1 /* ヘッダー1行分 */)} (item ${indexInCell})`
                    roleSyntaxErrors.push([rule.rowIndex, `${issue.message}\n${errorStack}`])
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
                logger.error({
                    title: `Parsing roles completed with errors. Skipping row(s): ${rowIndices.join(", ")}`,
                    fields: [
                        {
                            name: "Details",
                            value: codeBlock(messages.join("\n\n")),
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
            c.executionCtx.waitUntil(
                c.var.discord.guilds
                    .editMember(session.guildId, session.user.id, {
                        roles: [...userRoles],
                    })
                    .catch((e: unknown) => {
                        logger.error({
                            title: "Failed to modify roles",
                            fields: [
                                {
                                    name: "Reason",
                                    value: getDiscordAPIErrorMessage(e),
                                },
                            ],
                        })
                    }),
            )
        })()
        const embedFields = (() => {
            const { type: userType, profile: userProfile } = nadaACWorkSpaceUser
            const commonEmbedFields = [
                {
                    name: "名前",
                    value: `${userProfile.lastName} ${userProfile.firstName} (${userMention(session.user.id)})`,
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
                            value: `${userProfile.formattedGrade} (${userProfile.cohort}回生)`,
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
        logger.info({
            fields: embedFields,
        })

        editOriginal({
            content: ":white_check_mark: 認証が完了しました。",
            components: [],
        })
        return await c.render(<SuccessAlert>認証が完了しました。</SuccessAlert>)
    },
)

/**
 * @package
 */
export { app as callback }
