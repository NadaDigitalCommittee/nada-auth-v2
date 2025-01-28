import type { ArrayValues, IsNegative, Subtract } from "type-fest"

type RepeatArrayHelper<
    A extends unknown[],
    N extends number,
    D extends unknown[] = A,
> = number extends N
    ? ArrayValues<A>[]
    : IsNegative<N> extends true
      ? []
      : N extends 0
        ? []
        : N extends 1
          ? A
          : RepeatArrayHelper<[...A, ...D], Subtract<N, 1>, D>

export type RepeatArray<A extends unknown[], N extends number> = A extends A
    ? RepeatArrayHelper<A, N>
    : never
