import { type DiscordAPIError, REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandBasicOption,
    type APIApplicationCommandInteractionDataBooleanOption,
    type APIApplicationCommandInteractionDataSubcommandGroupOption,
    type APIApplicationCommandSubcommandOption,
    type APIEmbedField,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTDeleteAPIWebhookResult,
    type RESTPatchAPIWebhookJSONBody,
    type RESTPatchAPIWebhookResult,
    type RESTPostAPIChannelWebhookJSONBody,
    type RESTPostAPIChannelWebhookResult,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
} from "discord-api-types/v10"
import { type CommandHandler, Embed } from "discord-hono"
import type { ValueOf } from "type-fest"
import * as v from "valibot"

import { configSetOptionNameOf, guildConfigInit, guildConfigKvKeyOf } from "../constants"
import { type ErrorContext, prettifyOptionValue, reportErrorWithContext } from "../utils"

import type { Env } from "@/lib/schema/env"
import { $GuildConfig, type GuildConfigRecord } from "@/lib/schema/kvNamespaces"
import { valuesToBitmask } from "@/lib/utils/boolTupleToBitmask"
import { shouldBeError } from "@/lib/utils/exceptions"

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
        {
            name: "reset",
            description: "Bot のサーバー設定を初期化します。",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "force",
                    description: "エラーを無視して初期化（既定値: False）",
                    type: ApplicationCommandOptionType.Boolean,
                },
            ],
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
    const { interaction } = c
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    if (!isChatInputApplicationCommandInteraction(interaction))
        return c.res(":x: このコマンドはサポートされていません。")
    const {
        guild_id: guildId,
        member,
        data: { options = [] },
    } = interaction
    const errorContext = {
        guildId,
        member,
        path: "Commands.config.handler",
        subcommandString: c.sub.string,
    } as const satisfies ErrorContext
    // NOTE: 型と値が乖離するのでジェネリクスはつけない
    const rawGuildConfig = await guildConfigRecord.get(guildId, "json").catch(shouldBeError)
    // TODO: エラーメッセージを定数管理
    // TODO: テストを書く😭
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
                const { bitmask, bindings } = valuesToBitmask(
                    guildConfig._loggingWebhook,
                    subcommandOptionOptionValue,
                )
                switch (bitmask) {
                    case 0b11: {
                        // すでに Webhook が作成されていて、別のチャンネルに変更される場合
                        const [loggingWebhook, channelOptionValue] = bindings
                        const webhookModificationResult = (await rest
                            .patch(Routes.webhook(loggingWebhook.id), {
                                body: {
                                    channel_id: channelOptionValue,
                                } satisfies RESTPatchAPIWebhookJSONBody,
                            })
                            .catch(shouldBeError)) as
                            | RESTPatchAPIWebhookResult
                            | DiscordAPIError
                            | TypeError
                        if (webhookModificationResult instanceof Error) {
                            await reportErrorWithContext(
                                webhookModificationResult,
                                errorContext,
                                c.env,
                            )
                            return c.res(
                                `:x: Webhook <@${loggingWebhook.id}> を更新できませんでした。\n理由: \n>>> ${webhookModificationResult.message}`,
                            )
                        }
                        guildConfig._loggingWebhook = webhookModificationResult
                        break
                    }
                    case 0b10: {
                        // すでに webhook が作成されていて、それを削除する場合
                        const [loggingWebhook] = bindings
                        const webhookDeletionResult = (await rest
                            .delete(Routes.webhook(loggingWebhook.id))
                            .catch(shouldBeError)) as  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
                            | RESTDeleteAPIWebhookResult
                            | DiscordAPIError
                            | TypeError
                        if (webhookDeletionResult instanceof Error) {
                            await reportErrorWithContext(webhookDeletionResult, errorContext, c.env)
                            return c.res(
                                `:x: Webhook <@${loggingWebhook.id}> を削除できませんでした。\n理由: \n>>> ${webhookDeletionResult.message}`,
                            )
                        }
                        delete guildConfig._loggingWebhook
                        break
                    }
                    case 0b01: {
                        // webhook がまだ作成されておらず、新たに作る場合
                        const [, channelOptionValue] = bindings
                        const webhookCreationResult = (await rest
                            .post(Routes.channelWebhooks(channelOptionValue), {
                                body: {
                                    name: "nada-auth logging",
                                } satisfies RESTPostAPIChannelWebhookJSONBody,
                            })
                            .catch(shouldBeError)) as
                            | RESTPostAPIChannelWebhookResult
                            | DiscordAPIError
                            | TypeError
                        if (webhookCreationResult instanceof Error) {
                            await reportErrorWithContext(webhookCreationResult, errorContext, c.env)
                            return c.res(
                                `:x: チャンネル <#${channelOptionValue}> に Webhook を作成できませんでした。\n理由: \n>>> ${webhookCreationResult.message}`,
                            )
                        }
                        guildConfig._loggingWebhook = webhookCreationResult
                        break
                    }
                    case 0b00:
                        // webhook がないがチャンネルの設定が存在し、それを削除しようとしている場合
                        // guildConfig[guildConfigKvKey] === subcommandOptionOptionValue
                        // を弾いているので、KVを直接触らない限りありえない？
                        // この switch の次の処理で logginChannelId は削除されるので、何もしない
                        break
                }
            }
            guildConfig[guildConfigKvKey] = subcommandOptionOptionValue
            await guildConfigRecord.put(guildId, JSON.stringify(guildConfig))
            return c.res({
                content: ":white_check_mark: サーバー設定が更新されました。",
                embeds: [generateConfigTableEmbed(guildConfig)],
            })
        }
        case "reset": {
            const [{ options: configResetOptions }] = options as [
                {
                    name: string
                    type: ApplicationCommandOptionType.Subcommand
                    options: [APIApplicationCommandInteractionDataBooleanOption] | []
                },
            ]
            const forceReset = configResetOptions[0]?.value ?? false
            // TODO: このあたり共通化する
            const loggingWebhook = guildConfig._loggingWebhook
            const loggingWebhookDeletionResult =
                loggingWebhook &&
                ((await rest.delete(Routes.webhook(loggingWebhook.id)).catch(shouldBeError)) as  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
                    | RESTDeleteAPIWebhookResult
                    | DiscordAPIError
                    | TypeError)
            if (!forceReset && loggingWebhook && loggingWebhookDeletionResult instanceof Error) {
                await reportErrorWithContext(loggingWebhookDeletionResult, errorContext, c.env)
                return c.res(`:x: サーバー設定を正常に初期化できませんでした。
:arrow_right_hook: Webhook <@${loggingWebhook.id}> を削除することができませんでした。
理由:
>>> ${loggingWebhookDeletionResult.message}`)
            }
            const signInButtonWebhook = guildConfig._signInButtonWebhook
            const signInButtonWebhookDeletionResult =
                signInButtonWebhook &&
                ((await rest
                    .delete(Routes.webhook(signInButtonWebhook.id))
                    .catch(shouldBeError)) as  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
                    | RESTDeleteAPIWebhookResult
                    | DiscordAPIError
                    | TypeError)
            if (
                !forceReset &&
                signInButtonWebhook &&
                signInButtonWebhookDeletionResult instanceof Error
            ) {
                await reportErrorWithContext(signInButtonWebhookDeletionResult, errorContext, c.env)
                return c.res(`:x: サーバー設定を正常に初期化できませんでした。
:arrow_right_hook: Webhook <@${signInButtonWebhook.id}> を削除することができませんでした。
理由:
>>> ${signInButtonWebhookDeletionResult.message}`)
            }
            const guildConfigDeletionResult = await guildConfigRecord
                .delete(guildId)
                .catch(shouldBeError)
            if (guildConfigDeletionResult instanceof Error) {
                await reportErrorWithContext(guildConfigDeletionResult, errorContext, c.env)
                return c.res(`:x: サーバー設定を正常に初期化できませんでした。
:arrow_right_hook: データを削除できませんでした。`)
            }
            return c.res({
                content: ":white_check_mark: サーバー設定が初期化されました。",
                embeds: [generateConfigTableEmbed(guildConfigInit)],
            })
        }

        default:
            return c.res(":x: このサブコマンドはサポートされていません。")
    }
}
