import { DiscordAPIError, REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandInteraction,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTDeleteAPIWebhookWithTokenResult,
    type RESTPostAPIChannelWebhookJSONBody,
    type RESTPostAPIChannelWebhookResult,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    type RESTPostAPIWebhookWithTokenJSONBody,
    type RESTPostAPIWebhookWithTokenResult,
    Routes,
} from "discord-api-types/v10"
import { Components } from "discord-hono"
import MIMEType from "whatwg-mimetype"

import { DISCORD_MESSAGE_MAX_LENGTH } from "../constants"
import type { CommandHandler } from "../types"
import { type ErrorContext, reportErrorWithContext, serverRulesWebhookAvatarUrlOf } from "../utils"

import { Components as CustomComponents } from "@/lib/discord"
import type { Env } from "@/lib/schema/env"
import { shouldBeError } from "@/lib/utils/exceptions"

/**
 * @package
 */
export const command = {
    name: "post-rules",
    description: "指定されたチャンネルにサーバールールとボタンを送信します。",
    contexts: [InteractionContextType.Guild],
    default_member_permissions: `${PermissionFlagsBits.Administrator}`,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "channel",
            description: "サーバールールを送信するチャンネル",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildText],
            required: true,
        },
        {
            name: "content",
            description: "サーバールールの内容（テキストファイル）",
            type: ApplicationCommandOptionType.Attachment,
            required: true,
        },
    ],
} as const satisfies RESTPostAPIChatInputApplicationCommandsJSONBody

/**
 * @package
 */
export const handler: CommandHandler<Env> = async (c) => {
    // mountするとvarが空になる？
    // const { rest } = c.var
    const rest = new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN)
    const interaction = c.interaction as APIApplicationCommandInteraction
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    if (!isChatInputApplicationCommandInteraction(interaction))
        return c.res(":x: このコマンドはサポートされていません。")
    const {
        guild_id: guildId,
        member,
        data: { options, resolved },
    } = interaction
    const errorContext = {
        guildId,
        member,
        path: "Commands.postRules.handler",
    } as const satisfies ErrorContext
    const getOption = (optionName: string) => options?.find((option) => option.name === optionName)
    const channelOption = getOption("channel")
    const contentOption = getOption("content")
    {
        if (!channelOption || channelOption.type !== ApplicationCommandOptionType.Channel)
            return c.res(
                ":x: 必須オプション `channel` の形式が不正であるか、与えられませんでした。",
            )
        if (!contentOption || contentOption.type !== ApplicationCommandOptionType.Attachment)
            return c.res(
                ":x: 必須オプション `content` の形式が不正であるか、与えられませんでした。",
            )
    }
    const contentOptionResolved = resolved?.attachments?.[contentOption.value]
    {
        if (!contentOptionResolved) return c.res(":x: 添付ファイルを取得できませんでした。")
        const contentMimeType = ((): MIMEType => {
            try {
                return new MIMEType(contentOptionResolved.content_type || "text/plain")
            } catch {
                return new MIMEType("text/plain")
            }
        })()
        if (contentMimeType.type !== "text")
            return c.res(":warning: 添付ファイルはテキストデータである必要があります。")
    }
    const serverRulesContent = await (await fetch(contentOptionResolved.url)).text()
    if (serverRulesContent.length > DISCORD_MESSAGE_MAX_LENGTH)
        return c.res(
            `:warning: 添付ファイルのサイズが ${DISCORD_MESSAGE_MAX_LENGTH} 文字を超えています。`,
        )
    const webhook = (await rest
        .post(Routes.channelWebhooks(channelOption.value), {
            body: {
                name: "サーバールール",
            } satisfies RESTPostAPIChannelWebhookJSONBody,
        })
        .catch(shouldBeError)) as RESTPostAPIChannelWebhookResult | DiscordAPIError | TypeError
    if (webhook instanceof Error) {
        const error = webhook
        await reportErrorWithContext(error, errorContext, c.env)
        return c.res(
            `:x: チャンネル <#${channelOption.value}> に Webhook を作成することができませんでした。`,
        )
    }

    /* eslint-disable @typescript-eslint/no-redundant-type-constituents */
    const webhookPostResult = (await rest
        .post(Routes.webhook(webhook.id, webhook.token), {
            body: {
                avatar_url: serverRulesWebhookAvatarUrlOf(c.req.url).href,
                content: serverRulesContent,
                components: new Components().row(CustomComponents.signInButton.component).toJSON(),
            } satisfies RESTPostAPIWebhookWithTokenJSONBody,
        })
        .catch(shouldBeError)) as RESTPostAPIWebhookWithTokenResult | DiscordAPIError | TypeError
    const webhookDeleteResult = (await rest
        .delete(Routes.webhook(webhook.id, webhook.token))
        .catch(shouldBeError)) as RESTDeleteAPIWebhookWithTokenResult | DiscordAPIError | TypeError
    const errorMessages: string[] = []
    if (webhookPostResult instanceof Error) {
        const error = webhookPostResult
        await reportErrorWithContext(error, errorContext, c.env)
        errorMessages.push("サーバールールを送信することができませんでした。")
    }
    if (webhookDeleteResult instanceof Error) {
        const error = webhookPostResult
        await reportErrorWithContext(error, errorContext, c.env)
        errorMessages.push(`Webhook ${webhook.id} を削除することができませんでした。`)
    }
    if (errorMessages.length) {
        return c.res(
            `:x: 以下のエラーにより、コマンドが正常に終了しませんでした。${errorMessages.map((msg) => `\n* ${msg}`).join("")}`,
        )
    }
    return c.res(`:white_check_mark: サーバールールが送信されました。`)
}
