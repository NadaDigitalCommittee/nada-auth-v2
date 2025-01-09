import { CDN, DiscordAPIError } from "@discordjs/rest"
import { vValidator } from "@hono/valibot-validator"
import {
    type RESTPatchAPIGuildMemberJSONBody,
    type RESTPatchAPIWebhookWithTokenMessageJSONBody,
    type RESTPostAPIWebhookWithTokenJSONBody,
    Routes,
} from "discord-api-types/v10"
import { Embed } from "discord-hono"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { deleteCookie } from "hono/cookie"
import * as v from "valibot"

import { guildConfigInit } from "@/lib/discord/constants"
import {
    type ErrorContext,
    loggingWebhookAvatarUrlOf,
    reportErrorWithContext,
} from "@/lib/discord/utils"
import type { Env } from "@/lib/schema/env"
import { $GuildConfig, $Session, $SessionId } from "@/lib/schema/kvNamespaces"
import { $TokenPayload } from "@/lib/schema/tokenPayload"
import { NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { sharedCookieNames } from "@/lib/utils/cookie"
import { wrapWithTryCatchAsync } from "@/lib/utils/exceptions"
import { extractNadaACWorkSpaceUserFromTokenPayload } from "@/lib/utils/extractNadaACWorkSpaceUserFromTokenPayload"
import { formatNickname } from "@/lib/utils/formatNickname"

const app = new Hono<Env>().get(
    "/",
    vValidator(
        "query",
        v.union([
            v.object({
                state: v.string(),
                code: v.string(),
                error: v.undefined(),
            }),
            v.object({
                state: v.string(),
                error: v.string(),
            }),
        ]),
    ),
    vValidator(
        "cookie",
        v.object({
            [sharedCookieNames.sessionId]: $SessionId,
        }),
    ),
    async (c) => {
        const sessionRecord = c.env.Sessions
        const guildConfigRecord = c.env.GuildConfigs
        const { rest } = c.var
        const AUTHN_FAILED_MESSAGE = `:x: 認証に失敗しました。以下の点を確認し、再試行してください。
* 学校から配布された Google アカウントでログインしていること。
* メールアドレスとプロフィールへのアクセスを許可していること。`
        const sessionId = c.req.valid("cookie").sid
        deleteCookie(c, sharedCookieNames.sessionId)
        const query = c.req.valid("query")
        const { state } = query
        const rawSession = await wrapWithTryCatchAsync(
            async () => await sessionRecord.get(sessionId, "json"),
        )
        await wrapWithTryCatchAsync(async () => {
            await sessionRecord.delete(sessionId)
        })
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
        const rawGuildConfig = await wrapWithTryCatchAsync(
            async () => await guildConfigRecord.get(session.guildId, "json"),
        )
        const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
        if (!guildConfigParseResult.success) {
            await editOriginal({
                content: ":x: 認証に失敗しました。理由: 内部エラー",
                components: [],
            })
            return c.text("Internal Server Error", 500)
        }
        const guildConfig = guildConfigParseResult.output
        const loggingWebhook = guildConfig._loggingWebhook
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
        // TODO: Loggerクラスをつくる
        const loggingEmbedBase = () =>
            new Embed()
                .author({
                    name: session.user.username,
                    icon_url: session.user.avatar
                        ? new CDN().avatar(session.user.id, session.user.avatar)
                        : undefined,
                })
                .footer({
                    text: `ID: ${session.user.id}`,
                })
                .timestamp(new Date(tokenPayload.iat * 1000).toISOString())
        if (!c.env.ALLOWED_EMAIL_DOMAINS.includes(tokenPayload.hd)) {
            await editOriginal({
                content: AUTHN_FAILED_MESSAGE,
                components: [],
            })
            if (loggingWebhook) {
                await rest
                    .post(Routes.webhook(loggingWebhook.id, loggingWebhook.token), {
                        body: {
                            avatar_url: loggingWebhookAvatarUrlOf(c.req.url).href,
                            embeds: [
                                loggingEmbedBase()
                                    .title("Failed authentication")
                                    .fields({
                                        name: "Reason",
                                        value: "Email domain not allowed",
                                    })
                                    .color(0xda373c)
                                    .toJSON(),
                            ],
                        } satisfies RESTPostAPIWebhookWithTokenJSONBody,
                    })
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    })
            }
            return c.text("Forbidden", 403)
        }
        const nadaACWorkSpaceUser = extractNadaACWorkSpaceUserFromTokenPayload(tokenPayload)
        if (guildConfig.nicknameFormat) {
            const nicknameFormatResult = formatNickname(
                guildConfig.nicknameFormat,
                nadaACWorkSpaceUser,
            )
            if (nicknameFormatResult.warnings.length && loggingWebhook) {
                await rest
                    .post(Routes.webhook(loggingWebhook.id, loggingWebhook.token), {
                        body: {
                            avatar_url: loggingWebhookAvatarUrlOf(c.req.url).href,
                            embeds: [
                                loggingEmbedBase()
                                    .title("Warnings while formatting nickname")
                                    .description(
                                        `\`\`\`\n${nicknameFormatResult.warnings
                                            .map((w) => w.stack)
                                            .join("\n")}\`\`\``,
                                    )
                                    .color(0xffcc00)
                                    .toJSON(),
                            ],
                        } satisfies RESTPostAPIWebhookWithTokenJSONBody,
                    })
                    .catch(async (e: unknown) => {
                        if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    })
            }
            await rest
                .patch(Routes.guildMember(session.guildId, session.user.id), {
                    body: {
                        nick: nicknameFormatResult.formatted,
                    } satisfies RESTPatchAPIGuildMemberJSONBody,
                })
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                    if (loggingWebhook) {
                        await rest
                            .post(Routes.webhook(loggingWebhook.id, loggingWebhook.token), {
                                body: {
                                    avatar_url: loggingWebhookAvatarUrlOf(c.req.url).href,
                                    embeds: [
                                        loggingEmbedBase()
                                            .title("Failed to modify nickname")
                                            .fields({
                                                name: "Reason",
                                                value:
                                                    e instanceof DiscordAPIError
                                                        ? e.message
                                                        : "Unknown Error",
                                            })
                                            .color(0xda373c)
                                            .toJSON(),
                                    ],
                                } satisfies RESTPostAPIWebhookWithTokenJSONBody,
                            })
                            .catch(async (e: unknown) => {
                                if (e instanceof Error)
                                    await reportErrorWithContext(e, errorContext, c.env)
                            })
                    }
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
                    if (loggingWebhook) {
                        await rest
                            .post(Routes.webhook(loggingWebhook.id, loggingWebhook.token), {
                                body: {
                                    avatar_url: loggingWebhookAvatarUrlOf(c.req.url).href,
                                    embeds: [
                                        loggingEmbedBase()
                                            .title(`Failed to add role`)
                                            .fields({
                                                name: "Reason",
                                                value:
                                                    e instanceof DiscordAPIError
                                                        ? e.message
                                                        : "Unknown Error",
                                            })
                                            .color(0xda373c)
                                            .toJSON(),
                                    ],
                                } satisfies RESTPostAPIWebhookWithTokenJSONBody,
                            })
                            .catch(async (e: unknown) => {
                                if (e instanceof Error)
                                    await reportErrorWithContext(e, errorContext, c.env)
                            })
                    }
                })
        }
        if (loggingWebhook) {
            const embedFields = (() => {
                const { type: userType, data: userData } = nadaACWorkSpaceUser
                const commonEmbedFields = [
                    {
                        name: "名前",
                        value: `${userData.lastName} ${userData.firstName} (<@${session.user.id}>)`,
                    },
                    {
                        name: "メールアドレス",
                        value: tokenPayload.email,
                    },
                ]
                switch (userType) {
                    case NadaAcWorkSpaceUserType.Student: {
                        return [
                            {
                                name: "学年",
                                value: `${userData.studentType}${userData.grade} (${userData.cohort}回生)`,
                                inline: true,
                            },
                            {
                                name: "組",
                                value: `${userData.class}組`,
                                inline: true,
                            },
                            {
                                name: "出席番号",
                                value: `${userData.number}番`,
                                inline: true,
                            },
                            ...commonEmbedFields,
                        ]
                    }
                    case NadaAcWorkSpaceUserType.Others:
                        return commonEmbedFields
                }
            })()
            await rest
                .post(Routes.webhook(loggingWebhook.id, loggingWebhook.token), {
                    body: {
                        avatar_url: loggingWebhookAvatarUrlOf(c.req.url).href,
                        embeds: [
                            loggingEmbedBase()
                                .color(0x5865f2)
                                .fields(...embedFields)
                                .toJSON(),
                        ],
                    } satisfies RESTPostAPIWebhookWithTokenJSONBody,
                })
                .catch(async (e: unknown) => {
                    if (e instanceof Error) await reportErrorWithContext(e, errorContext, c.env)
                })
        }
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
