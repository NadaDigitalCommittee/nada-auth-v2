import { ApplicationIntegrationType, PermissionFlagsBits } from "discord-api-types/v10"
import { Hono } from "hono"

import type { Env } from "@/lib/schema/env"

const oAuth2UrlOf = (() => {
    const permissions =
        PermissionFlagsBits.ManageRoles |
        PermissionFlagsBits.ManageWebhooks |
        PermissionFlagsBits.ManageNicknames |
        PermissionFlagsBits.SendMessages |
        PermissionFlagsBits.UseApplicationCommands
    const oAuth2Url = new URL("https://discord.com/oauth2/authorize")
    oAuth2Url.search = new URLSearchParams({
        permissions: `${permissions}`,
        integration_type: `${ApplicationIntegrationType.GuildInstall}`,
        scope: "bot",
    }).toString()
    return (clientId: string) => {
        oAuth2Url.searchParams.set("client_id", clientId)
        return oAuth2Url
    }
})()

const app = new Hono<Env>().get("/", (c) =>
    c.redirect(oAuth2UrlOf(c.env.DISCORD_APPLICATION_ID), 301),
)

/**
 * @package
 */
export { app as invite }
