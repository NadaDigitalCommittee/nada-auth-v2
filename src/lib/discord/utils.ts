import { REST } from "@discordjs/rest"
import {
    type APIGuildMember,
    type APIUser,
    ApplicationCommandOptionType,
    type RESTGetAPIGuildPreviewResult,
    Routes,
    type Snowflake,
} from "discord-api-types/v10"

import type { Env } from "../schema/env"
import type { InteractionsNSPath } from "./structure"

type PrettifyOptionValueArgsTypeBase =
    | [string, "String" | "Role" | "User"]
    | [string, "Channel"]
    // | [string, "Mentionable"] // 未実装
    | [number, "Integer" | "Number"]
    | [boolean, "Boolean"]
type BuildPrettifyOptionValueArgsType<T extends PrettifyOptionValueArgsTypeBase> = T extends [
    infer V0,
    infer V1 extends keyof typeof ApplicationCommandOptionType,
]
    ? [V0 | null, (typeof ApplicationCommandOptionType)[V1], { defaultValue?: string }?]
    : never

/**
 * @package
 */
export const prettifyOptionValue = (
    ...[
        optionValue,
        optionValueType,
        additionalData,
    ]: BuildPrettifyOptionValueArgsType<PrettifyOptionValueArgsTypeBase>
): string => {
    if (optionValue == null) return additionalData?.defaultValue ?? "null"
    switch (optionValueType) {
        case ApplicationCommandOptionType.String:
        case ApplicationCommandOptionType.Integer:
        case ApplicationCommandOptionType.Number:
        case ApplicationCommandOptionType.Boolean:
            return `${optionValue}`
        case ApplicationCommandOptionType.Channel:
            return `<#${optionValue}>`
        case ApplicationCommandOptionType.Role:
            return `<@&${optionValue}>`
        case ApplicationCommandOptionType.User:
            return `<@${optionValue}>`
    }
}

export class AvatarUrl {
    private pathname: string

    constructor(pathname: string) {
        this.pathname = pathname
    }

    getUrl(urlWithOrigin: string | URL) {
        const avatarUrl = new URL(urlWithOrigin)
        avatarUrl.protocol = "https:"
        avatarUrl.search = ""
        avatarUrl.hash = ""
        avatarUrl.pathname = this.pathname
        return avatarUrl
    }
}

export const loggingWebhookAvatarUrlOf = (urlWithOrigin: string | URL) =>
    new AvatarUrl("/assets/u1fa84_u1f525.webp").getUrl(urlWithOrigin)

export const signInButtonWebhookDefaultAvatarUrlOf = (urlWithOrigin: string | URL) =>
    new AvatarUrl("/assets/u1fa84_u1f4e3.webp").getUrl(urlWithOrigin)

export interface ErrorContext {
    guildId?: Snowflake
    member?: APIGuildMember
    user?: APIUser
    path?: InteractionsNSPath
    [key: string]: unknown
}
export const reportErrorWithContext = async (
    error: Error,
    context: ErrorContext,
    env: Env["Bindings"],
) => {
    const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN)
    const guildPreview =
        context.guildId &&
        ((await rest
            .get(Routes.guildPreview(context.guildId))
            .catch(
                (e: unknown) => (console.error(e), null),
            )) as RESTGetAPIGuildPreviewResult | null)
    console.error({
        error,
        context: { ...context, guild: guildPreview },
    })
}
