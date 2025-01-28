/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { NegateBool, NegateNumber } from "../negate"

test("NegateNumber:positive number", () => {
    expectTypeOf(null! as NegateNumber<10>).toMatchTypeOf<-10>()
})
test("NegateNumber:0", () => {
    expectTypeOf(null! as NegateNumber<0>).toMatchTypeOf<0>()
})
test("NegateNumber:negative number", () => {
    expectTypeOf(null! as NegateNumber<-10>).toMatchTypeOf<10>()
})
test("NegateNumber:union", () => {
    expectTypeOf(null! as NegateNumber<-10 | 4 | -2 | 0>).toMatchTypeOf<10 | -4 | 2 | 0>()
})

test("NegateBool:true", () => {
    expectTypeOf(null! as NegateBool<true>).toMatchTypeOf<false>()
})
test("NegateBool:false", () => {
    expectTypeOf(null! as NegateBool<false>).toMatchTypeOf<true>()
})
test("NegateBool:union", () => {
    expectTypeOf(null! as NegateBool<boolean>).toMatchTypeOf<boolean>()
})
