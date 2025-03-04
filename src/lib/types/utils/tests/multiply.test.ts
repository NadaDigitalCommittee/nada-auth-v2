/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Multiply } from "../multiply"

test("Multiply:natural number times natural number", () => {
    expectTypeOf(null! as Multiply<2, 3>).toEqualTypeOf<6>()
})
test("Multiply:0 times natural number", () => {
    expectTypeOf(null! as Multiply<0, 3>).toEqualTypeOf<0>()
})
test("Multiply:union", () => {
    expectTypeOf(null! as Multiply<5 | 4 | 1, 3 | 2>).toEqualTypeOf<15 | 10 | 12 | 8 | 3 | 2>()
})
