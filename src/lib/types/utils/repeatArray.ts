import type { ArrayValues, Subtract } from "type-fest"

type PrivateRepeatArray<
    A extends unknown[],
    N extends number,
    D extends unknown[] = A,
> = number extends N
    ? ArrayValues<A>[]
    : N extends 0
      ? []
      : N extends 1
        ? A
        : PrivateRepeatArray<[...A, ...D], Subtract<N, 1>, D>

export type RepeatArray<A extends unknown[], N extends number> = PrivateRepeatArray<A, N>
