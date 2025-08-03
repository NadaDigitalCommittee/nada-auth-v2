import type { Snowflake } from "discord-api-types/globals"
import type { KeysOfUnion } from "type-fest"
import * as v from "valibot"

import { $Grade, $NadaAcWorkSpaceUserType } from "./nadaAc"
import type { UnknownValibotSchema } from "./utils"

import type { NadaAcWorkSpaceUser } from "@/lib/types/nadaAc"
import { pipe } from "@/lib/utils/fp"

export const $AppPropertiesV1 = v.object({
    version: v.literal("1"),
})

export type AppPropertiesV1 = v.InferOutput<typeof $AppPropertiesV1>

const numberSplitAction = v.transform((input: string) =>
    input.split(",").reduce<number[]>((acc, s) => {
        const trimmed = s.trim()
        if (trimmed) acc.push(Number(trimmed))
        return acc
    }, []),
)

const stringSplitAction = v.transform((input: string) =>
    input.split(",").reduce<string[]>((acc, s) => {
        const trimmed = s.trim()
        if (trimmed) acc.push(trimmed)
        return acc
    }, []),
)

export type Role = [id: Snowflake, operation: 1 | -1]
type Context$1<TInput> = Parameters<Parameters<typeof v.rawTransform<TInput, TInput>>[0]>[0]
type IssueInfo<TInput> = NonNullable<Parameters<Context$1<TInput>["addIssue"]>[0]>
/* eslint-disable  @typescript-eslint/only-throw-error */
export const roleTransformAction = v.rawTransform<string, Role[]>((ctx) => {
    try {
        return ctx.dataset.value.split(",").reduce<Role[]>((acc, str, index, arr) => {
            const trimmed = str.trim()
            if (!trimmed) return acc
            const roleRegex = /^([-+]?)(\d+)(:.+)?$/
            const roleRegexExecArr = roleRegex.exec(trimmed)
            if (!roleRegexExecArr)
                throw {
                    label: "role",
                    input: trimmed,
                    expected: `${roleRegex}`,
                    received: `"${trimmed}"`,
                    message: `Invalid format: Expected ${roleRegex} but received "${trimmed}"`,
                    path: [
                        {
                            type: "array",
                            origin: "value",
                            input: arr,
                            key: index,
                            value: trimmed,
                        },
                    ],
                } satisfies IssueInfo<string>
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [, sign, abs, _label] = roleRegexExecArr
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            acc.push([abs!, sign === "-" ? -1 : 1])
            return acc
        }, [])
    } catch (e) {
        return (ctx.addIssue(e as IssueInfo<string>), ctx.NEVER)
    }
})
/* eslint-enable @typescript-eslint/only-throw-error */

const nicknameTransformAction = v.transform((s: string) => s.trim() || null)

const createSchema = <const T extends unknown[]>(arr: T) =>
    arr.length ? v.union(arr.map(v.literal)) : v.optional(v.unknown())

type ProfileKeys = Exclude<KeysOfUnion<NadaAcWorkSpaceUser["profile"]>, "email" | "formattedGrade">

const coerceString = v.fallback(
    v.nullish(v.string(), ""),
    (output) => output?.value?.toString() ?? "",
)
export const $Rule = v.pipe(
    v.tuple([
        v.pipe(coerceString, numberSplitAction, v.array($NadaAcWorkSpaceUserType)),
        v.pipe(coerceString, numberSplitAction, v.array($Grade)),
        v.pipe(coerceString, numberSplitAction),
        v.pipe(coerceString, numberSplitAction),
        v.pipe(coerceString, numberSplitAction),
        v.pipe(coerceString, stringSplitAction),
        v.pipe(coerceString, stringSplitAction),
        v.pipe(coerceString),
        v.pipe(coerceString, nicknameTransformAction),
    ]),
    v.transform(
        pipe(
            (row) => [row.slice(0, 7).map(createSchema), row.slice(7)] as const,
            ([
                [$type, $grade, $cohort, $class, $number, $lastName, $firstName],
                [roles, nickname],
            ]) => ({
                schema: v.object({
                    type: $type,
                    profile: v.object({
                        grade: $grade,
                        cohort: $cohort,
                        class: $class,
                        number: $number,
                        lastName: $lastName,
                        firstName: $firstName,
                    } satisfies Record<ProfileKeys, UnknownValibotSchema>),
                }),
                roles,
                nickname,
            }),
        ),
    ),
)

export type Rule = v.InferOutput<typeof $Rule>
