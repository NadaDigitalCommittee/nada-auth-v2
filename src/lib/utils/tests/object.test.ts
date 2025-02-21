import { describe, expect, test } from "bun:test"

import { isPlainObject, objectPaths } from "../object"

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

describe("objectPaths", () => {
    test("returns empty array for null or undefined", () => {
        expect(objectPaths(null)).toStrictEqual([])
        expect(objectPaths(undefined)).toStrictEqual([])
    })

    test("returns empty array for non-object types", () => {
        expect(objectPaths(42)).toStrictEqual([])
        expect(objectPaths("string")).toStrictEqual([])
        expect(objectPaths(true)).toStrictEqual([])
        expect(objectPaths(Symbol())).toStrictEqual([])
    })

    test("returns paths for plain objects", () => {
        expect(objectPaths({ a: 1, b: { c: 2 } })).toStrictEqual(["a", "b", "b.c"])
        expect(objectPaths({ a: { b: { c: { d: 1 } } } })).toStrictEqual([
            "a",
            "a.b",
            "a.b.c",
            "a.b.c.d",
        ])
    })

    test("returns empty array for non-plain objects", () => {
        expect(objectPaths(new Date())).toStrictEqual([])
        expect(objectPaths(new RegExp("regex", "i"))).toStrictEqual([])
        expect(objectPaths(new Map())).toStrictEqual([])
    })

    test("returns paths for objects but skips symbol keys", () => {
        expect(objectPaths({ a: 0, [Symbol()]: 1, b: { [Symbol()]: 2, c: 3 } })).toStrictEqual([
            "a",
            "b",
            "b.c",
        ])
    })
    test("returns paths for arrays", () => {
        expect(objectPaths([1, 2, { a: 3 }])).toStrictEqual(["0", "1", "2", "2.a"])
        expect(objectPaths([{ a: 1 }, { b: 2 }])).toStrictEqual(["0", "0.a", "1", "1.b"])
    })

    test("returns full paths only when fullPathOnly option is true", () => {
        expect(objectPaths({ a: 1, b: { c: 2 } }, { fullPathOnly: true })).toStrictEqual([
            "a",
            "b.c",
        ])
        expect(objectPaths({ a: { b: { c: { d: 1 } } } }, { fullPathOnly: true })).toStrictEqual([
            "a.b.c.d",
        ])
    })
})
