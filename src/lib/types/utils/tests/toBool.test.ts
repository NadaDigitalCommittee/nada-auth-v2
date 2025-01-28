/* eslint-disable @typescript-eslint/no-wrapper-object-types */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "bun:test"
import { expectTypeOf } from "expect-type"
import type { UnknownArray, UnknownRecord } from "type-fest"

import type { ToBool } from "../toBool"

test("ToBool:unknown", () => {
    expectTypeOf(null! as ToBool<unknown>).toMatchTypeOf<boolean>()
})
test("ToBool:any", () => {
    expectTypeOf(null! as ToBool<any>).toMatchTypeOf<boolean>()
})
test("ToBool:number", () => {
    expectTypeOf(null! as ToBool<number>).toMatchTypeOf<boolean>()
})
test("ToBool:string", () => {
    expectTypeOf(null! as ToBool<string>).toMatchTypeOf<boolean>()
})

test("ToBool:object", () => {
    expectTypeOf(null! as ToBool<object>).toMatchTypeOf<true>()
})
test("ToBool:{}", () => {
    expectTypeOf(null! as ToBool<{}>).toMatchTypeOf<boolean>()
})
test("ToBool:Object", () => {
    expectTypeOf(null! as ToBool<Object>).toMatchTypeOf<boolean>()
})

test("ToBool:symbol", () => {
    expectTypeOf(null! as ToBool<symbol>).toMatchTypeOf<true>()
})

test("ToBool:truthy string", () => {
    expectTypeOf(null! as ToBool<"ABC">).toMatchTypeOf<true>()
})
test("ToBool:falsy string", () => {
    expectTypeOf(null! as ToBool<"">).toMatchTypeOf<false>()
})
test("ToBool:union of truthy and falsy strings", () => {
    expectTypeOf(null! as ToBool<"" | "ABC">).toMatchTypeOf<boolean>()
})

test("ToBool:truthy number", () => {
    expectTypeOf(null! as ToBool<10>).toMatchTypeOf<true>()
})
test("ToBool:falsy number", () => {
    expectTypeOf(null! as ToBool<0>).toMatchTypeOf<false>()
})
test("ToBool:truthy bigint", () => {
    expectTypeOf(null! as ToBool<10n>).toMatchTypeOf<true>()
})
test("ToBool:falsy bigint", () => {
    expectTypeOf(null! as ToBool<0n>).toMatchTypeOf<false>()
})

test("ToBool:true", () => {
    expectTypeOf(null! as ToBool<true>).toMatchTypeOf<true>()
})
test("ToBool:false", () => {
    expectTypeOf(null! as ToBool<false>).toMatchTypeOf<false>()
})

test("ToBool:null", () => {
    expectTypeOf(null! as ToBool<null>).toMatchTypeOf<false>()
})
test("ToBool:undefined", () => {
    expectTypeOf(null! as ToBool<undefined>).toMatchTypeOf<false>()
})

test("ToBool:function", () => {
    expectTypeOf(null! as ToBool<() => false>).toMatchTypeOf<true>()
})
test("ToBool:empty array", () => {
    expectTypeOf(null! as ToBool<[]>).toMatchTypeOf<true>()
})
test("ToBool:UnknownRecord", () => {
    expectTypeOf(null! as ToBool<UnknownRecord>).toMatchTypeOf<true>()
})
test("ToBool:UnknownArray", () => {
    expectTypeOf(null! as ToBool<UnknownArray>).toMatchTypeOf<true>()
})
test("ToBool:never", () => {
    expectTypeOf(null!).toMatchTypeOf<never>()
})
