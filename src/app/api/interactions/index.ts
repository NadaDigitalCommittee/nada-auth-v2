import { DiscordHono } from "discord-hono"

import { Commands, Components, Modals } from "@/lib/discord"
import type { Env } from "@/lib/schema/env"

const app = new DiscordHono<Env>()
Object.values(Commands).forEach((commandNS) => {
    app.command(commandNS.command.name, commandNS.handler)
})
Object.values(Components).forEach((componentNS) => {
    app.component(componentNS.component.custom_id, componentNS.handler)
})
Object.values(Modals).forEach((modalNS) => {
    app.modal(modalNS.modal.custom_id, modalNS.handler)
})

/**
 * @package
 */
export { app as interactions }
