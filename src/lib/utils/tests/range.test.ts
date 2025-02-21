import { describe, expect, test } from "bun:test"

import { exclusiveRange } from "../range"

describe("exclusiveRange", () => {
    test("exclusiveRange(0, 0)", () => {
        expect([...exclusiveRange(0, 0)]).toStrictEqual([])
    })
    test("exclusiveRange(1, 7)", () => {
        expect([...exclusiveRange(1, 7)]).toStrictEqual([1, 2, 3, 4, 5, 6])
    })
    test("exclusiveRange(1, 7, 2)", () => {
        expect([...exclusiveRange(1, 7, 2)]).toStrictEqual([1, 3, 5])
    })
    test("exclusiveRange(1, 7, 10)", () => {
        expect([...exclusiveRange(1, 7, 10)]).toStrictEqual([1])
    })
    test("exclusiveRange(-5, -1)", () => {
        expect([...exclusiveRange(-5, -1)]).toStrictEqual([-5, -4, -3, -2])
    })
    test("exclusiveRange(7, 1)", () => {
        expect([...exclusiveRange(7, 1)]).toStrictEqual([7, 6, 5, 4, 3, 2])
    })
    test("exclusiveRange(7, 1, -2)", () => {
        expect([...exclusiveRange(7, 1, -2)]).toStrictEqual([7, 5, 3])
    })
    test("exclusiveRange(7, 1, -10)", () => {
        expect([...exclusiveRange(7, 1, -10)]).toStrictEqual([7])
    })
    test("exclusiveRange(-1, -5)", () => {
        expect([...exclusiveRange(-1, -5)]).toStrictEqual([-1, -2, -3, -4])
    })
})
