import type { Subtract } from "type-fest"

import type { NegateBool, NegateNumber } from "./negate"
import type { RepeatArray } from "./repeatArray"

type PowerHelper<
    B extends number,
    E extends number,
    Count extends unknown[] = [unknown],
    Sign extends boolean = `${B}` extends `-${number}` ? false : true,
> = number extends E
    ? number
    : `${B}` extends `-${infer A extends number}`
      ? E extends 0
          ? Sign extends false
              ? Count["length"]
              : NegateNumber<Count["length"]>
          : PowerHelper<B, Subtract<E, 1>, RepeatArray<Count, A>, NegateBool<Sign>>
      : E extends 0
        ? Count["length"]
        : PowerHelper<B, Subtract<E, 1>, RepeatArray<Count, B>, Sign>

// 整数の非負整数乗のみ
export type Power<B extends number, E extends number> = B extends B
    ? B extends 0 | 1
        ? B
        : PowerHelper<B, E>
    : never
