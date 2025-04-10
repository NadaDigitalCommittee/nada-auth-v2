import type { PickDeep } from "type-fest"

export enum NadaAcWorkSpaceUserType {
    Student = 0,
    Others = -1,
}

export type CombinedGrade = 1 | 2 | 3 | 4 | 5 | 6

export interface NadaAcWorkSpaceStudentUser {
    type: NadaAcWorkSpaceUserType.Student
    profile: {
        cohort: number
        combinedGrade: CombinedGrade
        gradeDisplay: string
        class: number
        number: number
        firstName: string
        lastName: string
        email: string
    }
}
export type NadaAcWorkSpacePartialStudentUser = PickDeep<
    NadaAcWorkSpaceStudentUser,
    "type" | `profile.${"cohort" | "class" | "number" | "firstName" | "lastName"}`
>

export interface NadaAcWorkSpaceOtherUser {
    type: NadaAcWorkSpaceUserType.Others
    profile: {
        firstName: string
        lastName: string
        email: string
    }
}
export type NadaAcWorkSpacePartialOtherUser = PickDeep<
    NadaAcWorkSpaceOtherUser,
    "type" | `profile.${"firstName" | "lastName"}`
>

export type NadaAcWorkSpaceUser = NadaAcWorkSpaceStudentUser | NadaAcWorkSpaceOtherUser
export type NadaAcWorkSpacePartialUser =
    | NadaAcWorkSpacePartialStudentUser
    | NadaAcWorkSpacePartialOtherUser
