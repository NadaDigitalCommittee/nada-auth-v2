import type { TokenPayload } from "google-auth-library"
import type { SetRequired } from "type-fest"

import { getJstAcademicYear } from "./date"

import { type Grade, type NadaAcWorkSpaceUser, NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"

export const OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT = 1941
export const GRADE_SPAN = 3

export const calcCohortFromGrade = (grade: Grade, jstAcademicYear: number) =>
    jstAcademicYear - OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT - grade

interface UserProfileSource {
    grade: `${Grade}`
    class: `${number}`
    number: `${number}`
    familyName: string
}

// TODO: クラスにしてformatNicknameをメソッドに組み込む
export const extractNadaACWorkSpaceUserFromTokenPayload = (
    tokenPayload: SetRequired<TokenPayload, "given_name" | "family_name" | "email">,
): NadaAcWorkSpaceUser => {
    const userProfileSource = /^(?<grade>[1-6])(?<class>\d)(?<number>\d{2})(?<familyName>.*)$/.exec(
        tokenPayload.family_name,
    )?.groups as UserProfileSource | undefined
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
    const userGrade = +userProfileSource.grade as Grade
    const gradeDisplay = `${userGrade > GRADE_SPAN ? "高" : "中"}${-~(~-userGrade % GRADE_SPAN)}`
    const userCohort = calcCohortFromGrade(userGrade, jstIssuedAcademicYear)
    return {
        type: NadaAcWorkSpaceUserType.Student,
        profile: {
            cohort: userCohort,
            grade: userGrade,
            gradeDisplay,
            class: +userProfileSource.class,
            number: +userProfileSource.number,
            firstName: tokenPayload.given_name,
            lastName: userProfileSource.familyName,
            email: tokenPayload.email,
        },
    }
}
