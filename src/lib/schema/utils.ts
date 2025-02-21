import * as v from "valibot"

export type UnknownValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export const vFormFieldValidator = (schema: UnknownValibotSchema) => (value: unknown) => {
    const parseResult = v.safeParse(schema, value, {
        abortEarly: true,
        abortPipeEarly: true,
    })
    return parseResult.success || parseResult.issues[0].message
}
