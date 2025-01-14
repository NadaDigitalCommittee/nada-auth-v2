/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"

import type { BoolTupleToBitmask, ValuesPairToBitmask } from "../boolTupleToBitmask"

test("BoolTupleToBitmask", () => {
    expectTypeOf(
        null! as BoolTupleToBitmask<[true, false, false, true, false, false, true]>,
    ).toMatchTypeOf<0b1001001>()
})

test("BoolTupleToBitmask:union", () => {
    expectTypeOf(
        null! as BoolTupleToBitmask<[true, boolean, boolean, true, false, false, true]>,
    ).toMatchTypeOf<0b1001001 | 0b1011001 | 0b1101001 | 0b1111001>()
})

test("ValuesPairToBitmask:union", () => {
    expectTypeOf(null! as ValuesPairToBitmask<"ABC" | "" | null, object | undefined>).toMatchTypeOf<
        | {
              bitmask: 0b00
              bindings: [null, undefined]
          }
        | {
              bitmask: 0b00
              bindings: ["", undefined]
          }
        | {
              bitmask: 0b01
              bindings: [null, object]
          }
        | {
              bitmask: 0b01
              bindings: ["", object]
          }
        | {
              bitmask: 0b10
              bindings: ["ABC", undefined]
          }
        | {
              bitmask: 0b11
              bindings: ["ABC", object]
          }
    >()
})
