import { vValidator } from "@hono/valibot-validator"
import {
    type RESTPatchAPIGuildMemberJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    Routes,
} from "discord-api-types/v10"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import * as v from "valibot"

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
import { $TokenPayload } from "@/lib/schema/tokenPayload"
import { generateSchema } from "@/lib/schema/utils"
import { NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { shouldBeError } from "@/lib/utils/exceptions"
import { formatNickname } from "@/lib/utils/formatNickname"
import { extractNadaACWorkSpaceUserFromTokenPayload } from "@/lib/utils/nadaAc"

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
        const rawSession = await sessionRecord.get(sessionId, "json").catch(shouldBeError)
        void (await sessionRecord.delete(sessionId).catch(shouldBeError))
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
        const rawGuildConfig = await guildConfigRecord
            .get(session.guildId, "json")
            .catch(shouldBeError)
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
        const redirectUri = new URL(c.req.url)
        redirectUri.protocol = "https:"
        redirectUri.search = ""
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
        if (guildConfig.nicknameFormat) {
            const nicknameFormatResult = formatNickname(
                guildConfig.nicknameFormat,
                nadaACWorkSpaceUser,
            )
            if (nicknameFormatResult.warnings.length)
                await logger
                    .warn({
                        title: "Warnings while formatting nickname",
                        fields: [
                            {
                                name: "Details",
                                value: `\`\`\`\n${nicknameFormatResult.warnings
                                    .map((w) => w.stack)
                                    .join("\n")}\`\`\``,
                            },
                        ],
                    })
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    })
            await rest
                .patch(Routes.guildMember(session.guildId, session.user.id), {
                    body: {
                        nick: nicknameFormatResult.formatted,
                    } satisfies RESTPatchAPIGuildMemberJSONBody,
                })
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    await logger
                        .error({
                            title: "Failed to modify nickname",
                            fields: [
                                {
                                    name: "Reason",
                                    value: getDiscordAPIErrorMessage(e),
                                },
                            ],
                        })
                        .catch(async (e: unknown) => {
                            if (e instanceof Error)
                                await reportErrorWithContext(e, errorContext, c.env)
                        })
                })
        }
        if (guildConfig.authenticatedRoleId) {
            await rest
                .put(
                    Routes.guildMemberRole(
                        session.guildId,
                        session.user.id,
                        guildConfig.authenticatedRoleId,
                    ),
                )
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    await logger
                        .error({
                            title: "Failed to add role",
                            fields: [
                                {
                                    name: "Reason",
                                    value: getDiscordAPIErrorMessage(e),
                                },
                            ],
                        })
                        .catch(async (e: unknown) => {
                            if (e instanceof Error)
                                await reportErrorWithContext(e, errorContext, c.env)
                        })
                })
        }
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
