type NegAt<T extends unknown[], I extends number, Count extends unknown[] = [unknown]> = T extends [
    ...infer Init,
    infer Last,
]
    ? Count["length"] extends I
        ? Last
        : NegAt<Init, I, [...Count, unknown]>
    : undefined

export type At<T extends unknown[], I extends number> = I extends infer J extends number
    ? `${J}` extends `-${infer A extends number}`
        ? NegAt<T, A>
        : T[J]
    : never
