import type { Sum } from "type-fest"

type PrivateSequence<
    Length extends number,
    Start extends number,
    T extends unknown[] = [],
> = T["length"] extends Length ? T : PrivateSequence<Length, Start, [...T, Sum<T["length"], Start>]>

export type Sequence<Length extends number, Start extends number = 0> = PrivateSequence<
    Length,
    Start
>
