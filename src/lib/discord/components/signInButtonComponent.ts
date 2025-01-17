import { isGuildInteraction } from "discord-api-types/utils"
import {
    type APIButtonComponentWithCustomId,
    type APIButtonComponentWithURL,
    ButtonStyle,
    ComponentType,
} from "discord-api-types/v10"
import { type ComponentHandler, Components } from "discord-hono"
import { hc } from "hono/client"
import type { ValueOf } from "type-fest"
import * as v from "valibot"

import {
    guildConfigInit,
    requestTokenExpirationTtl,
    sessionExpirationTtl,
    sessionExpirationTtlDev,
} from "../constants"
import { type ErrorContext, reportErrorWithContext } from "../utils"

import type { AppType } from "@/app"
import type { Env } from "@/lib/schema/env"
import { $GuildConfig, type SessionRecord } from "@/lib/schema/kvNamespaces"
import { shouldBeError } from "@/lib/utils/exceptions"
import { generateSecret } from "@/lib/utils/secret"

/**
 * @package
 */
export const component = {
    custom_id: "signIn",
    label: "認証を受ける",
    type: ComponentType.Button,
    style: ButtonStyle.Primary,
} as const satisfies APIButtonComponentWithCustomId

/**
 * @package
 */
export const handler: ComponentHandler<Env> = async (c) => {
    const guildConfigRecord = c.env.GuildConfigs
    const authNRequestRecord = c.env.AuthNRequests
    const sessionRecord = c.env.Sessions
    const { interaction } = c
    if (!isGuildInteraction(interaction)) return c.res(":x: この機能はサーバーでのみ使用できます。")
    const { guild_id: guildId, member, token: interactionToken } = interaction
    const { user } = member
    const errorContext = {
        guildId,
        member,
        path: "Components.signInButton.handler",
    } as const satisfies ErrorContext
    const rawGuildConfig = await guildConfigRecord.get(guildId, "json").catch(shouldBeError)
    if (rawGuildConfig instanceof Error) {
        await reportErrorWithContext(rawGuildConfig, errorContext, c.env)
        return c
            .ephemeral(true)
            .res(
                ":x: サーバーの設定データが正しい形式ではなかったため、このインタラクションに失敗しました。",
            )
    }
    const guildConfigParseResult = v.safeParse($GuildConfig, rawGuildConfig ?? guildConfigInit)
    if (!guildConfigParseResult.success) {
        await reportErrorWithContext(
            new v.ValiError(guildConfigParseResult.issues),
            errorContext,
            c.env,
        )
        return c
            .ephemeral(true)
            .res(
                ":x: サーバーの設定データが正しい形式ではなかったため、このインタラクションに失敗しました。",
            )
    }
    const guildConfig = guildConfigParseResult.output
    if (
        guildConfig.authenticatedRoleId &&
        interaction.member.roles.includes(guildConfig.authenticatedRoleId)
    ) {
        return c.ephemeral(true).res(":person_tipping_hand: あなたはすでに認証が完了しています。")
    }
    const userAuthNRequest = await authNRequestRecord.get(`userId:${user.id}`)
    if (userAuthNRequest && c.env.WORKER_ENV !== "development")
        return c.ephemeral(true).res(
            ":warning: 現在の認証セッションが完了または失効する前に重複してリクエストを行うことはできません。\
リンクを破棄してしまった場合は、時間をおいて再試行してください。",
        )
    const authNRequestToken = generateSecret(64)
    const sessionId = generateSecret(64)
    const session: ValueOf<SessionRecord> = { guildId, user, interactionToken }
    await authNRequestRecord.put(`userId:${user.id}`, sessionId, {
        expirationTtl: sessionExpirationTtl,
    })
    await authNRequestRecord.put(`requestToken:${authNRequestToken}`, sessionId, {
        expirationTtl: requestTokenExpirationTtl,
    })
    await sessionRecord.put(sessionId, JSON.stringify(session), {
        expirationTtl:
            c.env.WORKER_ENV === "development" ? sessionExpirationTtlDev : sessionExpirationTtl,
    })
    const honoClient = hc<AppType>(new URL(c.req.url).origin)
    const authNUrl = honoClient.authn.$url({ query: { token: authNRequestToken } })
    authNUrl.protocol = "https:"
    const signInButtonLink = {
        label: "Google でサインイン",
        type: ComponentType.Button,
        style: ButtonStyle.Link,
        emoji: c.env.DISCORD_APPLICATION_EMOJIS.g_logo,
        url: authNUrl.href,
    } as const satisfies APIButtonComponentWithURL
    return c.ephemeral(true).res({
        content: `発行されたリンクは ${requestTokenExpirationTtl} 秒間、1 度だけ有効です。`,
        components: new Components().row(signInButtonLink),
    })
}
