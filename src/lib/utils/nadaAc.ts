import type { TokenPayload } from "google-auth-library"
import type { SetRequired } from "type-fest"

import { getJstAcademicYear } from "./date"

import {
    type Grade,
    type NadaAcWorkSpacePartialUser,
    type NadaAcWorkSpaceUser,
    NadaAcWorkSpaceUserType,
} from "@/lib/types/nadaAc"

export const OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT = 1941
export const GRADE_SPAN = 3

export const formatGrade = (grade: Grade) =>
    `${grade > GRADE_SPAN ? "高" : "中"}${-~(~-grade % GRADE_SPAN)}`

export const calcCohortFromGrade = (grade: Grade, jstAcademicYear: number) =>
    jstAcademicYear - OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT - grade

export const calcGradeFromCohort = (cohort: number, jstAcademicYear: number) =>
    (jstAcademicYear - OFFSET_BETWEEN_ACADEMIC_YEAR_AND_ZEROTH_GRADE_COHORT - cohort) as Grade

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
    const formattedGrade = formatGrade(userGrade)
    const userCohort = calcCohortFromGrade(userGrade, jstIssuedAcademicYear)
    return {
        type: NadaAcWorkSpaceUserType.Student,
        profile: {
            cohort: userCohort,
            grade: userGrade,
            formattedGrade,
            class: +userProfileSource.class,
            number: +userProfileSource.number,
            firstName: tokenPayload.given_name,
            lastName: userProfileSource.familyName,
            email: tokenPayload.email,
        },
    }
}

export const mergeProfile = (
    source: NadaAcWorkSpacePartialUser,
    target: NadaAcWorkSpaceUser,
    iat: number,
): void => {
    switch (source.type) {
        case NadaAcWorkSpaceUserType.Student: {
            const jstIssuedAcademicYear = getJstAcademicYear(new Date(iat * 1000))
            const grade = calcGradeFromCohort(source.profile.cohort, jstIssuedAcademicYear)
            const formattedGrade = formatGrade(grade)
            Object.assign(target, {
                type: source.type,
                profile: {
                    ...source.profile,
                    grade,
                    formattedGrade,
                    email: target.profile.email,
                },
            } satisfies NadaAcWorkSpaceUser)
            return
        }
        case NadaAcWorkSpaceUserType.Others:
            Object.assign(target, {
                type: source.type,
                profile: {
                    ...source.profile,
                    email: target.profile.email,
                },
            } satisfies NadaAcWorkSpaceUser)
            return
    }
}
