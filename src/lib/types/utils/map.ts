import type { UnknownMap } from "type-fest"

export type MapKeyOf<M extends UnknownMap> = M extends ReadonlyMap<infer K, unknown> ? K : never
export type MapValueOf<M extends UnknownMap> = M extends ReadonlyMap<unknown, infer V> ? V : never
