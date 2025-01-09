import { register } from "discord-hono"
import * as v from "valibot"

import { Commands } from "@/lib/discord"
import { $EnvVars } from "@/lib/schema/env"

const env = v.parse($EnvVars, Bun.env)
// eslint-disable-next-line no-console
console.log("Registering commands...")
await register(
    Object.values(Commands).map((c) => c.command),
    env.DISCORD_APPLICATION_ID,
    env.DISCORD_TOKEN,
)
