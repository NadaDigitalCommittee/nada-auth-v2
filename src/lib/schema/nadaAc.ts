import * as v from "valibot"

import { id } from "../utils/fp"

import {
    type Grade,
    type NadaAcWorkSpaceOtherUser,
    type NadaAcWorkSpacePartialOtherUser,
    type NadaAcWorkSpacePartialStudentUser,
    type NadaAcWorkSpacePartialUser,
    type NadaAcWorkSpaceStudentUser,
    type NadaAcWorkSpaceUser,
    NadaAcWorkSpaceUserType,
} from "@/lib/types/nadaAc"

export const $NadaAcWorkSpaceUserType = v.enum(NadaAcWorkSpaceUserType)

export const $Grade = v.pipe(
    v.union([v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5), v.literal(6)]),
    v.transform(id<Grade>),
)

export const $NadaAcWorkSpaceStudentUser = v.pipe(
    v.object({
        type: v.literal(NadaAcWorkSpaceUserType.Student),
        profile: v.object({
            cohort: v.number(),
            grade: $Grade,
            formattedGrade: v.string(),
            class: v.number(),
            number: v.number(),
            firstName: v.string(),
            lastName: v.string(),
            email: v.string(),
        }),
    }),
    v.transform(id<NadaAcWorkSpaceStudentUser>),
)

const $ProfileNameField = v.intersect([
    v.pipe(v.string(), v.trim(), v.nonEmpty("必須")),
    v.pipe(v.string(), v.regex(/^(?=\S).*(?<=\S)$/, "先頭または末尾に空白があります。")),
])

export const $NadaAcWorkSpacePartialStudentUser = v.pipe(
    v.object({
        type: v.literal(NadaAcWorkSpaceUserType.Student),
        profile: v.object({
            cohort: v.number(),
            class: v.pipe(
                v.number(),
                v.integer((issue) => `${issue.input} 組はありません。`),
                v.minValue(1, (issue) => `${issue.input} 組はありません。`),
            ),
            number: v.pipe(
                v.number(),
                v.integer((issue) => `${issue.input} 番はありません。`),
                v.minValue(1, (issue) => `${issue.input} 番はありません。`),
            ),
            firstName: $ProfileNameField,
            lastName: $ProfileNameField,
        }),
    }),
    v.transform(id<NadaAcWorkSpacePartialStudentUser>),
)

export const $NadaAcWorkSpaceOtherUser = v.pipe(
    v.object({
        type: v.literal(NadaAcWorkSpaceUserType.Others),
        profile: v.object({
            firstName: v.string(),
            lastName: v.string(),
            email: v.string(),
        }),
    }),
    v.transform(id<NadaAcWorkSpaceOtherUser>),
)
export const $NadaAcWorkSpacePartialOtherUser = v.pipe(
    v.object({
        type: v.literal(NadaAcWorkSpaceUserType.Others),
        profile: v.object({
            firstName: $ProfileNameField,
            lastName: $ProfileNameField,
        }),
    }),
    v.transform(id<NadaAcWorkSpacePartialOtherUser>),
)

export const $NadaAcWorkSpaceUser = v.pipe(
    v.union([$NadaAcWorkSpaceStudentUser, $NadaAcWorkSpaceOtherUser]),
    v.transform(id<NadaAcWorkSpaceUser>),
)
export const $NadaAcWorkSpacePartialUser = v.pipe(
    v.union([$NadaAcWorkSpacePartialStudentUser, $NadaAcWorkSpacePartialOtherUser]),
    v.transform(id<NadaAcWorkSpacePartialUser>),
)
