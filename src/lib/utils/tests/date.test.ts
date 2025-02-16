import { describe, expect, test } from "bun:test"

import { getJstAcademicYear } from "../date"

describe("getJstAcademicYear", () => {
    test("January", () => {
        expect(getJstAcademicYear(new Date("2025-01-01T00:00:00+09:00"))).toBe(2024)
    })
    test("February", () => {
        expect(getJstAcademicYear(new Date("2025-02-01T00:00:00+09:00"))).toBe(2024)
    })
    test("March 31, 23:59:59", () => {
        expect(getJstAcademicYear(new Date("2025-03-31T23:59:59+09:00"))).toBe(2024)
    })
    test("April 01, 00:00:00", () => {
        expect(getJstAcademicYear(new Date("2025-04-01T00:00:00+09:00"))).toBe(2025)
    })
    test("May", () => {
        expect(getJstAcademicYear(new Date("2025-05-01T00:00:00+09:00"))).toBe(2025)
    })
    test("June", () => {
        expect(getJstAcademicYear(new Date("2025-06-01T00:00:00+09:00"))).toBe(2025)
    })
    test("July", () => {
        expect(getJstAcademicYear(new Date("2025-07-01T00:00:00+09:00"))).toBe(2025)
    })
    test("August", () => {
        expect(getJstAcademicYear(new Date("2025-08-01T00:00:00+09:00"))).toBe(2025)
    })
    test("September", () => {
        expect(getJstAcademicYear(new Date("2025-09-01T00:00:00+09:00"))).toBe(2025)
    })
    test("October", () => {
        expect(getJstAcademicYear(new Date("2025-10-01T00:00:00+09:00"))).toBe(2025)
    })
    test("November", () => {
        expect(getJstAcademicYear(new Date("2025-11-01T00:00:00+09:00"))).toBe(2025)
    })
    test("December", () => {
        expect(getJstAcademicYear(new Date("2025-12-01T00:00:00+09:00"))).toBe(2025)
    })
})
