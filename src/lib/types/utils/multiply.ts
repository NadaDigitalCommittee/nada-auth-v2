import type { BuildTuple } from "type-fest/source/internal"

import type { RepeatArray } from "./repeatArray"

// 非負整数どうしのみ
export type Multiply<M extends number, N extends number> = M extends M
    ? RepeatArray<BuildTuple<M>, N>["length"]
    : never
