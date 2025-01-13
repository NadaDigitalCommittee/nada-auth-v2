import type { IsTuple } from "type-fest"

export type Reverse<T extends unknown[]> =
    IsTuple<T> extends true
        ? T extends [infer Head, ...infer Tail]
            ? [...Reverse<Tail>, Head]
            : []
        : T
