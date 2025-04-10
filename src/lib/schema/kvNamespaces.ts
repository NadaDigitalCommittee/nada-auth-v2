import * as v from "valibot"

import { id } from "../utils/fp"
import { $APIUser, $APIWebhook, $Snowflake } from "./discord"
import { $NadaAcWorkSpacePartialUser } from "./nadaAc"

export const $GuildId = $Snowflake
export const $GuildConfig = v.object({
    loggingChannelId: v.optional($Snowflake),
    strictIntegrityCheck: v.optional(v.boolean()),
    _sheet: v.optional(
        v.object({
            spreadsheetId: v.optional(v.string()),
            refreshToken: v.string(),
            accessToken: v.string(),
            accessTokenExpiry: v.number(),
        }),
    ),
    _loggingWebhook: v.optional($APIWebhook),
    _signInButtonWebhook: v.optional($APIWebhook),
})
export const $GuildConfigRecord = v.record($GuildId, $GuildConfig)
export type GuildConfig = v.InferOutput<typeof $GuildConfig>
export type GuildConfigRecord = v.InferOutput<typeof $GuildConfigRecord>

export const $SessionId = v.string()
export const $Session = v.object({
    guildId: $Snowflake,
    user: $APIUser,
    roles: v.array($Snowflake),
    interactionToken: v.string(),
    userProfile: v.optional($NadaAcWorkSpacePartialUser),
    state: v.optional(v.string()),
    nonce: v.optional(v.string()),
})
export const $SessionRecord = v.record($SessionId, $Session)
export type Session = v.InferOutput<typeof $Session>
export type SessionRecord = v.InferOutput<typeof $SessionRecord>
export const $SheetsOAuthSession = v.object({
    guildId: $Snowflake,
    interactionToken: v.string(),
    state: v.optional(v.string()),
    accessToken: v.optional(v.string()),
})
export const $SheetsOAuthSessionRecord = v.record($SessionId, $SheetsOAuthSession)
export type SheetsOAuthSession = v.InferOutput<typeof $SheetsOAuthSession>
export type SheetsOAuthSessionRecord = v.InferOutput<typeof $SheetsOAuthSessionRecord>

const AuthNRequestKeyPrefixes = ["userId", "requestToken"] as const satisfies string[]
export const $RequestToken = v.string()
export const $AuthNRequest = v.union(
    AuthNRequestKeyPrefixes.map((keyPrefix) =>
        v.pipe(
            v.string(),
            v.startsWith(`${keyPrefix}:`),
            v.transform(id<string, `${typeof keyPrefix}:${string}`>),
        ),
    ),
)
export const $AuthNRequestRecord = v.record($AuthNRequest, $SessionId)
export type AuthNRequest = v.InferOutput<typeof $AuthNRequest>
export type AuthNRequestRecord = v.InferOutput<typeof $AuthNRequestRecord>

/* eslint-disable @typescript-eslint/no-unnecessary-type-arguments, @typescript-eslint/no-duplicate-type-constituents */
export type KVNamespaces = {
    GuildConfigs: KVNamespace<keyof GuildConfigRecord>
    AuthNRequests: KVNamespace<keyof AuthNRequestRecord>
    Sessions: KVNamespace<keyof SessionRecord | keyof SheetsOAuthSessionRecord>
}
