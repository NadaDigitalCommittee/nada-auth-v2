/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Multiply } from "../multiply"

test("Multiply:natural number times natural number", () => {
    expectTypeOf(null! as Multiply<2, 3>).toMatchTypeOf<6>()
})
test("Multiply:0 times natural number", () => {
    expectTypeOf(null! as Multiply<0, 3>).toMatchTypeOf<0>()
})
test("Multiply:union", () => {
    expectTypeOf(null! as Multiply<5 | 4 | 1, 3 | 2>).toMatchTypeOf<15 | 10 | 12 | 8 | 3 | 2>()
})
