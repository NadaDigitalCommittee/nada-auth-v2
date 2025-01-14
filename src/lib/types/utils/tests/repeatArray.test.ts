/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { RepeatArray } from "../repeatArray"

test("x0", () => {
    expectTypeOf(null! as RepeatArray<["First", "Second", "Third"], 0>).toMatchTypeOf<[]>()
})

test("x3", () => {
    expectTypeOf(null! as RepeatArray<["First", "Second", "Third"], 3>).toMatchTypeOf<
        ["First", "Second", "Third", "First", "Second", "Third", "First", "Second", "Third"]
    >()
})
