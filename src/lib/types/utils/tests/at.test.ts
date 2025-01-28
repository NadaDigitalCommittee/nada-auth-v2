/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { At } from "../at"

type TupleA = [42, "string", boolean, object, 334n]
type TupleB = [() => number, Record<string, unknown>, symbol]
test("At:positive index", () => {
    expectTypeOf(null! as At<TupleA, 2>).toMatchTypeOf<TupleA[2]>()
})
test("At:positive index (undefined)", () => {
    expectTypeOf(null! as At<TupleA, 1000>).toMatchTypeOf<undefined>()
})
test("At:negative index", () => {
    expectTypeOf(null! as At<TupleA, -3>).toMatchTypeOf<TupleA[2]>()
})
test("At:negative index (undefined)", () => {
    expectTypeOf(null! as At<TupleA, -1000>).toMatchTypeOf<undefined>()
})
test("At:union", () => {
    expectTypeOf(null! as At<TupleA | TupleB, -3 | 1 | 1000>).toMatchTypeOf<
        TupleA[2] | TupleA[1] | TupleB[0] | TupleB[1] | undefined
    >()
})
