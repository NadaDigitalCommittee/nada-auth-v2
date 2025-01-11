import type { CommandContext, ComponentContext, ModalContext } from "discord-hono"

import type { UnknownEnv } from "@/lib/schema/env"

/**
 * @package
 */
export type CommandHandler<E extends UnknownEnv> = (
    c: CommandContext<E>,
) => Promise<Response> | Response

/**
 * @package
 */
export type ComponentHandler<E extends UnknownEnv> = (
    c: ComponentContext<E>,
) => Promise<Response> | Response

/**
 * @package
 */
export type ModalHandler<E extends UnknownEnv> = (
    c: ModalContext<E>,
) => Promise<Response> | Response
