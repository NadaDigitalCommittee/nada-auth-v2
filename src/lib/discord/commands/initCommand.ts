import { DiscordAPIError, REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandInteraction,
    type APIApplicationCommandInteractionDataOption,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTPatchAPIWebhookJSONBody,
    type RESTPatchAPIWebhookResult,
    type RESTPostAPIChannelWebhookJSONBody,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
} from "discord-api-types/v10"
import type { ArrayValues } from "type-fest"
import * as v from "valibot"

import { Modals } from ".."
import {
    DISCORD_AVATAR_IMAGE_ALLOWED_MIME,
    DISCORD_WEBHOOK_NAME_MAX_LENGTH,
    guildConfigInit,
} from "../constants"
import type { CommandHandler } from "../types"
import { type ErrorContext, reportErrorWithContext } from "../utils"

import type { Env } from "@/lib/schema/env"
import { $GuildConfig } from "@/lib/schema/kvNamespaces"
import { shouldBeError } from "@/lib/utils/exceptions"
import { generateDataUrlFromHttpUrl } from "@/lib/utils/misc"

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
    const rest = new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN)
    const guildConfigRecord = c.env.GuildConfigs
    const interaction = c.interaction as APIApplicationCommandInteraction
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
    const optionValues = Object.fromEntries(
        command.options.map((o) => [o.name, getOptionValue(o.name)]),
    )
    if (!optionValues.channel)
        return c.res(":x: 必須オプション `channel` の形式が不正であるか、与えられませんでした。")
    const rawGuildConfig = await guildConfigRecord.get(guildId, "json").catch(shouldBeError)
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
    const avatarAttachment =
        optionValues.avatar && interactionDataResolved?.attachments?.[optionValues.avatar]
    if (optionValues.avatar && !avatarAttachment)
        return c.res(":x: 添付ファイルを取得できませんでした。")
    const fetchAvatarDataUrl = async () => {
        if (!avatarAttachment) return null
        const dataUrl = await generateDataUrlFromHttpUrl(avatarAttachment.url).catch(shouldBeError)
        if (dataUrl instanceof Error) return new Error(":x: 添付ファイルを取得できませんでした。")
        if (!new RegExp(`data:${DISCORD_AVATAR_IMAGE_ALLOWED_MIME.source}`).test(dataUrl))
            return new Error(
                ":warning: アバター画像としてこの形式のファイルを設定することはできません。",
            )
        return dataUrl
    }
    const dataUrlFetchResult = await fetchAvatarDataUrl()
    if (dataUrlFetchResult instanceof Error) return c.res(dataUrlFetchResult.message)
    if (signInButtonWebhook) {
        const webhookJsonBody: RESTPatchAPIWebhookJSONBody = {
            name: optionValues.username ?? "nada-auth",
            avatar: dataUrlFetchResult,
            channel_id: optionValues.channel,
        }
        const webhookModificationResult = (await rest
            .patch(Routes.webhook(signInButtonWebhook.id), {
                body: webhookJsonBody satisfies RESTPatchAPIWebhookJSONBody,
            })
            .catch(shouldBeError)) as RESTPatchAPIWebhookResult | DiscordAPIError | TypeError
        if (webhookModificationResult instanceof Error) {
            await reportErrorWithContext(webhookModificationResult, errorContext, c.env)
            return c.res(
                `:x: Webhook <@${signInButtonWebhook.id}> を更新することができませんでした。\
この問題が続く場合、サーバー設定の 連携サービス > nada-auth でこの Webhook を削除してみてください。理由: \n>>> ${webhookModificationResult.message}`,
            )
        }
        guildConfig._signInButtonWebhook = webhookModificationResult
    } else {
        const webhookJsonBody: RESTPostAPIChannelWebhookJSONBody = {
            name: optionValues.username ?? "nada-auth",
            avatar: dataUrlFetchResult,
        }
        const webhookCreationResult = (await rest
            .post(Routes.channelWebhooks(optionValues.channel), {
                body: webhookJsonBody satisfies RESTPostAPIChannelWebhookJSONBody,
            })
            .catch(shouldBeError)) as RESTPatchAPIWebhookResult | DiscordAPIError | TypeError
        if (webhookCreationResult instanceof Error) {
            await reportErrorWithContext(webhookCreationResult, errorContext, c.env)
            return c.res(
                `:x: チャンネル <#${optionValues.channel}> に Webhook を作成することができませんでした。理由: \n>>> ${webhookCreationResult.message}`,
            )
        }
        guildConfig._signInButtonWebhook = webhookCreationResult
    }
    await guildConfigRecord.put(guildId, JSON.stringify(guildConfig))

    return c.resModal(Modals.init.modal)
}
