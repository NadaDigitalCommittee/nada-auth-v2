/* eslint-disable @typescript-eslint/no-wrapper-object-types */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"
import type { UnknownArray, UnknownRecord } from "type-fest"

import type { ToBool } from "../toBool"

test("ToBool:unknown", () => {
    expectTypeOf(null! as ToBool<unknown>).toBeBoolean()
})
test("ToBool:any", () => {
    expectTypeOf(null! as ToBool<any>).toBeBoolean()
})
test("ToBool:number", () => {
    expectTypeOf(null! as ToBool<number>).toBeBoolean()
})
test("ToBool:string", () => {
    expectTypeOf(null! as ToBool<string>).toBeBoolean()
})

test("ToBool:object", () => {
    expectTypeOf(null! as ToBool<object>).toEqualTypeOf<true>()
})
test("ToBool:{}", () => {
    expectTypeOf(null! as ToBool<{}>).toBeBoolean()
})
test("ToBool:Object", () => {
    expectTypeOf(null! as ToBool<Object>).toBeBoolean()
})

test("ToBool:symbol", () => {
    expectTypeOf(null! as ToBool<symbol>).toEqualTypeOf<true>()
})

test("ToBool:truthy string", () => {
    expectTypeOf(null! as ToBool<"ABC">).toEqualTypeOf<true>()
})
test("ToBool:falsy string", () => {
    expectTypeOf(null! as ToBool<"">).toEqualTypeOf<false>()
})
test("ToBool:union of truthy and falsy strings", () => {
    expectTypeOf(null! as ToBool<"" | "ABC">).toBeBoolean()
})

test("ToBool:truthy number", () => {
    expectTypeOf(null! as ToBool<10>).toEqualTypeOf<true>()
})
test("ToBool:falsy number", () => {
    expectTypeOf(null! as ToBool<0>).toEqualTypeOf<false>()
})
test("ToBool:truthy bigint", () => {
    expectTypeOf(null! as ToBool<10n>).toEqualTypeOf<true>()
})
test("ToBool:falsy bigint", () => {
    expectTypeOf(null! as ToBool<0n>).toEqualTypeOf<false>()
})

test("ToBool:true", () => {
    expectTypeOf(null! as ToBool<true>).toEqualTypeOf<true>()
})
test("ToBool:false", () => {
    expectTypeOf(null! as ToBool<false>).toEqualTypeOf<false>()
})

test("ToBool:null", () => {
    expectTypeOf(null! as ToBool<null>).toEqualTypeOf<false>()
})
test("ToBool:undefined", () => {
    expectTypeOf(null! as ToBool<undefined>).toEqualTypeOf<false>()
})

test("ToBool:function", () => {
    expectTypeOf(null! as ToBool<() => false>).toEqualTypeOf<true>()
})
test("ToBool:empty array", () => {
    expectTypeOf(null! as ToBool<[]>).toEqualTypeOf<true>()
})
test("ToBool:UnknownRecord", () => {
    expectTypeOf(null! as ToBool<UnknownRecord>).toEqualTypeOf<true>()
})
test("ToBool:UnknownArray", () => {
    expectTypeOf(null! as ToBool<UnknownArray>).toEqualTypeOf<true>()
})
test("ToBool:never", () => {
    expectTypeOf(null!).toBeNever()
})
