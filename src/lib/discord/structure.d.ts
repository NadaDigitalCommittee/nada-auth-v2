import type {
    APIMessageComponent,
    RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10"

import type { Commands, Components } from "."
import type { Env } from "../schema/env"
import type { CommandHandler, ComponentHandler } from "./types"

type DotPath<
    T extends Record<string, unknown>,
    TEndpoint extends Record<string, unknown>,
> = keyof T extends infer KeyT extends string
    ? {
          [K in KeyT]: `${K}.${T[K] extends TEndpoint
              ? keyof TEndpoint extends infer KeyTEndpoint extends string
                  ? KeyTEndpoint
                  : never
              : T[K] extends Record<string, unknown>
                ? DotPath<T[K], TEndpoint>
                : never}`
      }[KeyT]
    : never

type CommandNSSchema = {
    command: RESTPostAPIApplicationCommandsJSONBody
    handler: CommandHandler<Env>
}

type ComponentNSSchema = {
    component: APIMessageComponent
    handler: ComponentHandler<Env>
}

export type CommandNSPath = `Commands.${DotPath<typeof Commands, CommandNSSchema>}`
export type ComponentNSPath = `Components.${DotPath<typeof Components, ComponentNSSchema>}`

export type InteractionsNSPath = CommandNSPath | ComponentNSPath
