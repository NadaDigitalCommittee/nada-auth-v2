import type { ArrayValues } from "type-fest"

import type { DistributeUnionArray } from "./distribute-union-array"

export type UnknownObjectEntry = [PropertyKey, unknown]

// https://scrapbox.io/elecdeer-pub/TypeScriptでObject.fromEntriesの様な関数に強い型を付ける
export type FromEntries<T extends UnknownObjectEntry[]> = FromEntriesHelper<
    DistributeUnionArray<ArrayValues<T>>
>

type FromEntriesHelper<T extends UnknownObjectEntry> = {
    [K in T[0]]: Extract<T, [K, unknown]>[1]
}
