export enum NadaAcWorkSpaceUserType {
    Student = 0,
    Others = -1,
}

export enum NadaAcWorkSpaceStudentType {
    Junior = "中",
    Senior = "高",
}

export type CombinedGrade = 1 | 2 | 3 | 4 | 5 | 6

export type Grade = 1 | 2 | 3

export interface NadaAcWorkSpaceStudentUser {
    type: NadaAcWorkSpaceUserType.Student
    profile: {
        cohort: number
        combinedGrade: CombinedGrade
        grade: Grade
        class: number
        number: number
        firstName: string
        lastName: string
        email: string
        studentType: NadaAcWorkSpaceStudentType
    }
}
export type NadaAcWorkSpaceStudentUserPartialProfile = Pick<
    NadaAcWorkSpaceStudentUser["profile"],
    "cohort" | "class" | "number" | "firstName" | "lastName"
>

export interface NadaAcWorkSpaceOtherUser {
    type: NadaAcWorkSpaceUserType.Others
    profile: {
        firstName: string
        lastName: string
        email: string
    }
}
export type NadaAcWorkSpaceOtherUserPartialProfile = Pick<
    NadaAcWorkSpaceOtherUser["profile"],
    "firstName" | "lastName"
>

export type NadaAcWorkSpaceUser = NadaAcWorkSpaceStudentUser | NadaAcWorkSpaceOtherUser
export type NadaAcWorkSpaceUserPartialProfile =
    | NadaAcWorkSpaceStudentUserPartialProfile
    | NadaAcWorkSpaceOtherUserPartialProfile
