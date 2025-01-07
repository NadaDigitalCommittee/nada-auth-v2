import type { ValueOf } from "type-fest"

import type { GuildConfigRecord } from "@/lib/schema/kvNamespaces"

export const DISCORD_MESSAGE_MAX_LENGTH = 2000

export const requestTokenExpirationTtl = 60

export const sessionExpirationTtl = 300

export const sessionExpirationTtlDev = 86400

export const guildConfigKvKeyOf = {
    "authenticated-role": "authenticatedRoleId",
    nickname: "nicknameFormat",
    "logging-channel": "loggingChannelId",
} as const satisfies Record<string, keyof ValueOf<GuildConfigRecord>>

export const configSetOptionNameOf = Object.fromEntries(
    Object.entries(guildConfigKvKeyOf).map((pair) => pair.reverse()),
)

export const guildConfigInit = Object.fromEntries(
    Object.values(guildConfigKvKeyOf).map((kvKey) => [kvKey, null]),
)
