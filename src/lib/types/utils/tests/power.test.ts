/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Power } from "../power"

test("positive power of zero", () => {
    expectTypeOf(null! as Power<0, 2>).toMatchTypeOf<0>()
})

test("positive power of positive number", () => {
    expectTypeOf(null! as Power<7, 3>).toMatchTypeOf<343>()
})

test("positive even power of negative number", () => {
    expectTypeOf(null! as Power<-2, 4>).toMatchTypeOf<16>()
})
test("positive odd power of negative number", () => {
    expectTypeOf(null! as Power<-2, 5>).toMatchTypeOf<-32>()
})

test("union", () => {
    expectTypeOf(null! as Power<-2 | 3, 5 | 3 | 6>).toMatchTypeOf<-32 | -8 | 64 | 243 | 27 | 729>()
})
