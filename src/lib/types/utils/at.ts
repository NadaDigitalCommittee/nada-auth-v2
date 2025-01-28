import type { Reverse } from "./reverse"

export type At<T extends unknown[], I extends number> = I extends I
    ? `${I}` extends `-${infer A extends number}`
        ? [unknown, ...Reverse<T>][A]
        : T[I]
    : never
