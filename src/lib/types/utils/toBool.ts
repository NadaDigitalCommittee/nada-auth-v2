import type { IsAny, IsTuple, IsUnknown } from "type-fest"

import type { Falsy } from "./falsy"

export type ToBool<T> = boolean extends T
    ? boolean
    : number extends T
      ? boolean
      : bigint extends T
        ? boolean
        : string extends T
          ? boolean
          : IsAny<T> extends true
            ? boolean
            : IsUnknown<T> extends true
              ? boolean
              : T extends Falsy
                ? false
                : true

export type ToBoolMap<T extends unknown[]> =
    IsTuple<T> extends true
        ? T extends [infer Head, ...infer Tail]
            ? [ToBool<Head>, ...ToBoolMap<Tail>]
            : []
        : boolean[]
