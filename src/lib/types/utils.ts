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

// https://zenn.dev/8times12/articles/ff08c1fac412c9
export type Entries<T extends object> = (keyof T extends infer U
    ? U extends keyof T
        ? [U, T[U]]
        : never
    : never)[]

type ExtractTupleWithFirstUnionDistributed<TUnion extends unknown[], TShape> = TUnion extends [
    infer P,
    ...infer Q,
]
    ? P extends infer R
        ? Extract<[R, ...Q], TShape>
        : never
    : never

// https://scrapbox.io/elecdeer-pub/TypeScriptでObject.fromEntriesの様な関数に強い型を付ける
export type FromEntries<T extends [PropertyKey, unknown][]> = {
    [K in T[number][0]]: ExtractTupleWithFirstUnionDistributed<T[number], [K, unknown]>[1]
}

export type Reverse<T extends unknown[]> = T extends [infer Head, ...infer Tail]
    ? [...Reverse<Tail>, Head]
    : []

export type EmptyObject = Record<PropertyKey, never>
