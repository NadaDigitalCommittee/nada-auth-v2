import { DiscordAPIError, REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandBasicOption,
    type APIApplicationCommandInteractionDataBooleanOption,
    type APIApplicationCommandInteractionDataSubcommandGroupOption,
    type APIApplicationCommandSubcommandOption,
    type APIButtonComponentWithURL,
    type APIEmbedField,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonStyle,
    ChannelType,
    ComponentType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTPatchAPIWebhookJSONBody,
    type RESTPatchAPIWebhookResult,
    type RESTPostAPIChannelWebhookJSONBody,
    type RESTPostAPIChannelWebhookResult,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
} from "discord-api-types/v10"
import { type CommandHandler, Components, Embed } from "discord-hono"
import { google } from "googleapis"
import { hc } from "hono/client"
import type { ArrayValues } from "type-fest"
import * as v from "valibot"

import {
    guildConfigInit,
    guildConfigKvKeyToOptionNameMap,
    guildConfigOptionNameToKvKeyMap,
    requestTokenExpirationTtl,
    sessionExpirationTtl,
    sessionExpirationTtlDev,
} from "../constants"
import {
    type CommandInteractionDataBasicOptionTypeToOptionValueType,
    type ErrorContext,
    prettifyOptionValue,
    reportErrorWithContext,
} from "../utils"

import type { AppType } from "@/app"
import type { Env } from "@/lib/schema/env"
import { $GuildConfig, type GuildConfig, type SheetsOAuthSession } from "@/lib/schema/kvNamespaces"
import type { MapKeyOf } from "@/lib/types/utils/map"
import { id } from "@/lib/utils/fp"
import { generateSecret } from "@/lib/utils/secret"

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
    {
        name: "strict",
        description: "厳格モード",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "value",
                description: "厳格モードを有効にする（既定値: False）",
                type: ApplicationCommandOptionType.Boolean,
                required: false,
            },
        ],
    },
] as const satisfies Array<
    APIApplicationCommandSubcommandOption & {
        name: MapKeyOf<typeof guildConfigOptionNameToKvKeyMap>
        options: [{ name: "value"; required: false } & APIApplicationCommandBasicOption]
    }
>

type ConfigSetOption = ArrayValues<typeof configSetOptions>

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
        {
            name: "sheets",
            description:
                "スプレッドシートを連携すると、ロールやニックネームを自動で割り当てることができます。",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
                {
                    name: "init",
                    description: "スプレッドシートを新規に作成し、アプリにアクセス権限を与えます。",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [],
                },
                {
                    name: "show",
                    description: "連携しているスプレッドシートを表示します。",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [],
                },
                {
                    name: "revoke",
                    description: "スプレッドシートとの連携を解除します。",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: "hard",
                            description: "ファイルも破棄する（既定値: False）",
                            required: false,
                        },
                    ],
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

const guildConfigOptionNameToOptionTypeMap = new ReadonlyMap(
    configSetOptions.map(
        (subcommandOption) =>
            [
                subcommandOption.name,
                subcommandOption.options[0].type,
            ] as PickOptionNameAndOptionValueType<typeof subcommandOption>,
    ),
)
type GuildConfigOptionNameToOptionValueType<T extends ConfigSetOption["name"]> =
    CommandInteractionDataBasicOptionTypeToOptionValueType<
        Extract<ConfigSetOption, { name: T }>["options"][0]["type"]
    >

const generateConfigTableEmbed = (config: GuildConfig) =>
    new Embed().fields(
        ...Object.entries({ ...guildConfigInit, ...config }).reduce((acc, cur) => {
            const isInternalConfigEntry = (
                entry: [string, unknown],
            ): entry is [`_${string}`, unknown] => entry[0].startsWith("_")
            if (!isInternalConfigEntry(cur)) {
                const [configKvKey, optionValue] = cur
                const optionName = guildConfigKvKeyToOptionNameMap.get(configKvKey)
                const optionValueType = guildConfigOptionNameToOptionTypeMap.get(optionName)
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
    const rawGuildConfig = await guildConfigRecord.get(guildId, "json").catch(id)
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
        case "set nickname":
        case "set strict": {
            const subcommandName = c.sub.string.split(" ").at(-1)
            const subcommandOptionOption = (
                options[0] as APIApplicationCommandInteractionDataSubcommandGroupOption
            ).options[0]?.options?.[0]
            const subcommandOptionOptionValue = subcommandOptionOption?.value
            const guildConfigKvKey = guildConfigOptionNameToKvKeyMap.get(subcommandName)
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
            const isPresent = (val: unknown) => val !== undefined
            if (subcommandName === "logging-channel") {
                const loggingWebhook = guildConfig._loggingWebhook
                const channelOptionValue =
                    subcommandOptionOptionValue as GuildConfigOptionNameToOptionValueType<
                        typeof subcommandName
                    >
                if (isPresent(loggingWebhook) && isPresent(channelOptionValue)) {
                    // すでに Webhook が作成されていて、別のチャンネルに変更される場合
                    const webhookModificationResult = (await rest
                        .patch(Routes.webhook(loggingWebhook.id), {
                            body: {
                                channel_id: channelOptionValue,
                            } satisfies RESTPatchAPIWebhookJSONBody,
                        })
                        .catch(id)) as RESTPatchAPIWebhookResult | DiscordAPIError
                    if (webhookModificationResult instanceof DiscordAPIError) {
                        await reportErrorWithContext(webhookModificationResult, errorContext, c.env)
                        return c.res(
                            `:x: Webhook <@${loggingWebhook.id}> を更新できませんでした。\n理由: \n>>> ${webhookModificationResult.message}`,
                        )
                    }
                    guildConfig._loggingWebhook = webhookModificationResult
                } else if (isPresent(loggingWebhook) && !isPresent(channelOptionValue)) {
                    // すでに webhook が作成されていて、それを削除する場合
                    const webhookDeletionResult = await rest
                        .delete(Routes.webhook(loggingWebhook.id))
                        .catch(id)
                    if (webhookDeletionResult instanceof DiscordAPIError) {
                        await reportErrorWithContext(webhookDeletionResult, errorContext, c.env)
                        return c.res(
                            `:x: Webhook <@${loggingWebhook.id}> を削除できませんでした。\n理由: \n>>> ${webhookDeletionResult.message}`,
                        )
                    }
                    delete guildConfig._loggingWebhook
                } else if (!isPresent(loggingWebhook) && isPresent(channelOptionValue)) {
                    // webhook がまだ作成されておらず、新たに作る場合
                    const webhookCreationResult = (await rest
                        .post(Routes.channelWebhooks(channelOptionValue), {
                            body: {
                                name: "nada-auth logging",
                            } satisfies RESTPostAPIChannelWebhookJSONBody,
                        })
                        .catch(id)) as RESTPostAPIChannelWebhookResult | DiscordAPIError
                    if (webhookCreationResult instanceof DiscordAPIError) {
                        await reportErrorWithContext(webhookCreationResult, errorContext, c.env)
                        return c.res(
                            `:x: チャンネル <#${channelOptionValue}> に Webhook を作成できませんでした。\n理由: \n>>> ${webhookCreationResult.message}`,
                        )
                    }
                    guildConfig._loggingWebhook = webhookCreationResult
                } else {
                    // webhook がないがチャンネルの設定が存在し、それを削除しようとしている場合
                    // guildConfig[guildConfigKvKey] === subcommandOptionOptionValue
                    // を弾いているので、KVを直接触らない限りありえない？
                    // この次の処理で loggingChannelId は削除されるので、何もしない
                }
            }
            await guildConfigRecord.put(
                guildId,
                JSON.stringify(
                    Object.assign(guildConfig, { [guildConfigKvKey]: subcommandOptionOptionValue }),
                ),
            )
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
            if (loggingWebhook) {
                const loggingWebhookDeletionResult = await rest
                    .delete(Routes.webhook(loggingWebhook.id))
                    .catch(id)
                if (!forceReset && loggingWebhookDeletionResult instanceof DiscordAPIError) {
                    await reportErrorWithContext(loggingWebhookDeletionResult, errorContext, c.env)
                    return c.res(`:x: サーバー設定を正常に初期化できませんでした。
:arrow_right_hook: Webhook <@${loggingWebhook.id}> を削除することができませんでした。
理由:
>>> ${loggingWebhookDeletionResult.message}`)
                }
            }
            const signInButtonWebhook = guildConfig._signInButtonWebhook
            if (signInButtonWebhook) {
                const signInButtonWebhookDeletionResult = await rest
                    .delete(Routes.webhook(signInButtonWebhook.id))
                    .catch(id)
                if (!forceReset && signInButtonWebhookDeletionResult instanceof DiscordAPIError) {
                    await reportErrorWithContext(
                        signInButtonWebhookDeletionResult,
                        errorContext,
                        c.env,
                    )
                    return c.res(`:x: サーバー設定を正常に初期化できませんでした。
:arrow_right_hook: Webhook <@${signInButtonWebhook.id}> を削除することができませんでした。
理由:
>>> ${signInButtonWebhookDeletionResult.message}`)
                }
            }
            await guildConfigRecord.delete(guildId)
            return c.res({
                content: ":white_check_mark: サーバー設定が初期化されました。",
                embeds: [generateConfigTableEmbed(guildConfigInit)],
            })
        }
        case "sheets init": {
            if (guildConfig._sheet?.spreadsheetId) {
                return c.res(
                    `:warning: このサーバーには、すでに[連携されているスプレッドシート](https://docs.google.com/spreadsheets/d/${guildConfig._sheet.spreadsheetId})があります。上書きしようとしている場合は、先にこれを破棄してください。`,
                )
            }
            const interactionToken = c.interaction.token
            const requestToken = generateSecret(64)
            const sessionId = generateSecret(64)
            const session: SheetsOAuthSession = { guildId, interactionToken }
            await c.env.AuthNRequests.put(`requestToken:${requestToken}`, sessionId, {
                expirationTtl: requestTokenExpirationTtl,
            })
            await c.env.Sessions.put(sessionId, JSON.stringify(session), {
                expirationTtl: import.meta.env.DEV ? sessionExpirationTtlDev : sessionExpirationTtl,
            })
            const honoClient = hc<AppType>(c.env.ORIGIN)
            const oAuthUrl = honoClient.oauth.sheets.$url({ query: { token: requestToken } })
            const oAuthButtonLink = {
                label: "アクセスを許可",
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                emoji: c.env.DISCORD_APPLICATION_EMOJIS.g_logo,
                url: oAuthUrl.href,
            } as const satisfies APIButtonComponentWithURL
            return c.ephemeral(true).res({
                content: `:person_tipping_hand: アクセス許可が必要です。下のボタンからアプリにアクセス権を与えてください。
発行されたリンクは ${requestTokenExpirationTtl} 秒間、1 度だけ有効です。`,
                components: new Components().row(oAuthButtonLink),
            })
        }
        case "sheets show": {
            if (!guildConfig._sheet?.spreadsheetId) {
                return c.res(":warning: 連携されているスプレッドシートがありません。")
            }
            const sheetButtonLink = {
                label: "スプレッドシートを開く",
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                url: `https://docs.google.com/spreadsheets/d/${guildConfig._sheet.spreadsheetId}`,
            } as const satisfies APIButtonComponentWithURL
            return c.res({
                components: new Components().row(sheetButtonLink),
            })
        }
        case "sheets revoke": {
            if (!guildConfig._sheet?.spreadsheetId) {
                return c.res(":warning: 連携されているスプレッドシートがありません。")
            }
            const [{ options: sheetsRevokeOptions }] = (
                options[0] as APIApplicationCommandInteractionDataSubcommandGroupOption
            ).options as [
                {
                    name: string
                    type: ApplicationCommandOptionType.Subcommand
                    options: [APIApplicationCommandInteractionDataBooleanOption] | []
                },
            ]
            const hard = sheetsRevokeOptions[0]?.value ?? false
            if (hard) {
                const oAuth2Client = new google.auth.OAuth2({
                    clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
                    clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
                    credentials: {
                        access_token: guildConfig._sheet.accessToken,
                        refresh_token: guildConfig._sheet.refreshToken,
                    },
                })
                if (guildConfig._sheet.accessTokenExpiry <= Date.now()) {
                    const { credentials } = await oAuth2Client.refreshAccessToken()
                    /* eslint-disable @typescript-eslint/no-non-null-assertion */
                    guildConfig._sheet.accessToken = credentials.access_token!
                    guildConfig._sheet.accessTokenExpiry = credentials.expiry_date!
                    /* eslint-enable @typescript-eslint/no-non-null-assertion */
                }
                const drive = google.drive({ version: "v2", auth: oAuth2Client })
                const spreadsheetDeleteResponse = await drive.files
                    .trash({
                        fileId: guildConfig._sheet.spreadsheetId,
                        supportsAllDrives: true,
                    })
                    .catch(id<unknown, Error>)
                if (spreadsheetDeleteResponse instanceof Error) {
                    await reportErrorWithContext(spreadsheetDeleteResponse, errorContext, c.env)
                    return c.res(":x: ファイルをごみ箱に移動することができませんでした。")
                }
            }
            delete guildConfig._sheet.spreadsheetId
            await guildConfigRecord.put(guildId, JSON.stringify(guildConfig))
            return c.res(
                `:white_check_mark: ${hard ? "ファイルがごみ箱に移動され、" : ""}スプレッドシートとの連携が解除されました。`,
            )
        }
        default:
            return c.res(":x: このサブコマンドはサポートされていません。")
    }
}
