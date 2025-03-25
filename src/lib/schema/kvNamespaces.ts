import * as v from "valibot"

import { $APIUser, $APIWebhook, $Snowflake } from "./discord"
import { $NadaAcWorkSpacePartialUser } from "./nadaAc"

export const $GuildId = $Snowflake
export const $GuildConfig = v.object({
    authenticatedRoleId: v.nullable($Snowflake),
    nicknameFormat: v.nullable(v.string()),
    loggingChannelId: v.nullable($Snowflake),
    _loggingWebhook: v.optional($APIWebhook),
    _signInButtonWebhook: v.optional($APIWebhook),
})
export const $GuildConfigRecord = v.record($GuildId, $GuildConfig)
export type GuildConfigRecord = v.InferOutput<typeof $GuildConfigRecord>

export const $Session = v.object({
    guildId: $Snowflake,
    user: $APIUser,
    interactionToken: v.string(),
    userProfile: v.optional($NadaAcWorkSpacePartialUser),
    state: v.optional(v.string()),
    nonce: v.optional(v.string()),
})
export const $SessionId = v.string()
export const $SessionRecord = v.record($SessionId, $Session)
export type SessionRecord = v.InferOutput<typeof $SessionRecord>
const AuthNRequestKeyPrefixes = ["userId", "requestToken"] as const satisfies string[]
export const $RequestToken = v.pipe(v.string(), v.nonEmpty())
export const $AuthNRequestRecord = v.record(
    v.union(
        AuthNRequestKeyPrefixes.map((keyPrefix) =>
            v.custom<`${typeof keyPrefix}:${string}`>(
                (input) => typeof input === "string" && new RegExp(`^${keyPrefix}:.+$`).test(input),
            ),
        ),
    ),
    $SessionId,
)
export type AuthNRequestRecord = v.InferOutput<typeof $AuthNRequestRecord>

/* eslint-disable @typescript-eslint/no-unnecessary-type-arguments */
export type KVNamespaces = {
    GuildConfigs: KVNamespace<keyof GuildConfigRecord>
    AuthNRequests: KVNamespace<keyof AuthNRequestRecord>
    Sessions: KVNamespace<keyof SessionRecord>
}
