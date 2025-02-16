import type { TokenPayload } from "google-auth-library"
import type { SetRequired } from "type-fest"

import { getJstAcademicYear } from "./date"

import {
    type CombinedGrade,
    type Grade,
    NadaAcWorkSpaceStudentType,
    type NadaAcWorkSpaceUser,
    NadaAcWorkSpaceUserType,
} from "@/lib/types/nadaAc"

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
    const OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT = 1941
    const GRADE_SPAN = 3
    const jstIssuedAcademicYear = getJstAcademicYear(new Date(tokenPayload.iat * 1000))
    const userCombinedGrade = +userProfileSource.combinedGrade as CombinedGrade
    const userGrade = -~(~-userCombinedGrade % GRADE_SPAN) as Grade
    const userCohort =
        jstIssuedAcademicYear -
        OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT -
        userCombinedGrade
    const userStudentType =
        userCombinedGrade > GRADE_SPAN
            ? NadaAcWorkSpaceStudentType.Senior
            : NadaAcWorkSpaceStudentType.Junior
    return {
        type: NadaAcWorkSpaceUserType.Student,
        profile: {
            cohort: userCohort,
            combinedGrade: userCombinedGrade,
            grade: userGrade,
            class: +userProfileSource.class,
            number: +userProfileSource.number,
            firstName: tokenPayload.given_name,
            lastName: userProfileSource.familyName,
            email: tokenPayload.email,
            studentType: userStudentType,
        },
    }
}
