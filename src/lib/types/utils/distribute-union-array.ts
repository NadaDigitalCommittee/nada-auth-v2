import type { IsTuple } from "type-fest"

// https://github.com/type-challenges/type-challenges/issues/11761
export type DistributeUnionArray<T extends unknown[]> =
    IsTuple<T> extends true
        ? T extends [infer Head, ...infer Tail]
            ? Head extends Head
                ? [Head, ...DistributeUnionArray<Tail>]
                : never
            : []
        : T
