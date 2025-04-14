import { ApplicationIntegrationType, PermissionFlagsBits } from "discord-api-types/v10"
import { Hono } from "hono"

import type { Env } from "@/lib/schema/env"

const app = new Hono<Env>().get("/", (c) => {
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
        client_id: c.env.DISCORD_APPLICATION_ID,
    }).toString()
    return c.redirect(oAuth2Url, 301)
})

/**
 * @package
 */
export { app as invite }
