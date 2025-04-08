import type { IsTuple } from "type-fest"
import type { UnknownArrayOrTuple } from "type-fest/source/internal"

/**
 * タプル型に対するArray#mapで返り値のタプル型を維持する
 */
export type ArrayMap<TArray extends UnknownArrayOrTuple, TTransformed> = TArray extends TArray
    ? IsTuple<TArray> extends true
        ? { [K in keyof TArray]: TTransformed }
        : TTransformed[]
    : never
