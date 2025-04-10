import { describe, expect, test } from "bun:test"

import { calcCohortFromGrade } from "../nadaAc"

describe("calcCohortFromGrade", () => {
    test("grade 1", () => {
        expect(calcCohortFromGrade(1, 2024)).toBe(82)
    })
    test("grade 4", () => {
        expect(calcCohortFromGrade(4, 2024)).toBe(79)
    })
})
