import { Box, Button, FormControlLabel, Stack, Tooltip, css } from "@mui/material"
import { useEffect, useRef, useSyncExternalStore } from "react"
import {
    CheckboxElement,
    SelectElement,
    TextFieldElement,
    useForm,
    useWatch,
} from "react-hook-form-mui"
import { FcGoogle } from "react-icons/fc"
import type { ArrayValues } from "type-fest"
import * as v from "valibot"

import { vFormFieldValidator } from "@/lib/schema/utils"
import { type CombinedGrade, NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { getJstAcademicYear } from "@/lib/utils/date"
import { calcCohortFromCombinedGrade } from "@/lib/utils/nadaAc"
import { objectPaths } from "@/lib/utils/object"
import { exclusiveRange } from "@/lib/utils/range"

/**
 * @package
 */
export const name = "profile-form"

/**
 * @package
 */
export const id = `${name}_container`

const $ProfileNameField = v.intersect([
    v.pipe(v.string(), v.trim(), v.nonEmpty("必須")),
    v.pipe(v.string(), v.regex(/^(?=\S).*(?<=\S)$/, "先頭または末尾に空白があります。")),
])

const $NonStudentProfileFormData = v.object({
    isStudent: v.literal(false),
    type: v.literal(NadaAcWorkSpaceUserType.Others),
    profile: v.object({
        lastName: $ProfileNameField,
        firstName: $ProfileNameField,
    }),
})

const $StudentProfileFormData = v.object({
    isStudent: v.literal(true),
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
        lastName: $ProfileNameField,
        firstName: $ProfileNameField,
    }),
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const $ProfileFormData = v.union([$StudentProfileFormData, $NonStudentProfileFormData])

type ProfileFormData = v.InferOutput<typeof $ProfileFormData>

/**
 * @package
 */
export const Core = () => {
    const {
        control,
        formState: { isValid, isSubmitting, dirtyFields },
        trigger,
    } = useForm<ProfileFormData>({
        mode: "onChange",
        reValidateMode: "onChange",
        shouldUnregister: true,
        shouldUseNativeValidation: false,
        defaultValues: {
            isStudent: true,
        },
    })
    const jstAcademicYearRef = useRef<number | null>(null)
    // https://qiita.com/ssssota/items/51278dc5d51801dfb3fc
    const jstAcademicYear = useSyncExternalStore(
        // subscribeしない
        () => () => {},
        () => {
            if (jstAcademicYearRef.current === null)
                jstAcademicYearRef.current = getJstAcademicYear(new Date())
            return jstAcademicYearRef.current
        },
        () => 0,
    )
    const isStudent = useWatch({ name: "isStudent", control })

    // CheckboxElementのonChangeでトリガーするとRHFとReactが競合して4, 5回再レンダリングされてしまう上に、古いデータを参照することがある
    useEffect(() => {
        void (async () => {
            await trigger(
                objectPaths(dirtyFields, {
                    fullPathOnly: true,
                }),
            )
        })()
    }, [isStudent])

    const CurrentFormDataSchema = isStudent ? $StudentProfileFormData : $NonStudentProfileFormData
    // 本来いらないが、型推論のために必要
    const is$StudentProfileFormData = (
        schema: ArrayValues<typeof $ProfileFormData.options>,
    ): schema is typeof $StudentProfileFormData => schema.entries.isStudent.literal
    return (
        <Stack
            direction="column"
            spacing={1}
            maxWidth="20rem"
            component="form"
            action=""
            method="POST"
            name={name}
            noValidate
        >
            <FormControlLabel
                control={<CheckboxElement name="isStudent" control={control} />}
                label="生徒"
                css={css`
                    width: fit-content;
                    label {
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                    }
                `}
            />
            <input
                type="hidden"
                value={isStudent ? NadaAcWorkSpaceUserType.Student : NadaAcWorkSpaceUserType.Others}
                {...control.register("type")}
            />
            {isStudent && is$StudentProfileFormData(CurrentFormDataSchema) && (
                <Stack direction="row" spacing={1}>
                    <SelectElement
                        name="profile.cohort"
                        label="回生"
                        variant="outlined"
                        type="number"
                        required
                        control={control}
                        rules={{
                            required: "必須",
                        }}
                        options={[...exclusiveRange(6, 0)].map((combinedGrade) => {
                            const cohort = calcCohortFromCombinedGrade(
                                combinedGrade as CombinedGrade,
                                jstAcademicYear,
                            )
                            return {
                                id: cohort,
                                label: cohort,
                            }
                        })}
                        css={css`
                            min-width: 4.5rem;
                        `}
                    ></SelectElement>
                    <TextFieldElement
                        name="profile.class"
                        label="組"
                        variant="outlined"
                        type="number"
                        required
                        control={control}
                        rules={{
                            required: "必須",
                            validate: vFormFieldValidator(
                                CurrentFormDataSchema.entries.profile.entries.class,
                            ),
                        }}
                    ></TextFieldElement>
                    <TextFieldElement
                        name="profile.number"
                        label="番号"
                        variant="outlined"
                        type="number"
                        required
                        control={control}
                        rules={{
                            required: "必須",
                            validate: vFormFieldValidator(
                                CurrentFormDataSchema.entries.profile.entries.number,
                            ),
                        }}
                    ></TextFieldElement>
                </Stack>
            )}
            <Stack direction="row" spacing={1}>
                <TextFieldElement
                    name="profile.lastName"
                    label="姓"
                    variant="outlined"
                    type="text"
                    required
                    control={control}
                    rules={{
                        required: "必須",
                        validate: vFormFieldValidator(
                            CurrentFormDataSchema.entries.profile.entries.lastName,
                        ),
                    }}
                ></TextFieldElement>
                <TextFieldElement
                    name="profile.firstName"
                    label="名"
                    variant="outlined"
                    type="text"
                    required
                    control={control}
                    rules={{
                        required: "必須",
                        validate: vFormFieldValidator(
                            CurrentFormDataSchema.entries.profile.entries.firstName,
                        ),
                    }}
                ></TextFieldElement>
            </Stack>
            <Tooltip
                describeChild
                enterTouchDelay={0}
                leaveTouchDelay={2000}
                title={
                    !isValid && (
                        <span
                            css={css`
                                user-select: none;
                            `}
                        >
                            入力されていない項目があるか、入力にエラーがあるため、続行できません。
                        </span>
                    )
                }
            >
                <Box
                    css={css`
                        width: fit-content;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    `}
                >
                    <Button
                        variant="outlined"
                        startIcon={<FcGoogle />}
                        type="submit"
                        size="large"
                        disabled={!isValid || isSubmitting}
                        tabIndex={0}
                        css={css`
                            text-transform: none;
                            color: #1f1f1f;
                            background-color: #ffffff;
                            border-color: #747775;
                            &:hover {
                                background-color: #f2f2f2;
                                border-color: #4e4e4e;
                            }
                        `}
                    >
                        Google でサインイン
                    </Button>
                </Box>
            </Tooltip>
        </Stack>
    )
}
