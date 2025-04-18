import type { NonEmptyTuple } from "type-fest"

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const id = <TInput, TOutput extends TInput = TInput>(input: TInput): TOutput =>
    input as TOutput
export const constant =
    <T>(input: T) =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_: unknown) =>
        input
/**
 * @description Narrowing
 */
export const inOperator = <T extends object>(key: PropertyKey, obj: T): key is keyof T => key in obj

export interface Pipe {
    <A, B>(fn0: (input: A) => B): (input: A) => B
    <A, B, C>(fn0: (input: A) => B, fn1: (input: NoInfer<B>) => C): (input: A) => C
    <A, B, C, D>(
        fn0: (input: A) => B,
        fn1: (input: NoInfer<B>) => C,
        fn2: (input: NoInfer<C>) => D,
    ): (input: A) => D
    <A, B, C, D, E>(
        fn0: (input: A) => B,
        fn1: (input: NoInfer<B>) => C,
        fn2: (input: NoInfer<C>) => D,
        fn3: (input: NoInfer<D>) => E,
    ): (input: A) => E
}

export const pipe: Pipe =
    (...fns: NonEmptyTuple<(input: unknown) => unknown>) =>
    (input: unknown) =>
        fns.reduce((acc, fn) => fn(acc), input)
