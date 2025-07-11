import type { GuildConfig } from "@/lib/schema/kvNamespaces"

export const DISCORD_WEBHOOK_NAME_MAX_LENGTH = 80

export const DISCORD_BUTTON_LABEL_MAX_LENGTH = 80

/**
 * https://discord.com/developers/docs/reference#image-data
 */
export const DISCORD_AVATAR_IMAGE_ALLOWED_MIME = /image\/(jpeg|png|gif)/

/**
 * https://discord.com/developers/docs/resources/webhook#execute-webhook-jsonform-params
 */
export const DISCORD_EMBEDS_MAX_COUNT = 10

export const requestTokenExpirationTtl = 60

export const sessionExpirationTtl = 300

export const sessionExpirationTtlDev = 86400

const guildConfigOptionMapBase = [
    ["logging-channel", "loggingChannelId"],
    ["strict", "strictIntegrityCheck"],
    ["profile-fallback", "profileFallback"],
] as const satisfies [string, keyof GuildConfig][]
export const guildConfigOptionNameToKvKeyMap = new ReadonlyMap(guildConfigOptionMapBase)
export const guildConfigKvKeyToOptionNameMap = new ReadonlyMap(
    guildConfigOptionMapBase.map(([p0, p1]) => [p1, p0] as const),
)

export const guildConfigInit = {
    loggingChannelId: undefined,
    strictIntegrityCheck: false,
    profileFallback: true,
} satisfies GuildConfig

export const loggingWebhookAvatarPath = "/assets/u1fa84_u1f525.webp"
export const signInButtonWebhookAvatarPath = "/assets/u1fa84_u1f4e3.webp"
