import { API } from "@discordjs/core/http-only"
import { blockQuote, channelMention, userMention } from "@discordjs/formatters"
import { DiscordAPIError, REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandInteractionDataOption,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10"
import type { CommandHandler } from "discord-hono"
import { Buffer } from "node:buffer"
import type { ArrayValues } from "type-fest"
import * as v from "valibot"

import { Modals } from ".."
import {
    DISCORD_AVATAR_IMAGE_ALLOWED_MIME,
    DISCORD_WEBHOOK_NAME_MAX_LENGTH,
    guildConfigInit,
} from "../constants"
import { type ErrorContext, reportErrorWithContext } from "../utils"

import type { Env } from "@/lib/schema/env"
import { $GuildConfig } from "@/lib/schema/kvNamespaces"
import { id } from "@/lib/utils/fp"

/**
 * @package
 */
export const command = {
    name: "init",
    description: "認証をリクエストするためのボタンをチャンネルに設置します。",
    contexts: [InteractionContextType.Guild],
    default_member_permissions: `${PermissionFlagsBits.Administrator}`,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "channel",
            description: "メッセージを送信するチャンネル",
            type: ApplicationCommandOptionType.Channel,
            channel_types: [ChannelType.GuildText],
            required: true,
        },
        {
            name: "avatar",
            description: "メッセージ送信時のアバター画像（既定値: 📣）",
            type: ApplicationCommandOptionType.Attachment,
            required: false,
        },
        {
            name: "username",
            description: "メッセージ送信時のユーザー名（既定値: nada-auth）",
            type: ApplicationCommandOptionType.String,
            max_length: DISCORD_WEBHOOK_NAME_MAX_LENGTH,
            required: false,
        },
    ],
} as const satisfies RESTPostAPIChatInputApplicationCommandsJSONBody

type SetupOptions = ArrayValues<(typeof command)["options"]>

/**
 * @package
 */
export const handler: CommandHandler<Env> = async (c) => {
    const discord = new API(new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN))
    const guildConfigRecord = c.env.GuildConfigs
    const { interaction } = c
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    if (!isChatInputApplicationCommandInteraction(interaction))
        return c.res(":x: このコマンドはサポートされていません。")
    const {
        guild_id: guildId,
        member,
        data: { options: interactionDataOptions, resolved: interactionDataResolved },
    } = interaction
    const errorContext = {
        guildId,
        member,
        path: "Commands.init.handler",
    } as const satisfies ErrorContext
    const getOptionValue = <T extends SetupOptions["name"]>(
        optionName: T,
    ):
        | (APIApplicationCommandInteractionDataOption &
              Pick<Extract<SetupOptions, { name: T }>, "type">)["value"]
        | undefined => {
        if (!interactionDataOptions) return
        const commandOptionDef = command.options.find((o) => o.name === optionName)
        const commandOptionData = interactionDataOptions.find((o) => o.name === optionName)
        if (commandOptionDef?.type === commandOptionData?.type) return commandOptionData?.value
    }
    const { channel, avatar, username } = Object.fromEntries(
        command.options.map((o) => [o.name, getOptionValue(o.name)]),
    )
    if (!channel)
        return c.res(":x: 必須オプション `channel` の形式が不正であるか、与えられませんでした。")
    const rawGuildConfig = await guildConfigRecord.get(guildId, "json").catch(id)
    if (rawGuildConfig instanceof Error) {
        await reportErrorWithContext(rawGuildConfig, errorContext, c.env)
        return c.res(
            ":x: サーバーの設定データを正しく読み取れなかったため、インタラクションを正常に処理できませんでした。",
        )
    }
    const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
    if (!guildConfigParseResult.success) {
        await reportErrorWithContext(
            new v.ValiError(guildConfigParseResult.issues),
            errorContext,
            c.env,
        )
        return c.res(
            ":x: サーバーの設定データを正しく読み取れなかったため、インタラクションを正常に処理できませんでした。",
        )
    }
    const guildConfig = guildConfigParseResult.output
    const signInButtonWebhook = guildConfig._signInButtonWebhook
    const avatarAttachment = avatar && interactionDataResolved?.attachments?.[avatar]
    if (avatar && !avatarAttachment) return c.res(":x: 添付ファイルを取得できませんでした。")
    const fetchAvatarDataUrl = async () => {
        if (!avatarAttachment) return null
        const response = await fetch(avatarAttachment.url).catch(id<unknown>)
        if (!(response instanceof Response) || !response.ok)
            return new Error(":x: 添付ファイルを取得できませんでした。")
        const mime = response.headers.get("Content-Type")
        if (!mime) return new Error(":x: 添付ファイルを取得できませんでした。")
        if (!DISCORD_AVATAR_IMAGE_ALLOWED_MIME.test(mime))
            return new Error(
                ":warning: アバター画像としてこの形式のファイルを設定することはできません。",
            )
        return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`
    }
    const dataUrlFetchResult = await fetchAvatarDataUrl()
    if (dataUrlFetchResult instanceof Error) return c.res(dataUrlFetchResult.message)
    const errors: string[] = []
    if (signInButtonWebhook) {
        await discord.webhooks
            .edit(signInButtonWebhook.id, {
                name: username ?? "nada-auth",
                avatar: dataUrlFetchResult,
                channel_id: channel,
            })
            .then((webhook) => {
                guildConfig._signInButtonWebhook = webhook
            })
            .catch(async (e: unknown) => {
                if (e instanceof DiscordAPIError) {
                    await reportErrorWithContext(e, errorContext, c.env)
                    errors.push(
                        `:x: Webhook ${userMention(signInButtonWebhook.id)} を更新することができませんでした。理由: \n${blockQuote(e.message)}`,
                    )
                    delete guildConfig._signInButtonWebhook
                }
            })
    } else {
        await discord.channels
            .createWebhook(channel, {
                name: username ?? "nada-auth",
                avatar: dataUrlFetchResult,
            })
            .then((webhook) => {
                guildConfig._signInButtonWebhook = webhook
            })
            .catch(async (e: unknown) => {
                if (e instanceof DiscordAPIError) {
                    await reportErrorWithContext(e, errorContext, c.env)
                    errors.push(
                        `:x: チャンネル ${channelMention(channel)} に Webhook を作成することができませんでした。理由: \n${blockQuote(e.message)}`,
                    )
                }
            })
    }
    c.executionCtx.waitUntil(guildConfigRecord.put(guildId, JSON.stringify(guildConfig)))

    if (errors.length) return c.res(errors.join("\n"))
    return c.resModal(Modals.init.modal)
}
