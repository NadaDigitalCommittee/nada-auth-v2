import { CDN, DiscordAPIError, REST } from "@discordjs/rest"
import { isGuildInteraction } from "discord-api-types/utils"
import {
    type APIModalInteractionResponseCallbackData,
    type APIModalSubmitInteraction,
    ComponentType,
    type RESTPostAPIWebhookWithTokenJSONBody,
    type RESTPostAPIWebhookWithTokenResult,
    Routes,
    TextInputStyle,
} from "discord-api-types/v10"
import { Components } from "discord-hono"
import type { ArrayValues } from "type-fest"
import * as v from "valibot"

import { Components as CustomComponents } from ".."
import { guildConfigInit } from "../constants"
import type { ModalHandler } from "../types"
import {
    type ErrorContext,
    reportErrorWithContext,
    signInButtonWebhookDefaultAvatarUrlOf,
} from "../utils"

import type { Env } from "@/lib/schema/env"
import { $GuildConfig } from "@/lib/schema/kvNamespaces"
import { shouldBeError } from "@/lib/utils/exceptions"

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
                    label: "ボタンのラベル（既定値: 認証を受ける）",
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
    const rest = new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN)
    const interaction = c.interaction as APIModalSubmitInteraction
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    const { guild_id: guildId, member } = interaction
    const errorContext = {
        guildId,
        member,
        path: "Modals.init.handler",
    } as const satisfies ErrorContext

    const guildConfigRecord = c.env.GuildConfigs
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
    if (!signInButtonWebhook)
        return c.res(
            ":warning: Webhook が見つかりませんでした。再度 /init コマンドを実行してみてください。",
        )
    /* eslint-disable @typescript-eslint/no-redundant-type-constituents */
    const webhookExecutionResult = (await rest
        .post(Routes.webhook(signInButtonWebhook.id, signInButtonWebhook.token), {
            body: {
                avatar_url: signInButtonWebhook.avatar
                    ? new CDN().avatar(signInButtonWebhook.id, signInButtonWebhook.avatar)
                    : signInButtonWebhookDefaultAvatarUrlOf(c.req.url).href,
                content: messageContent,
                components: new Components()
                    .row({ ...CustomComponents.signInButton.component, label: buttonLabel })
                    .toJSON(),
            } satisfies RESTPostAPIWebhookWithTokenJSONBody,
        })
        .catch(shouldBeError)) as RESTPostAPIWebhookWithTokenResult | DiscordAPIError | TypeError
    if (webhookExecutionResult instanceof Error) {
        await reportErrorWithContext(webhookExecutionResult, errorContext, c.env)
        return c.res(
            `:x: メッセージを送信できませんでした。理由: \n>>> ${webhookExecutionResult.message}`,
        )
    }
    return c.res(":white_check_mark: メッセージを送信しました。")
}
