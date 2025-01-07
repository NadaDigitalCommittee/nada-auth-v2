import { ApplicationCommandOptionType } from "discord-api-types/v10"

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
    ? [
          V0 | null,
          (typeof ApplicationCommandOptionType)[V1],
          { guildId: string; defaultValue?: string },
      ]
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
    if (optionValue == null) return additionalData.defaultValue ?? "null"
    switch (optionValueType) {
        case ApplicationCommandOptionType.String:
        case ApplicationCommandOptionType.Integer:
        case ApplicationCommandOptionType.Number:
        case ApplicationCommandOptionType.Boolean:
            return `${optionValue}`
        case ApplicationCommandOptionType.Channel:
            return `https://discord.com/channels/${additionalData.guildId}/${optionValue}`
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

export const serverRulesWebhookAvatarUrlOf = (urlWithOrigin: string | URL) =>
    new AvatarUrl("/assets/u1fa84_u1f4e3.webp").getUrl(urlWithOrigin)
