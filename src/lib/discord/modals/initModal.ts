import { API } from "@discordjs/core/http-only"
import { blockQuote } from "@discordjs/formatters"
import { CDN, DiscordAPIError, REST } from "@discordjs/rest"
import { isGuildInteraction } from "discord-api-types/utils"
import {
    type APIModalInteractionResponseCallbackData,
    ComponentType,
    TextInputStyle,
} from "discord-api-types/v10"
import { Components, type ModalHandler } from "discord-hono"
import type { ArrayValues } from "type-fest"
import * as v from "valibot"

import { Components as CustomComponents } from ".."
import { guildConfigInit, signInButtonWebhookAvatarPath } from "../constants"
import { type ErrorContext, reportErrorWithContext } from "../utils"

import type { Env } from "@/lib/schema/env"
import { $GuildConfig } from "@/lib/schema/kvNamespaces"
import { id } from "@/lib/utils/fp"

/**
 * @package
 */
export const modal = {
    title: "メッセージ内容を記入",
    custom_id: "init",
    components: [
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.TextInput,
                    custom_id: "button-label",
                    label: "ボタンのラベル（既定値: 「認証」）",
                    style: TextInputStyle.Short,
                    required: false,
                },
            ],
        },
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.TextInput,
                    custom_id: "message-content",
                    label: "メッセージ本文（任意）",
                    style: TextInputStyle.Paragraph,
                    required: false,
                },
            ],
        },
    ],
} as const satisfies APIModalInteractionResponseCallbackData

type TextInputCustomId = ArrayValues<
    ArrayValues<(typeof modal)["components"]>["components"]
>["custom_id"]

/**
 * @package
 */
export const handler: ModalHandler<
    Env & {
        Variables: Partial<Record<TextInputCustomId, string>>
    }
> = async (c) => {
    const messageContent = c.var["message-content"] || undefined
    const buttonLabel =
        c.var["button-label"]?.trim() || CustomComponents.signInButton.component.label
    const discord = new API(new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN))
    const { interaction } = c
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    const { guild_id: guildId, member } = interaction
    const errorContext = {
        guildId,
        member,
        path: "Modals.init.handler",
    } as const satisfies ErrorContext

    const guildConfigRecord = c.env.GuildConfigs
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
    if (!signInButtonWebhook?.token)
        return c.res(
            ":warning: Webhook が見つかりませんでした。再度 /init コマンドを実行してみてください。",
        )
    const webhookExecutionResult = await discord.webhooks
        .execute(signInButtonWebhook.id, signInButtonWebhook.token, {
            avatar_url: signInButtonWebhook.avatar
                ? new CDN().avatar(signInButtonWebhook.id, signInButtonWebhook.avatar)
                : new URL(signInButtonWebhookAvatarPath, c.env.ORIGIN).href,
            content: messageContent,
            components: new Components()
                .row({ ...CustomComponents.signInButton.component, label: buttonLabel })
                .toJSON(),
        })
        .catch(id<unknown, DiscordAPIError>)
    if (webhookExecutionResult instanceof DiscordAPIError) {
        await reportErrorWithContext(webhookExecutionResult, errorContext, c.env)
        return c.res(
            `:x: メッセージを送信できませんでした。理由: \n${blockQuote(webhookExecutionResult.message)}`,
        )
    }
    return c.res(":white_check_mark: メッセージを送信しました。")
}
