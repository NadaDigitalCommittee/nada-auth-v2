import type { GuildConfig } from "@/lib/schema/kvNamespaces"

export const DISCORD_WEBHOOK_NAME_MAX_LENGTH = 80

export const DISCORD_BUTTON_LABEL_MAX_LENGTH = 80

/**
 * https://discord.com/developers/docs/reference#image-data
 */
export const DISCORD_AVATAR_IMAGE_ALLOWED_MIME = /image\/(jpeg|png|gif)/

export const requestTokenExpirationTtl = 60

export const sessionExpirationTtl = 300

export const sessionExpirationTtlDev = 86400

export const guildConfigKvKeyOf = {
    "authenticated-role": "authenticatedRoleId",
    nickname: "nicknameFormat",
    "logging-channel": "loggingChannelId",
} as const satisfies Record<string, keyof GuildConfig>

export const configSetOptionNameOf = Object.fromEntries(
    Object.entries(guildConfigKvKeyOf).map((pair) => pair.reverse()),
)

export const guildConfigInit = Object.fromEntries(
    Object.values(guildConfigKvKeyOf).map((kvKey) => [kvKey, null]),
)
