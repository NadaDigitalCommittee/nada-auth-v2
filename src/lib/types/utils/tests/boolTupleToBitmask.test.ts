/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { BoolTupleToBitmask, ValuesToBitmask } from "../boolTupleToBitmask"

test("BoolTupleToBitmask:base", () => {
    expectTypeOf(
        null! as BoolTupleToBitmask<[true, false, false, true, false, false, true]>,
    ).toEqualTypeOf<0b1001001>()
})
test("BoolTupleToBitmask:union", () => {
    expectTypeOf(
        null! as BoolTupleToBitmask<[true, boolean, boolean, true, false, false, true]>,
    ).toEqualTypeOf<0b1001001 | 0b1011001 | 0b1101001 | 0b1111001>()
})

test("ValuesToBitmask:union", () => {
    type Bitmask = ValuesToBitmask<["ABC" | "" | null, object | undefined]>
    type ExtractBitmaskFor<Bindings> = Extract<
        Bitmask,
        {
            bindings: Bindings
        }
    >["bitmask"]
    expectTypeOf(null! as ExtractBitmaskFor<[null, undefined]>).toEqualTypeOf<0b00>()
    expectTypeOf(null! as ExtractBitmaskFor<["", undefined]>).toEqualTypeOf<0b00>()
    expectTypeOf(null! as ExtractBitmaskFor<[null, object]>).toEqualTypeOf<0b01>()
    expectTypeOf(null! as ExtractBitmaskFor<["", object]>).toEqualTypeOf<0b01>()
    expectTypeOf(null! as ExtractBitmaskFor<["ABC", undefined]>).toEqualTypeOf<0b10>()
    expectTypeOf(null! as ExtractBitmaskFor<["ABC", object]>).toEqualTypeOf<0b11>()
})
