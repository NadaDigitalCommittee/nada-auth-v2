import type { Sum } from "type-fest"

export type Total<A extends number[]> = A extends []
    ? 0
    : A extends [infer Head extends number, ...infer Tail extends number[]]
      ? Sum<Head, Total<Tail>>
      : never
