import { describe, expect, test } from "bun:test"

import { isPlainObject } from "../object"

describe("isPlainObject", () => {
    test("returns true for plain objects", () => {
        expect(isPlainObject({})).toBe(true)
        expect(isPlainObject({ a: 1, b: 2 })).toBe(true)
    })

    test("returns false for arrays", () => {
        expect(isPlainObject([])).toBe(false)
        expect(isPlainObject([1, 2, 3])).toBe(false)
    })

    test("returns false for null", () => {
        expect(isPlainObject(null)).toBe(false)
    })

    test("returns false for undefined", () => {
        expect(isPlainObject(undefined)).toBe(false)
    })

    test("returns false for functions", () => {
        expect(isPlainObject(() => {})).toBe(false)
        expect(isPlainObject(function () {})).toBe(false)
    })

    test("returns false for instances of classes", () => {
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        class MyClass {}
        expect(isPlainObject(new MyClass())).toBe(false)
    })

    test("returns false for non-plain objects", () => {
        expect(isPlainObject(new Date())).toBe(false)
        expect(isPlainObject(new RegExp("regex", "i"))).toBe(false)
        expect(isPlainObject(new Map())).toBe(false)
    })

    test("returns false for other types", () => {
        expect(isPlainObject(42)).toBe(false)
        expect(isPlainObject("string")).toBe(false)
        expect(isPlainObject(true)).toBe(false)
        expect(isPlainObject(Symbol())).toBe(false)
    })
})
