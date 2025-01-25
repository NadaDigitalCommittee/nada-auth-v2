import type { BoolToNumber } from "./boolToNumber"
import type { DistributeUnionArray } from "./distribute-union-array"
import type { Multiply } from "./multiply"
import type { Power } from "./power"
import type { Reverse } from "./reverse"
import type { ToBoolMap } from "./toBool"
import type { Total } from "./total"

type CalcBitmaskEachPlace<T extends boolean[], Acc extends number[] = []> = T extends []
    ? Acc
    : T extends [infer Head extends boolean, ...infer Tail extends boolean[]]
      ? CalcBitmaskEachPlace<Tail, [...Acc, Multiply<BoolToNumber<Head>, Power<2, Acc["length"]>>]>
      : number[]

export type BoolTupleToBitmask<T extends boolean[]> = Total<CalcBitmaskEachPlace<Reverse<T>>>

type ValuesUnionToBitmask<TUnion extends unknown[]> = TUnion extends TUnion
    ? {
          bitmask: BoolTupleToBitmask<ToBoolMap<TUnion>>
          bindings: TUnion
      }
    : never

export type ValuesToBitmask<T extends unknown[]> = ValuesUnionToBitmask<DistributeUnionArray<T>>
