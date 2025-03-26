import type { Writable } from "type-fest"

type UnknownMap = Map<unknown, unknown> | ReadonlyMap<unknown, unknown>
export type MapKeyOf<M extends UnknownMap> = Writable<M> extends Map<infer K, unknown> ? K : never
export type MapValueOf<M extends UnknownMap> = Writable<M> extends Map<unknown, infer V> ? V : never
