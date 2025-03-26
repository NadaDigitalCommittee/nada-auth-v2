import { CDN, DiscordAPIError, REST } from "@discordjs/rest"
import {
    type APIApplicationCommandInteractionDataBasicOption,
    type APIEmbed,
    type APIGuildMember,
    type APIUser,
    type APIWebhook,
    ApplicationCommandOptionType,
    type RESTGetAPIGuildPreviewResult,
    type RESTPostAPIWebhookWithTokenJSONBody,
    Routes,
    type Snowflake,
} from "discord-api-types/v10"
import { Embed } from "discord-hono"
import type { Context } from "hono"

import type { Env } from "../schema/env"
import type { InteractionsNSPath } from "./structure"

/**
 * @package
 */
export const prettifyOptionValue = <
    T extends Exclude<
        APIApplicationCommandInteractionDataBasicOption["type"],
        ApplicationCommandOptionType.Attachment | ApplicationCommandOptionType.Mentionable
    >,
>(
    optionValue: CommandInteractionDataBasicOptionTypeToOptionValueType<T> | undefined,
    optionValueType: T,
    additionalData?: { defaultValue?: string },
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

export const getDiscordAPIErrorMessage = (e: unknown) =>
    e instanceof DiscordAPIError ? e.message : "Unknown Error"

export enum LogLevel {
    error = "error",
    warn = "warn",
    info = "info",
}

export type LoggerLogParamEmbed = Omit<APIEmbed, "author" | "footer" | "timestamp" | "color">

export class Logger {
    private webhook: APIWebhook | undefined

    private avatarUrl: URL

    private author: APIUser

    private timestamp: Date

    private rest: REST

    constructor(options: {
        context: Context<Env>
        webhook: APIWebhook | undefined
        author: APIUser
        timestampInSeconds: number
    }) {
        this.webhook = options.webhook
        this.author = options.author
        this.timestamp = new Date(options.timestampInSeconds * 1000)
        this.rest = new REST({ version: "10" }).setToken(options.context.env.DISCORD_TOKEN)
        this.avatarUrl = loggingWebhookAvatarUrlOf(options.context.req.url)
    }

    static readonly colors: Record<LogLevel, number> = {
        error: 0xda373c,
        warn: 0xffcc00,
        info: 0x5865f2,
    }

    private async log(level: LogLevel, embed: LoggerLogParamEmbed) {
        if (this.webhook) {
            await this.rest.post(Routes.webhook(this.webhook.id, this.webhook.token), {
                body: {
                    avatar_url: this.avatarUrl.href,
                    embeds: [
                        {
                            ...embed,
                            ...new Embed()
                                .author({
                                    name: this.author.username,
                                    icon_url: this.author.avatar
                                        ? new CDN().avatar(this.author.id, this.author.avatar)
                                        : undefined,
                                })
                                .footer({ text: `ID: ${this.author.id}` })
                                .timestamp(this.timestamp.toISOString())
                                .color(Logger.colors[level])
                                .toJSON(),
                        },
                    ],
                } satisfies RESTPostAPIWebhookWithTokenJSONBody,
            })
        }
    }

    async error(embed: LoggerLogParamEmbed) {
        await this.log(LogLevel.error, embed)
    }

    async warn(embed: LoggerLogParamEmbed) {
        await this.log(LogLevel.warn, embed)
    }

    async info(embed: LoggerLogParamEmbed) {
        await this.log(LogLevel.info, embed)
    }
}

export type CommandInteractionDataBasicOptionTypeToOptionValueType<
    T extends APIApplicationCommandInteractionDataBasicOption["type"],
> = Extract<APIApplicationCommandInteractionDataBasicOption, { type: T }>["value"]
