import type { TokenPayload } from "google-auth-library"
import type { SetRequired } from "type-fest"

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
    const userDataSource =
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
    if (!userDataSource) {
        return {
            type: NadaAcWorkSpaceUserType.Others,
            data: {
                firstName: tokenPayload.given_name,
                lastName: tokenPayload.family_name,
                email: tokenPayload.email,
            },
        }
    }
    const ACADEMIC_YEAR_FIRST_MONTH = 3 // 4 - 1
    const OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT = 1941
    const GRADE_SPAN = 3
    const UtcIssuedAt = new Date(tokenPayload.iat * 1000)
    const JstIssuedAt = new Date(UtcIssuedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
    const JstIssuedYear = JstIssuedAt.getFullYear()
    const JstIssuedMonth = JstIssuedAt.getMonth()
    const JstIssuedAcademicYear = JstIssuedYear - +(JstIssuedMonth < ACADEMIC_YEAR_FIRST_MONTH)
    const userCombinedGrade = +userDataSource.combinedGrade as CombinedGrade
    const userGrade = -~(~-userCombinedGrade % GRADE_SPAN) as Grade
    const userCohort =
        JstIssuedAcademicYear -
        OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT -
        userCombinedGrade
    const userStudentType =
        userCombinedGrade > GRADE_SPAN
            ? NadaAcWorkSpaceStudentType.Senior
            : NadaAcWorkSpaceStudentType.Junior
    return {
        type: NadaAcWorkSpaceUserType.Student,
        data: {
            cohort: userCohort,
            combinedGrade: userCombinedGrade,
            grade: userGrade,
            class: +userDataSource.class,
            number: +userDataSource.number,
            firstName: tokenPayload.given_name,
            lastName: userDataSource.familyName,
            email: tokenPayload.email,
            studentType: userStudentType,
        },
    }
}
