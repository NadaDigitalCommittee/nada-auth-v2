import type { CommandContext, ComponentContext } from "discord-hono"

import type { Env } from "@/lib/schema/env"

/**
 * @package
 */
export type CommandHandler<E extends Env> = (c: CommandContext<E>) => Promise<Response> | Response

/**
 * @package
 */
export type ComponentHandler<E extends Env> = (
    c: ComponentContext<E>,
) => Promise<Response> | Response
