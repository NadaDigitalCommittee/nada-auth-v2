/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { BoolToNumber } from "../boolToNumber"

test("boolToNumber:true", () => {
    expectTypeOf(null! as BoolToNumber<true>).toMatchTypeOf<1>()
})
test("boolToNumber:false", () => {
    expectTypeOf(null! as BoolToNumber<false>).toMatchTypeOf<0>()
})
test("boolToNumber:boolean", () => {
    expectTypeOf(null! as BoolToNumber<boolean>).toMatchTypeOf<0 | 1>()
})
