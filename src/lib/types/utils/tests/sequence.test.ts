/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Sequence } from "../sequence"

test("length", () => {
    expectTypeOf(null! as Sequence<8>).toMatchTypeOf<[0, 1, 2, 3, 4, 5, 6, 7]>()
})

test("length and start", () => {
    expectTypeOf(null! as Sequence<8, 5>).toMatchTypeOf<[5, 6, 7, 8, 9, 10, 11, 12]>()
})
