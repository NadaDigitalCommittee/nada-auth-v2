/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { Reverse } from "../reverse"

test("Reverse:base", () => {
    expectTypeOf(null! as Reverse<[42, "string", boolean, object, 334n]>).toEqualTypeOf<
        [334n, object, boolean, "string", 42]
    >()
})
