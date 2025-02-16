import { describe, expect, test } from "bun:test"

import { getCohort } from "../nadaAc"

describe("getCohort", () => {
    test("combinedGrade 1", () => {
        expect(getCohort(1, 2024)).toBe(82)
    })
    test("combinedGrade 4", () => {
        expect(getCohort(4, 2024)).toBe(79)
    })
})
