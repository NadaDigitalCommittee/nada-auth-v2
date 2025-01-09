import { DiscordAPIError, REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandBasicOption,
    type APIApplicationCommandInteraction,
    type APIApplicationCommandInteractionDataSubcommandGroupOption,
    type APIApplicationCommandSubcommandOption,
    type APIEmbedField,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTPostAPIChannelWebhookJSONBody,
    type RESTPostAPIChannelWebhookResult,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
} from "discord-api-types/v10"
import { Embed } from "discord-hono"
import type { ValueOf } from "type-fest"
import * as v from "valibot"

import { configSetOptionNameOf, guildConfigInit, guildConfigKvKeyOf } from "../constants"
import type { CommandHandler } from "../types"
import { prettifyOptionValue } from "../utils"

import type { Env } from "@/lib/schema/env"
import { $GuildConfig, type GuildConfigRecord } from "@/lib/schema/kvNamespaces"
import { shouldBeError, wrapWithTryCatchAsync } from "@/lib/utils/exceptions"

const configSetOptions = [
    {
        name: "authenticated-role",
        description: "認証済みユーザーに付与するロール",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "value",
                description: "ロール。空にするとロールは付与されません。",
                type: ApplicationCommandOptionType.Role,
                required: false,
            },
        ],
    },
    {
        name: "nickname",
        description: "認証済みユーザーに設定するニックネームのフォーマット",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "value",
                description:
                    "フォーマット指定子を含んだ文字列。空にするとニックネームは設定されません。",
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
    },
    {
        name: "logging-channel",
        description: "ログチャンネル",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "value",
                description: "チャンネル。空にするとログは記録されません。",
                channel_types: [ChannelType.GuildText],
                type: ApplicationCommandOptionType.Channel,
                required: false,
            },
        ],
    },
] as const satisfies Array<
    APIApplicationCommandSubcommandOption & {
        name: keyof typeof guildConfigKvKeyOf
        options: [{ name: "value"; required: false } & APIApplicationCommandBasicOption]
    }
>

/**
 * @package
 */
export const command = {
    name: "config",
    description: "Bot のサーバー設定を確認または変更します。",
    contexts: [InteractionContextType.Guild],
    default_member_permissions: `${PermissionFlagsBits.Administrator}`,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "get",
            description: "Bot のサーバー設定を確認します。",
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "set",
            description: "Bot のサーバー設定を変更します。",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: configSetOptions,
        },
    ],
} as const satisfies RESTPostAPIChatInputApplicationCommandsJSONBody

type PickOptionNameAndOptionValueType<T> = T extends {
    name: infer TOptionName
    options: [{ type: infer TOptionValueType }]
}
    ? [TOptionName, TOptionValueType]
    : never

const configSetOptionValueTypeOf = Object.fromEntries(
    configSetOptions.map(
        (subcommandOption) =>
            [
                subcommandOption.name,
                subcommandOption.options[0].type,
            ] as PickOptionNameAndOptionValueType<typeof subcommandOption>,
    ),
)

const generateConfigTableEmbed = (config: ValueOf<GuildConfigRecord>) =>
    new Embed().fields(
        ...Object.entries(config).reduce((acc, cur) => {
            const isInternalConfigEntry = (
                entry: [string, unknown],
            ): entry is [`_${string}`, unknown] => entry[0].startsWith("_")
            if (!isInternalConfigEntry(cur)) {
                const [configKvKey, optionValue] = cur
                const optionName = configSetOptionNameOf[configKvKey]
                const optionValueType = configSetOptionValueTypeOf[optionName]
                acc.push({
                    name: optionName,
                    value: prettifyOptionValue(optionValue, optionValueType, {
                        defaultValue: "-# なし",
                    }),
                    inline: true,
                } satisfies APIEmbedField)
            }
            return acc
            // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
        }, [] as APIEmbedField[]),
    )

/**
 * @package
 */
export const handler: CommandHandler<Env> = async (c) => {
    const guildConfigRecord = c.env.GuildConfigs
    // mountするとvarが空になる？
    // const { rest } = c.var
    const rest = new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN)
    // TODO: DiscordHonoBase.fetchを修正
    const interaction = c.interaction as APIApplicationCommandInteraction
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    if (!isChatInputApplicationCommandInteraction(interaction))
        return c.res(":x: このコマンドはサポートされていません。")
    const {
        guild_id: guildId,
        data: { options = [] },
    } = interaction
    const rawGuildConfig = await wrapWithTryCatchAsync(
        // NOTE: 型と値が乖離するのでジェネリクスはつけない
        async () => await guildConfigRecord.get(guildId, "json"),
    )
    // TODO: エラーメッセージを定数管理
    // TODO: テストを書く😭
    if (rawGuildConfig instanceof Error) {
        const error = rawGuildConfig
        console.error(error)
        await guildConfigRecord.delete(guildId)
        return c.res(
            ":x: 設定データが正しい形式ではなかったため、コマンドが異常終了しました。サーバー設定は初期化されました。",
        )
    }
    const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
    if (!guildConfigParseResult.success) {
        console.error(new v.ValiError(guildConfigParseResult.issues))
        await guildConfigRecord.delete(guildId)
        return c.res(
            ":x: 設定データが正しい形式ではなかったため、コマンドが異常終了しました。サーバー設定は初期化されました。",
        )
    }
    const guildConfig = guildConfigParseResult.output
    // TODO: リテラルではなく、commandから生成
    // TODO: ネストを浅くする
    switch (c.sub.string) {
        case "get":
            return c.res({ embeds: [generateConfigTableEmbed(guildConfig)] })
        case "set authenticated-role":
        case "set logging-channel":
        case "set nickname": {
            const subcommandName = c.sub.string.split(" ").at(-1)
            const subcommandOptionOption = (
                options[0] as APIApplicationCommandInteractionDataSubcommandGroupOption
            ).options[0].options?.[0]
            const subcommandOptionOptionValue =
                subcommandOptionOption?.value.toString().trim() ?? null
            const guildConfigKvKey = guildConfigKvKeyOf[subcommandName]
            {
                // NOTE: バリデーション用スコープ
                const authenticatedRoleValueIsEveryone =
                    subcommandName === "authenticated-role" &&
                    subcommandOptionOptionValue === guildId
                if (authenticatedRoleValueIsEveryone)
                    return c.res(
                        `:warning: オプション \`${subcommandName}\` に everyone を指定することはできません。`,
                    )
            }
            if (guildConfig[guildConfigKvKey] === subcommandOptionOptionValue) {
                return c.res({
                    content: ":person_shrugging: 変更がありません。",
                    embeds: [generateConfigTableEmbed(guildConfig)],
                })
            }
            if (subcommandName === "logging-channel") {
                const oldWebhook = guildConfig._loggingWebhook
                void (
                    oldWebhook &&
                    (await rest
                        .delete(Routes.webhook(oldWebhook.id, oldWebhook.token))
                        .catch(console.error))
                )
                if (subcommandOptionOptionValue) {
                    const newWebhook = (await rest
                        .post(Routes.channelWebhooks(subcommandOptionOptionValue), {
                            body: {
                                name: "nada-auth logging",
                            } satisfies RESTPostAPIChannelWebhookJSONBody,
                        })
                        .catch(shouldBeError)) as
                        | RESTPostAPIChannelWebhookResult
                        | DiscordAPIError
                        | TypeError
                    if (newWebhook instanceof Error) {
                        const error = newWebhook
                        console.error(error)
                        return c.res(
                            `:x: チャンネル <#${subcommandOptionOptionValue}> に Webhook を作成することができませんでした。`,
                        )
                    }
                    guildConfig._loggingWebhook = newWebhook
                }
            }
            guildConfig[guildConfigKvKey] = subcommandOptionOptionValue
            await guildConfigRecord.put(guildId, JSON.stringify(guildConfig))
            return c.res({
                content: ":white_check_mark: サーバー設定が更新されました。",
                embeds: [generateConfigTableEmbed(guildConfig)],
            })
        }
        default:
            return c.res(":x: このサブコマンドはサポートされていません。")
    }
}
