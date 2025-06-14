import { API } from "@discordjs/core/http-only"
import { blockQuote, channelMention, subtext, userMention } from "@discordjs/formatters"
import { REST } from "@discordjs/rest"
import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandBasicOption,
    type APIApplicationCommandInteractionDataBooleanOption,
    type APIApplicationCommandInteractionDataStringOption,
    type APIApplicationCommandInteractionDataSubcommandGroupOption,
    type APIApplicationCommandStringOption,
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
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10"
import { type CommandHandler, Components, Embed } from "discord-hono"
import { OAuth2Client } from "google-auth-library"
import { drive_v3 } from "googleapis/build/src/apis/drive/v3"
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
import type { MapKeyOf, MapValueOf } from "@/lib/types/utils/map"
import { id } from "@/lib/utils/fp"
import { generateSecret } from "@/lib/utils/secret"

const configSetOptions = [
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
                description: "厳格モードを有効にします。既定で無効です。",
                type: ApplicationCommandOptionType.Boolean,
                required: false,
            },
        ],
    },
    {
        name: "profile-fallback",
        description: "プロフィール情報のフォールバック",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "value",
                description:
                    "厳格モードが無効でプロフィール情報が合致しなかった場合に、ユーザー入力にフォールバックします。既定で有効です。",
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

const configOptionBase = {
    type: ApplicationCommandOptionType.String,
    name: "name",
    description: "設定項目",
    autocomplete: false,
    choices: [...guildConfigOptionNameToKvKeyMap.keys().map((name) => ({ name, value: name }))],
} as const satisfies APIApplicationCommandStringOption

const configGetOptions = [
    { ...configOptionBase, required: false },
] as const satisfies APIApplicationCommandStringOption[]

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
            options: configGetOptions,
        },
        {
            name: "set",
            description: "Bot のサーバー設定を変更します。",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: configSetOptions,
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
                    name: "unlink",
                    description: "スプレッドシートとの連携を解除します。",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: "hard",
                            description: "ファイルも破棄します。既定で無効です。",
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

const generateConfigTableEmbed = (
    config: GuildConfig,
    keys: MapValueOf<typeof guildConfigOptionNameToKvKeyMap>[] = [
        ...guildConfigOptionNameToKvKeyMap.values(),
    ],
) =>
    new Embed().fields(
        ...Object.entries({ ...guildConfigInit, ...config }).reduce<APIEmbedField[]>((acc, cur) => {
            const isInternalConfigEntry = (
                entry: [string, unknown],
            ): entry is [`_${string}`, unknown] => entry[0].startsWith("_")
            if (!isInternalConfigEntry(cur)) {
                const [configKvKey, optionValue] = cur
                if (!keys.includes(configKvKey)) return acc
                const optionName = guildConfigKvKeyToOptionNameMap.get(configKvKey)
                const optionValueType = guildConfigOptionNameToOptionTypeMap.get(optionName)
                acc.push({
                    name: optionName,
                    value: prettifyOptionValue(optionValue, optionValueType, {
                        defaultValue: subtext("none"),
                    }),
                    inline: true,
                } satisfies APIEmbedField)
            }
            return acc
        }, []),
    )

/**
 * @package
 */
export const handler: CommandHandler<Env> = async (c) => {
    const guildConfigRecord = c.env.GuildConfigs
    const discord = new API(new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN))
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
        c.executionCtx.waitUntil(guildConfigRecord.delete(guildId))
        return c.res(
            ":x: サーバーの設定データを正しく読み取れなかったため、インタラクションを正常に処理できませんでした。設定は初期化されました。",
        )
    }
    const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
    if (!guildConfigParseResult.success) {
        await reportErrorWithContext(
            new v.ValiError(guildConfigParseResult.issues),
            errorContext,
            c.env,
        )
        c.executionCtx.waitUntil(guildConfigRecord.delete(guildId))
        return c.res(
            ":x: サーバーの設定データを正しく読み取れなかったため、インタラクションを正常に処理できませんでした。設定は初期化されました。",
        )
    }
    const guildConfig = guildConfigParseResult.output
    // TODO: リテラルではなく、commandから生成
    // TODO: ネストを浅くする
    switch (c.sub.string) {
        case "get": {
            const [{ options: configGetOptionData }] = options as [
                {
                    name: "get"
                    type: ApplicationCommandOptionType.Subcommand
                    options: [APIApplicationCommandInteractionDataStringOption] | []
                },
            ]
            const configOption = configGetOptionData[0]?.value
            if (!configOption) return c.res({ embeds: [generateConfigTableEmbed(guildConfig)] })
            if (!guildConfigOptionNameToKvKeyMap.has(configOption)) {
                return c.res("この設定はサポートされていません。")
            }
            const guildConfigKvKey = guildConfigOptionNameToKvKeyMap.get(configOption)
            return c.res({ embeds: [generateConfigTableEmbed(guildConfig, [guildConfigKvKey])] })
        }
        case "set logging-channel":
        case "set strict":
        case "set profile-fallback": {
            const subcommandName = c.sub.string.split(" ").at(-1)
            const subcommandOptionOption = (
                options[0] as APIApplicationCommandInteractionDataSubcommandGroupOption
            ).options[0]?.options?.[0]
            const subcommandOptionOptionValue = subcommandOptionOption?.value
            const guildConfigKvKey = guildConfigOptionNameToKvKeyMap.get(subcommandName)
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
                    const webhookModificationResult = await discord.webhooks
                        .edit(loggingWebhook.id, {
                            channel_id: channelOptionValue,
                        })
                        .catch(id<unknown, Error>)
                    if (webhookModificationResult instanceof Error) {
                        await reportErrorWithContext(webhookModificationResult, errorContext, c.env)
                        return c.res(
                            `:x: Webhook ${userMention(loggingWebhook.id)} を更新できませんでした。\n理由: \n${blockQuote(webhookModificationResult.message)}`,
                        )
                    }
                    guildConfig._loggingWebhook = webhookModificationResult
                } else if (isPresent(loggingWebhook) && !isPresent(channelOptionValue)) {
                    // すでに webhook が作成されていて、それを削除する場合
                    const webhookDeletionResult = await discord.webhooks
                        .delete(loggingWebhook.id)
                        .catch(id<unknown, Error>)
                    if (webhookDeletionResult instanceof Error) {
                        await reportErrorWithContext(webhookDeletionResult, errorContext, c.env)
                        return c.res(
                            `:x: Webhook ${userMention(loggingWebhook.id)} を削除できませんでした。\n理由: \n${blockQuote(webhookDeletionResult.message)}`,
                        )
                    }
                    delete guildConfig._loggingWebhook
                } else if (!isPresent(loggingWebhook) && isPresent(channelOptionValue)) {
                    // webhook がまだ作成されておらず、新たに作る場合
                    const webhookCreationResult = await discord.channels
                        .createWebhook(channelOptionValue, {
                            name: "nada-auth logging",
                        })
                        .catch(id<unknown, Error>)
                    if (webhookCreationResult instanceof Error) {
                        await reportErrorWithContext(webhookCreationResult, errorContext, c.env)
                        return c.res(
                            `:x: チャンネル ${channelMention(channelOptionValue)} に Webhook を作成できませんでした。\n理由: \n${blockQuote(webhookCreationResult.message)}`,
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
            c.executionCtx.waitUntil(
                guildConfigRecord.put(
                    guildId,
                    JSON.stringify(
                        Object.assign(guildConfig, {
                            [guildConfigKvKey]: subcommandOptionOptionValue,
                        }),
                    ),
                ),
            )
            return c.res({
                content: ":white_check_mark: サーバー設定が更新されました。",
                embeds: [generateConfigTableEmbed(guildConfig)],
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
            c.executionCtx.waitUntil(
                Promise.all([
                    c.env.AuthNRequests.put(`requestToken:${requestToken}`, sessionId, {
                        expirationTtl: requestTokenExpirationTtl,
                    }),
                    c.env.Sessions.put(sessionId, JSON.stringify(session), {
                        expirationTtl: import.meta.env.DEV
                            ? sessionExpirationTtlDev
                            : sessionExpirationTtl,
                    }),
                ]),
            )
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
                content: `:person_tipping_hand: アクセス許可が必要です。下のボタンからアプリにアクセス権を与えてください。\n発行されたリンクは ${requestTokenExpirationTtl} 秒間、1 度だけ有効です。`,
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
        case "sheets unlink": {
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
                const oAuth2Client = new OAuth2Client({
                    clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
                    clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
                    credentials: {
                        access_token: guildConfig._sheet.accessToken,
                        refresh_token: guildConfig._sheet.refreshToken,
                    },
                })
                if (guildConfig._sheet.accessTokenExpiry <= Date.now()) {
                    const accessTokenRefreshResponse = await oAuth2Client
                        .refreshAccessToken()
                        .catch(id<unknown, Error>)
                    if (accessTokenRefreshResponse instanceof Error) {
                        return c.res(
                            ":x: スプレッドシートにアクセスするための資格情報を取得できませんでした。",
                        )
                    }
                    const { credentials } = accessTokenRefreshResponse
                    /* eslint-disable @typescript-eslint/no-non-null-assertion */
                    guildConfig._sheet.accessToken = credentials.access_token!
                    guildConfig._sheet.accessTokenExpiry = credentials.expiry_date!
                    /* eslint-enable @typescript-eslint/no-non-null-assertion */
                }
                const drive = new drive_v3.Drive({ auth: oAuth2Client })
                const spreadsheetDeleteResponse = await drive.files
                    .update({
                        fileId: guildConfig._sheet.spreadsheetId,
                        requestBody: {
                            trashed: true,
                        },
                        supportsAllDrives: true,
                    })
                    .catch(id<unknown, Error>)
                if (spreadsheetDeleteResponse instanceof Error) {
                    await reportErrorWithContext(spreadsheetDeleteResponse, errorContext, c.env)
                    return c.res(":x: ファイルをごみ箱に移動することができませんでした。")
                }
            }
            delete guildConfig._sheet.spreadsheetId
            c.executionCtx.waitUntil(guildConfigRecord.put(guildId, JSON.stringify(guildConfig)))
            return c.res(
                `:white_check_mark: ${hard ? "ファイルがごみ箱に移動され、" : ""}スプレッドシートとの連携が解除されました。`,
            )
        }
        default:
            return c.res(":x: このサブコマンドはサポートされていません。")
    }
}
