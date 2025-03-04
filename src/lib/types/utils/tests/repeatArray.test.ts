/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { RepeatArray } from "../repeatArray"

type TupleA = [42, "string", boolean, object, 334n]
type TupleB = [() => number, Record<string, unknown>, symbol]
test("RepeatArray:0", () => {
    expectTypeOf(null! as RepeatArray<TupleA, 0>).toEqualTypeOf<[]>()
})

test("RepeatArray:positive number", () => {
    expectTypeOf(null! as RepeatArray<TupleA, 3>).toEqualTypeOf<[...TupleA, ...TupleA, ...TupleA]>()
})
test("RepeatArray:negative number", () => {
    expectTypeOf(null! as RepeatArray<TupleA, -3>).toEqualTypeOf<[]>()
})
test("RepeatArray:union", () => {
    expectTypeOf(null! as RepeatArray<TupleA | TupleB, 2 | 3>).toEqualTypeOf<
        | [...TupleA, ...TupleA]
        | [...TupleA, ...TupleA, ...TupleA]
        | [...TupleB, ...TupleB]
        | [...TupleB, ...TupleB, ...TupleB]
    >()
})
