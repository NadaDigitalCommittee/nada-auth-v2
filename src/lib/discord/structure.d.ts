import type {
    APIMessageComponent,
    RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10"
import type { Join } from "type-fest"

import type { Commands, Components, Modals } from "."
import type { CommandHandler, ComponentHandler, ModalHandler } from "./types"

import type { UnknownEnv } from "@/lib/schema/env"
import type { ReadonlyForEach } from "@/lib/types/utils"

type PathTuple<
    T extends Record<string, unknown>,
    TEndpoint extends Record<string, unknown>,
> = keyof T extends infer KeyT extends string
    ? {
          // 共変になるので、ジェネリック型に包含関係が伝播する
          [K in KeyT]: ReadonlyForEach<T[K]> extends ReadonlyForEach<TEndpoint>
              ? [K, keyof TEndpoint]
              : T[K] extends Record<string, unknown>
                ? [K, ...PathTuple<T[K], TEndpoint>]
                : never
      }[KeyT]
    : never
type DotPath<T extends Record<string, unknown>, TEndpoint extends Record<string, unknown>> = Join<
    PathTuple<T, TEndpoint>,
    "."
>

type CommandNSSchema = {
    command: RESTPostAPIApplicationCommandsJSONBody
    handler: CommandHandler<UnknownEnv>
}

type ComponentNSSchema = {
    component: APIMessageComponent
    handler: ComponentHandler<UnknownEnv>
}

type ModalNSSchema = {
    modal: APIModalInteractionResponseCallbackData
    handler: ModalHandler<UnknownEnv>
}

export type CommandNSPath = `Commands.${DotPath<typeof Commands, CommandNSSchema>}`
export type ComponentNSPath = `Components.${DotPath<typeof Components, ComponentNSSchema>}`
export type ModalNSPath = `Modals.${DotPath<typeof Modals, ModalNSSchema>}`

export type InteractionsNSPath = CommandNSPath | ComponentNSPath | ModalNSPath
