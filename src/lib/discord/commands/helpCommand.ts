import {
    isChatInputApplicationCommandInteraction,
    isGuildInteraction,
} from "discord-api-types/utils"
import {
    type APIApplicationCommandInteraction,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    InteractionContextType,
    PermissionFlagsBits,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10"
import { Embed } from "discord-hono"

import type { CommandHandler } from "../types"

import type { Env } from "@/lib/schema/env"
import { inOperator } from "@/lib/utils/fp"

/**
 * @package
 */
export const command = {
    name: "help",
    description: "この Bot の使用法のヘルプ",
    contexts: [InteractionContextType.Guild],
    default_member_permissions: `${PermissionFlagsBits.Administrator}`,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: "config",
            description: "サーバー設定に関するヘルプ",
            options: [
                // {
                //     name: "authenticated-role",
                //     description: "設定 authenticated-role に関するヘルプ",
                //     type: ApplicationCommandOptionType.Subcommand,
                // },
                {
                    name: "nickname",
                    description: "設定 nickname に関するヘルプ",
                    type: ApplicationCommandOptionType.Subcommand,
                },
                // {
                //     name: "logging-channel",
                //     description: "設定 logging-channel に関するヘルプ",
                //     type: ApplicationCommandOptionType.Subcommand,
                // },
            ],
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "troubleshooting",
            description: "トラブルシューティング",
        },
    ],
} as const satisfies RESTPostAPIChatInputApplicationCommandsJSONBody

const helpDocs = {
    // "config authenticated-role": new Embed()
    //     .title("Help config authenticated-role")
    //     .description("このヘルプはまだ執筆されていません。")
    //     .color(0x00b0f4),
    "config nickname": new Embed()
        .title("Help config nickname")
        .description(
            `\`value\` にはフォーマット指定子を含んだ文字列を指定します。
使用できるフォーマット指定子は以下の通りです。\\* のついたものは生徒に対してのみ適用されます。`,
        )
        .fields(
            { name: "%g", value: "\\* 学年 (1, 2, 3)" },
            { name: "%G", value: "\\* 中高一貫の学年 (1, 2, 3, 4, 5, 6)" },
            { name: "%C", value: "\\* 回生" },
            { name: "%c", value: "\\* クラス" },
            { name: "%n", value: "\\* 出席番号" },
            { name: "%t", value: "\\* 学校種別 (中, 高)" },
            { name: "%L", value: "姓" },
            { name: "%F", value: "名" },
            { name: "%%", value: "パーセント記号のエスケープ" },
        )
        .color(0x00b0f4),
    // "config logging-channel": new Embed()
    //     .title("Help config logging-channel")
    //     .description("このヘルプはまだ執筆されていません。")
    //     .color(0x00b0f4),
    troubleshooting: new Embed()
        .title("Help troubleshooting")
        .fields(
            {
                name: "Missing Permissions というエラーが出てロールを付与できない",
                value: "この Bot のロールが対象のロールよりも下に配置されている可能性があります。ロールリストで順番を並べ替えてみてください。",
            },
            {
                name: "Missing Permissions というエラーが出てニックネームを変更できない",
                value: "対象者がサーバー所有者である場合、Discord の仕様上ニックネームを変更することはできません。",
            },
            {
                name: "設定データを正しく読み取れないというエラーが出る",
                value: "/config reset を実行して設定を初期化してみてください。ただし、このコマンドで初期化した設定を復元することはできません。",
            },
            {
                name: "Webhook を更新できない",
                value: "サーバー設定 > 連携サービス > nada-auth に該当の Webhook が存在する場合、それを削除してみてください。そうでない場合、/config reset を実行して設定を初期化してみてください。ただし、このコマンドで初期化した設定を復元することはできません。",
            },
        )
        .color(0x00b0f4),
} as const satisfies Record<string, Embed>

/**
 * @package
 */
export const handler: CommandHandler<Env> = (c) => {
    const interaction = c.interaction as APIApplicationCommandInteraction
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    if (!isChatInputApplicationCommandInteraction(interaction))
        return c.res(":x: このコマンドはサポートされていません。")
    if (inOperator(c.sub.string, helpDocs)) return c.res({ embeds: [helpDocs[c.sub.string]] })
    else return c.res(":x: このコマンドはサポートされていません。")
}
