import { API } from "@discordjs/core/http-only"
import { channelMention, roleMention, userMention } from "@discordjs/formatters"
import { CDN, DiscordAPIError, REST } from "@discordjs/rest"
import {
    type APIApplicationCommandInteractionDataBasicOption,
    type APIEmbed,
    type APIGuildMember,
    type APIUser,
    type APIWebhook,
    ApplicationCommandOptionType,
    type Snowflake,
} from "discord-api-types/v10"
import { Embed } from "discord-hono"
import type { Context } from "hono"

import type { Env } from "../schema/env"
import { orNull } from "../utils/exceptions"
import { DISCORD_EMBEDS_MAX_COUNT, loggingWebhookAvatarPath } from "./constants"
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
    const optionValueString = `${optionValue}`
    switch (optionValueType) {
        case ApplicationCommandOptionType.String:
        case ApplicationCommandOptionType.Integer:
        case ApplicationCommandOptionType.Number:
        case ApplicationCommandOptionType.Boolean:
            return optionValueString
        case ApplicationCommandOptionType.Channel:
            return channelMention(optionValueString)
        case ApplicationCommandOptionType.Role:
            return roleMention(optionValueString)
        case ApplicationCommandOptionType.User:
            return userMention(optionValueString)
    }
}

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
    const discord = new API(new REST({ version: "10" }).setToken(env.DISCORD_TOKEN))
    const guildPreview =
        context.guildId && (await discord.guilds.getPreview(context.guildId).catch(orNull))
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

    private discord: API

    private logStack: APIEmbed[]

    private context: Context<Env>

    constructor({
        context,
        webhook,
        author,
        timestampInSeconds,
    }: {
        context: Context<Env>
        webhook: APIWebhook | undefined
        author: APIUser
        timestampInSeconds: number
    }) {
        this.webhook = webhook
        this.author = author
        this.context = context
        this.timestamp = new Date(timestampInSeconds * 1000)
        this.discord = new API(new REST({ version: "10" }).setToken(context.env.DISCORD_TOKEN))
        this.avatarUrl = new URL(loggingWebhookAvatarPath, context.env.ORIGIN)
        this.logStack = []
    }

    static readonly colors: Record<LogLevel, number> = {
        error: 0xda373c,
        warn: 0xffcc00,
        info: 0x5865f2,
    }

    private log(level: LogLevel, embed: LoggerLogParamEmbed) {
        this.logStack.push({
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
        })
    }

    error(embed: LoggerLogParamEmbed) {
        this.log(LogLevel.error, embed)
    }

    warn(embed: LoggerLogParamEmbed) {
        this.log(LogLevel.warn, embed)
    }

    info(embed: LoggerLogParamEmbed) {
        this.log(LogLevel.info, embed)
    }

    [Symbol.dispose]() {
        if (!this.webhook?.token) return
        while (this.logStack.length) {
            const chunk = this.logStack.splice(0, DISCORD_EMBEDS_MAX_COUNT)
            this.context.executionCtx.waitUntil(
                this.discord.webhooks
                    .execute(this.webhook.id, this.webhook.token, {
                        avatar_url: this.avatarUrl.href,
                        embeds: chunk,
                    })
                    .catch((error: unknown) => {
                        if (error instanceof Error) {
                            console.error({
                                at: "Logger",
                                error,
                            })
                        }
                    }),
            )
        }
    }
}

export type CommandInteractionDataBasicOptionTypeToOptionValueType<
    T extends APIApplicationCommandInteractionDataBasicOption["type"],
> = Extract<APIApplicationCommandInteractionDataBasicOption, { type: T }>["value"]

export const quoteEachLine = (content: string) => content.replace(/^/gm, "> ")
