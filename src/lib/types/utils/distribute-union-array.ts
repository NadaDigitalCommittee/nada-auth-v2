import type { IsNever, IsTuple } from "type-fest"

// https://github.com/type-challenges/type-challenges/issues/11761
export type DistributeUnionArray<T extends unknown[]> =
    IsTuple<T> extends true
        ? T extends [infer Head, ...infer Tail]
            ? // HeadがneverのときにHead extends Headの部分で空のユニオンを分配することになってneverが返ってしまうのを防ぐ
              IsNever<Head> extends true
                ? [Head, ...DistributeUnionArray<Tail>]
                : Head extends Head
                  ? [Head, ...DistributeUnionArray<Tail>]
                  : never
            : []
        : T
