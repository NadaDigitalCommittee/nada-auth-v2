import type { UnknownArrayOrTuple } from "type-fest/source/internal"

/**
 * タプル型に対するArray#mapで返り値のタプル型を維持する
 */
export type ArrayMap<TArray extends UnknownArrayOrTuple, TTransformed> = {
    [K in keyof TArray]: TTransformed
}
