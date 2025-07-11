import type { API } from "@discordjs/core/http-only"
import type { Env as EnvPrimitive } from "hono"
import type { UnknownRecord } from "type-fest"
import * as v from "valibot"

import { $APIPartialEmoji, $Snowflake } from "./discord"

import type { KVNamespaces } from "@/lib/schema/kvNamespaces"

const $DiscordApplicationEmojis = v.object({
    g_logo: v.intersect([
        $APIPartialEmoji,
        v.object({
            name: v.literal("g_logo"),
            id: $Snowflake,
        }),
    ]),
})
const $AllowedEmailDomains = v.array(v.string())

export const $EnvVars = v.object({
    DISCORD_TOKEN: v.string(),
    DISCORD_APPLICATION_ID: v.string(),
    DISCORD_PUBLIC_KEY: v.string(),
    DISCORD_APPLICATION_EMOJIS: v.union([
        $DiscordApplicationEmojis, // 2回目以降の読み込み
        v.pipe(v.string(), v.parseJson(), $DiscordApplicationEmojis), // 初回の読み込み
    ]),
    GOOGLE_OAUTH_CLIENT_ID: v.string(),
    GOOGLE_OAUTH_CLIENT_SECRET: v.string(),
    GOOGLE_PICKER_API_KEY: v.string(),
    GOOGLE_CLOUD_PROJECT_NUMBER: v.string(),
    ALLOWED_EMAIL_DOMAINS: v.union([
        $AllowedEmailDomains,
        v.pipe(v.string(), v.parseJson(), $AllowedEmailDomains),
    ]),
    ORIGIN: v.string(),
})
export interface Env extends EnvPrimitive {
    Bindings: { ASSETS: Fetcher } & KVNamespaces & v.InferOutput<typeof $EnvVars>
    Variables: { discord: API } & UnknownRecord
}
export interface UnknownEnv extends EnvPrimitive {
    Bindings?: Record<string, unknown>
    Variables?: Record<string, unknown>
}
