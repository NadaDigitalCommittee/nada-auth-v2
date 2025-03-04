/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { NegateBool, NegateNumber } from "../negate"

test("NegateNumber:positive number", () => {
    expectTypeOf(null! as NegateNumber<10>).toEqualTypeOf<-10>()
})
test("NegateNumber:0", () => {
    expectTypeOf(null! as NegateNumber<0>).toEqualTypeOf<0>()
})
test("NegateNumber:negative number", () => {
    expectTypeOf(null! as NegateNumber<-10>).toEqualTypeOf<10>()
})
test("NegateNumber:union", () => {
    expectTypeOf(null! as NegateNumber<-10 | 4 | -2 | 0>).toEqualTypeOf<10 | -4 | 2 | 0>()
})

test("NegateBool:true", () => {
    expectTypeOf(null! as NegateBool<true>).toEqualTypeOf<false>()
})
test("NegateBool:false", () => {
    expectTypeOf(null! as NegateBool<false>).toEqualTypeOf<true>()
})
test("NegateBool:union", () => {
    expectTypeOf(null! as NegateBool<boolean>).toBeBoolean()
})
