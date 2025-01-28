/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Total } from "../total"

test("Total:positive numbers", () => {
    expectTypeOf(null! as Total<[4, 1, 5, 1, 45, 72]>).toMatchTypeOf<128>()
})
test("Total:union", () => {
    expectTypeOf(null! as Total<[4, 1, 3 | 4 | 5, 1, 45 | 34 | 22, 72]>).toMatchTypeOf<
        103 | 104 | 105 | 115 | 116 | 117 | 126 | 127 | 128
    >()
})
