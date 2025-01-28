import * as v from "valibot"

import { id } from "../utils/fp"

import {
    type CombinedGrade,
    type Grade,
    type NadaAcWorkSpaceOtherUser,
    type NadaAcWorkSpaceOtherUserPartialProfile,
    NadaAcWorkSpaceStudentType,
    type NadaAcWorkSpaceStudentUser,
    type NadaAcWorkSpaceStudentUserPartialProfile,
    type NadaAcWorkSpaceUser,
    type NadaAcWorkSpaceUserPartialProfile,
    NadaAcWorkSpaceUserType,
} from "@/lib/types/nadaAc"

export const $NadaAcWorkSpaceUserType = v.enum(NadaAcWorkSpaceUserType)

export const $NadaAcWorkSpaceStudentType = v.enum(NadaAcWorkSpaceStudentType)

export const $CombinedGrade = v.pipe(
    v.union([v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5), v.literal(6)]),
    v.transform(id<CombinedGrade>),
)
export const $Grade = v.pipe(
    v.union([v.literal(1), v.literal(2), v.literal(3)]),
    v.transform(id<Grade>),
)

export const $NadaAcWorkSpaceStudentUser = v.pipe(
    v.object({
        type: v.literal(NadaAcWorkSpaceUserType.Student),
        profile: v.object({
            cohort: v.number(),
            combinedGrade: $CombinedGrade,
            grade: $Grade,
            class: v.number(),
            number: v.number(),
            firstName: v.string(),
            lastName: v.string(),
            email: v.string(),
            studentType: $NadaAcWorkSpaceStudentType,
        }),
    }),
    v.transform(id<NadaAcWorkSpaceStudentUser>),
)
export const $NadaAcWorkSpaceStudentUserPartialProfile = v.pipe(
    v.object({
        cohort: v.number(),
        class: v.number(),
        number: v.number(),
        firstName: v.string(),
        lastName: v.string(),
    }),
    v.transform(id<NadaAcWorkSpaceStudentUserPartialProfile>),
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
export const $NadaAcWorkSpaceOtherUserPartialProfile = v.pipe(
    v.object({
        firstName: v.string(),
        lastName: v.string(),
    }),
    v.transform(id<NadaAcWorkSpaceOtherUserPartialProfile>),
)

export const $NadaAcWorkSpaceUser = v.pipe(
    v.union([$NadaAcWorkSpaceStudentUser, $NadaAcWorkSpaceOtherUser]),
    v.transform(id<NadaAcWorkSpaceUser>),
)
export const $NadaAcWorkSpaceUserPartialProfile = v.pipe(
    v.union([$NadaAcWorkSpaceStudentUserPartialProfile, $NadaAcWorkSpaceOtherUserPartialProfile]),
    v.transform(id<NadaAcWorkSpaceUserPartialProfile>),
)
