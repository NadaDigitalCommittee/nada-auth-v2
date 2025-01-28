/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"
import type { UnknownRecord } from "type-fest"

import type { Entries } from "../entries"
import type { FromEntries } from "../fromEntries"

test("Entries/FromEntries:globalThis", () => {
    expectTypeOf(globalThis).toMatchTypeOf<FromEntries<Entries<typeof globalThis>>>()
})
test("Entries/FromEntries:emptyObject", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    expectTypeOf({}).toMatchTypeOf<FromEntries<Entries<{}>>>()
})
test("Entries/FromEntries:UnknownRecord", () => {
    expectTypeOf(null! as UnknownRecord).toMatchTypeOf<FromEntries<Entries<UnknownRecord>>>()
})
