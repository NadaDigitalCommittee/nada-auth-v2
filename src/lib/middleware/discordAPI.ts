import { API } from "@discordjs/core/http-only"
import { REST } from "@discordjs/rest"
import { createMiddleware } from "hono/factory"

import { type Env } from "@/lib/schema/env"

export const discordAPI = createMiddleware<Env>(async (c, next) => {
    c.set("discord", new API(new REST({ version: "10" }).setToken(c.env.DISCORD_TOKEN)))
    await next()
})
