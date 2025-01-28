import type { ArrayValues } from "type-fest"

import type { DistributeUnionArray } from "./distribute-union-array"

export type UnknownObjectEntry = [PropertyKey, unknown]

// https://scrapbox.io/elecdeer-pub/TypeScriptでObject.fromEntriesの様な関数に強い型を付ける
export type FromEntries<T extends UnknownObjectEntry[]> = FromEntriesHelper<
    DistributeUnionArray<ArrayValues<T>>
>

/**
 * @see {@link https://github.com/oven-sh/bun/issues/9337}
 * 
 * (なぜこんなユーティリティがあるかの説明) `globalThis`の`BroadcastChannel`, `MessageChannel`, `MessagePort`の3つのプロパティは
 * \@types/nodeの型定義ファイル [node_modules/@types/node/worker_threads.d.ts]({@link ./../../../../node_modules/@types/node/worker_threads.d.ts}) (@types/bunの依存) を参照している。
 * 定義はどれも
 * ```ts
var MessageChannel: typeof globalThis extends {
    onmessage: any;
    MessageChannel: infer T;
} ? T
    : typeof _MessageChannel;
``` 
 * のようになっていて、[`globalThis.onmessage`は`never`として存在する]({@link ./../../../../node_modules/@cloudflare/workers-types/2023-07-01/index.d.ts})
 * ので条件をみたすが、型推論がそれ自身に再帰しているのでコンパイラが型を解決できず、見かけ上`any`と評価される。
 * ただしこれは[errorTypeのany]({@link https://zenn.dev/qnighy/articles/64145f6ff849e5#errortype})なので、
```ts
const channel = new MessageChannel()
//    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Unsafe assignment of an error typed value. eslint (@typescript-eslint/no-unsafe-assignment)
//    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Unsafe construction of a(n) `error` type typed value. eslint (@typescript-eslint/no-unsafe-call)
```
 * anyTypeより強く伝播する。
 * まず、テストケースの型`FromEntries<Entries<typeof globalThis>>`を解決する際に、`["MessageChannel", any]`のようなエントリが紛れこむ。
 * これが`DistributeUnionArray`に渡されると、
 * - 1回目の再帰は正常に処理され、`["MessageChannel", ...DistributeUnionArray<[any]>]`が評価される。
 * - 2回目の再帰で`DistributeUnionArray<[any]>`を評価する際、`Head`に`any`、`Tail`に`[]`が割り当てられるが、ここで`Head`の`any` (errorType) が伝播し、全体として`any`が返る。
 * - 最終的に`["MessageChannel", ...any[]]`が返る。`any`が`any[]`と解釈されるのはたぶんrest要素型の仕様
 * 
 * となり、タプルではなくなる。ここから`[K, unknown]`を抽出することはできないので、`Entries`と`FromEntries`を重ねがけすることでこれらのプロパティの`any` (errorType) は`never`に変換されてしまう。
 * これを防ぐために、`ObjectEntry`に合致する部分を抽出することが必要になる。
*/
type ExtractObjectEntry<T extends UnknownObjectEntry> = T extends UnknownObjectEntry
    ? T
    : [T[0], T[1]]

type FromEntriesHelper<T extends UnknownObjectEntry> = {
    [K in T[0]]: Extract<ExtractObjectEntry<T>, [K, unknown]>[1]
}
