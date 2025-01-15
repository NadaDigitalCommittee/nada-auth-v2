import type { ArrayValues } from "type-fest"

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
    [K in ArrayValues<T>[0]]: ExtractTupleWithFirstUnionDistributed<ArrayValues<T>, [K, unknown]>[1]
}
