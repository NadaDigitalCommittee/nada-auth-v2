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
    data: {
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

export interface NadaAcWorkSpaceOtherUser {
    type: NadaAcWorkSpaceUserType.Others
    data: {
        firstName: string
        lastName: string
        email: string
    }
}

export type NadaAcWorkSpaceUser = NadaAcWorkSpaceStudentUser | NadaAcWorkSpaceOtherUser
