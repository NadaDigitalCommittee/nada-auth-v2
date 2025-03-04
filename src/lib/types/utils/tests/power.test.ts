/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Power } from "../power"

test("Power:positive power of zero", () => {
    expectTypeOf(null! as Power<0, 2>).toEqualTypeOf<0>()
})
test("Power:positive power of positive number", () => {
    expectTypeOf(null! as Power<7, 3>).toEqualTypeOf<343>()
})
test("Power:positive even power of negative number", () => {
    expectTypeOf(null! as Power<-2, 4>).toEqualTypeOf<16>()
})
test("Power:positive odd power of negative number", () => {
    expectTypeOf(null! as Power<-2, 5>).toEqualTypeOf<-32>()
})

test("Power:union", () => {
    expectTypeOf(null! as Power<-2 | 3, 5 | 3 | 6>).toEqualTypeOf<-32 | -8 | 64 | 243 | 27 | 729>()
})
