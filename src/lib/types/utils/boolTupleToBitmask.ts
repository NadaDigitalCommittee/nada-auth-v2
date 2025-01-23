import type { BoolToNumber } from "./boolToNumber"
import type { Multiply } from "./multiply"
import type { Power } from "./power"
import type { Reverse } from "./reverse"
import type { ToBool } from "./toBool"
import type { Total } from "./total"

type CalcBitmaskEachPlace<T extends boolean[], Acc extends number[] = []> = T extends []
    ? Acc
    : T extends [infer Head extends boolean, ...infer Tail extends boolean[]]
      ? CalcBitmaskEachPlace<Tail, [...Acc, Multiply<BoolToNumber<Head>, Power<2, Acc["length"]>>]>
      : number[]

export type BoolTupleToBitmask<T extends boolean[]> = Total<CalcBitmaskEachPlace<Reverse<T>>>

// n個のユニオンを分配する方法がわからないのでとりあえず2つ
export type ValuesPairToBitmask<T0, T1> = T0 extends infer _T0
    ? T1 extends infer _T1
        ? {
              bitmask: BoolTupleToBitmask<[ToBool<_T0>, ToBool<_T1>]>
              bindings: [_T0, _T1]
          }
        : never
    : never
