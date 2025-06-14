import { Box, Button, FormControlLabel, Stack, Tooltip, css } from "@mui/material"
import { useRef, useState, useSyncExternalStore } from "react"
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

import { Unselectable } from "@/components/Unselectable"
import {
    $NadaAcWorkSpacePartialOtherUser,
    $NadaAcWorkSpacePartialStudentUser,
} from "@/lib/schema/nadaAc"
import { vFormFieldValidator } from "@/lib/schema/utils"
import { type Grade, NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { getJstAcademicYear } from "@/lib/utils/date"
import { calcCohortFromGrade } from "@/lib/utils/nadaAc"
import { exclusiveRange } from "@/lib/utils/range"

/**
 * @package
 */
export const name = "profile-form"

/**
 * @package
 */
export const id = `${name}_container`

const $NonStudentProfileFormData = v.object({
    isStudent: v.literal(false),
    ...$NadaAcWorkSpacePartialOtherUser.entries,
})

const $StudentProfileFormData = v.object({
    isStudent: v.literal(true),
    ...$NadaAcWorkSpacePartialStudentUser.entries,
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
        formState: { isValid },
    } = useForm<ProfileFormData>({
        mode: "onChange",
        reValidateMode: "onChange",
        shouldUnregister: true,
        shouldUseNativeValidation: false,
        defaultValues: {
            isStudent: true,
        },
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
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
            onSubmit={() => {
                setIsSubmitting(true)
            }}
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
                            deps: "isStudent",
                            required: "必須",
                        }}
                        options={[...exclusiveRange(6, 0)].map((grade) => {
                            const cohort = calcCohortFromGrade(grade as Grade, jstAcademicYear)
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
                            deps: "isStudent",
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
                            deps: "isStudent",
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
                        <Unselectable>
                            入力されていない項目があるか、入力にエラーがあるため、続行できません。
                        </Unselectable>
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
                        disabled={!isValid}
                        loading={isSubmitting}
                        loadingPosition="start"
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
