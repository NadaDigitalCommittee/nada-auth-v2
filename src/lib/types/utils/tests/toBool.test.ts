/* eslint-disable @typescript-eslint/no-wrapper-object-types */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"
import type { UnknownArray, UnknownRecord } from "type-fest"

import type { ToBool } from "../toBool"

test("unknown", () => {
    expectTypeOf(null! as ToBool<unknown>).toMatchTypeOf<boolean>()
})
test("any", () => {
    expectTypeOf(null! as ToBool<any>).toMatchTypeOf<boolean>()
})
test("number", () => {
    expectTypeOf(null! as ToBool<number>).toMatchTypeOf<boolean>()
})
test("string", () => {
    expectTypeOf(null! as ToBool<string>).toMatchTypeOf<boolean>()
})

test("object", () => {
    expectTypeOf(null! as ToBool<object>).toMatchTypeOf<true>()
})
test("{}", () => {
    expectTypeOf(null! as ToBool<{}>).toMatchTypeOf<boolean>()
})
test("Object", () => {
    expectTypeOf(null! as ToBool<Object>).toMatchTypeOf<boolean>()
})

test("symbol", () => {
    expectTypeOf(null! as ToBool<symbol>).toMatchTypeOf<true>()
})

test("truthy string", () => {
    expectTypeOf(null! as ToBool<"ABC">).toMatchTypeOf<true>()
})
test("falsy string", () => {
    expectTypeOf(null! as ToBool<"">).toMatchTypeOf<false>()
})
test("union of truthy and falsy strings", () => {
    expectTypeOf(null! as ToBool<"" | "ABC">).toMatchTypeOf<boolean>()
})

test("truthy number", () => {
    expectTypeOf(null! as ToBool<10>).toMatchTypeOf<true>()
})
test("falsy number", () => {
    expectTypeOf(null! as ToBool<0>).toMatchTypeOf<false>()
})
test("truthy bigint", () => {
    expectTypeOf(null! as ToBool<10n>).toMatchTypeOf<true>()
})
test("falsy bigint", () => {
    expectTypeOf(null! as ToBool<0n>).toMatchTypeOf<false>()
})

test("true", () => {
    expectTypeOf(null! as ToBool<true>).toMatchTypeOf<true>()
})
test("false", () => {
    expectTypeOf(null! as ToBool<false>).toMatchTypeOf<false>()
})

test("null", () => {
    expectTypeOf(null! as ToBool<null>).toMatchTypeOf<false>()
})
test("undefined", () => {
    expectTypeOf(null! as ToBool<undefined>).toMatchTypeOf<false>()
})

test("function", () => {
    expectTypeOf(null! as ToBool<() => false>).toMatchTypeOf<true>()
})
test("empty array", () => {
    expectTypeOf(null! as ToBool<[]>).toMatchTypeOf<true>()
})
test("UnknownRecord", () => {
    expectTypeOf(null! as ToBool<UnknownRecord>).toMatchTypeOf<true>()
})
test("UnknownArray", () => {
    expectTypeOf(null! as ToBool<UnknownArray>).toMatchTypeOf<true>()
})
test("never", () => {
    expectTypeOf(null!).toMatchTypeOf<never>()
})
