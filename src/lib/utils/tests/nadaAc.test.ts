import { describe, expect, test } from "bun:test"

import { calcCohortFromCombinedGrade } from "../nadaAc"

describe("calcCohortFromCombinedGrade", () => {
    test("combinedGrade 1", () => {
        expect(calcCohortFromCombinedGrade(1, 2024)).toBe(82)
    })
    test("combinedGrade 4", () => {
        expect(calcCohortFromCombinedGrade(4, 2024)).toBe(79)
    })
})
