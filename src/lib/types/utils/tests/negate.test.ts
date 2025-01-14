/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { NegateBool, NegateNumber } from "../negate"

test("negate positive number", () => {
    expectTypeOf(null! as NegateNumber<10>).toMatchTypeOf<-10>()
})
test("negate 0", () => {
    expectTypeOf(null! as NegateNumber<0>).toMatchTypeOf<0>()
})
test("negate negative number", () => {
    expectTypeOf(null! as NegateNumber<-10>).toMatchTypeOf<10>()
})
test("negateBool: union", () => {
    expectTypeOf(null! as NegateNumber<-10 | 4 | -2 | 0>).toMatchTypeOf<10 | -4 | 2 | 0>()
})

test("negate true", () => {
    expectTypeOf(null! as NegateBool<true>).toMatchTypeOf<false>()
})
test("negate false", () => {
    expectTypeOf(null! as NegateBool<false>).toMatchTypeOf<true>()
})
test("negateBool: union", () => {
    expectTypeOf(null! as NegateBool<boolean>).toMatchTypeOf<boolean>()
})
