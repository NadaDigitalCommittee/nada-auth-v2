import type { TokenPayload } from "google-auth-library"
import type { SetRequired } from "type-fest"

import { getJstAcademicYear } from "./date"

import {
    type CombinedGrade,
    type NadaAcWorkSpaceUser,
    NadaAcWorkSpaceUserType,
} from "@/lib/types/nadaAc"

export const OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT = 1941
export const GRADE_SPAN = 3

export const calcCohortFromCombinedGrade = (
    combinedGrade: CombinedGrade,
    jstAcademicYear: number,
) => jstAcademicYear - OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT - combinedGrade

// TODO: クラスにしてformatNicknameをメソッドに組み込む
export const extractNadaACWorkSpaceUserFromTokenPayload = (
    tokenPayload: SetRequired<TokenPayload, "given_name" | "family_name" | "email">,
): NadaAcWorkSpaceUser => {
    const userProfileSource =
        /^(?<combinedGrade>[1-6])(?<class>\d)(?<number>\d{2})(?<familyName>.*)$/.exec(
            tokenPayload.family_name,
        )?.groups as
            | undefined
            | {
                  combinedGrade: `${CombinedGrade}`
                  class: `${number}`
                  number: `${number}`
                  familyName: string
              }
    if (!userProfileSource) {
        return {
            type: NadaAcWorkSpaceUserType.Others,
            profile: {
                firstName: tokenPayload.given_name,
                lastName: tokenPayload.family_name,
                email: tokenPayload.email,
            },
        }
    }
    const jstIssuedAcademicYear = getJstAcademicYear(new Date(tokenPayload.iat * 1000))
    const userCombinedGrade = +userProfileSource.combinedGrade as CombinedGrade
    const gradeDisplay = `${userCombinedGrade > GRADE_SPAN ? "高" : "中"}${-~(~-userCombinedGrade % GRADE_SPAN)}`
    const userCohort = calcCohortFromCombinedGrade(userCombinedGrade, jstIssuedAcademicYear)
    return {
        type: NadaAcWorkSpaceUserType.Student,
        profile: {
            cohort: userCohort,
            combinedGrade: userCombinedGrade,
            gradeDisplay,
            class: +userProfileSource.class,
            number: +userProfileSource.number,
            firstName: tokenPayload.given_name,
            lastName: userProfileSource.familyName,
            email: tokenPayload.email,
        },
    }
}
