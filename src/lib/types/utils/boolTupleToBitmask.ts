import type { BoolToNumber } from "./boolToNumber"
import type { Multiply } from "./multiply"
import type { Power } from "./power"
import type { Reverse } from "./reverse"
import type { Sequence } from "./sequence"
import type { ToBool } from "./toBool"
import type { Total } from "./total"

type IndexBitPair = [number, 0 | 1]
type BoolTupleToIndexBitPairs<
    T extends boolean[],
    Seq extends number[] = Sequence<T["length"]>,
> = boolean[] extends T
    ? IndexBitPair[]
    : Seq extends [infer Head extends number, ...infer Tail extends number[]]
      ? [[Head, BoolToNumber<T[Head]>], ...BoolTupleToIndexBitPairs<T, Tail>]
      : []

type CalcBitmaskEachPlaceForIndexBitPairs<T extends IndexBitPair[]> = T extends [
    infer Head extends IndexBitPair,
    ...infer Tail extends IndexBitPair[],
]
    ? [Multiply<Head[1], Power<2, Head[0]>>, ...CalcBitmaskEachPlaceForIndexBitPairs<Tail>]
    : []

export type BoolTupleToBitmask<T extends boolean[]> = Total<
    CalcBitmaskEachPlaceForIndexBitPairs<BoolTupleToIndexBitPairs<Reverse<T>>>
>

// n個のユニオンを分配する方法がわからないのでとりあえず2つ
export type ValuesPairToBitmask<T0, T1> = T0 extends infer _T0
    ? T1 extends infer _T1
        ? {
              bitmask: BoolTupleToBitmask<[ToBool<_T0>, ToBool<_T1>]>
              bindings: [_T0, _T1]
          }
        : never
    : never
