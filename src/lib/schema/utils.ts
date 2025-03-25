import * as v from "valibot"

import { isPlainObject } from "../utils/object"

export type UnknownValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export const vFormFieldValidator = (schema: UnknownValibotSchema) => (value: unknown) => {
    const parseResult = v.safeParse(schema, value, {
        abortEarly: true,
        abortPipeEarly: true,
    })
    return parseResult.success || parseResult.issues[0].message
}

export const generateSchema = <const T>(obj: T) =>
    v.lazy((() => {
        switch (typeof obj) {
            case "bigint":
            case "boolean":
            case "number":
            case "string":
            case "symbol":
                return Number.isNaN(obj) ? v.nan() : v.literal(obj)
            case "undefined":
                return v.undefined()
            case "object":
                if (obj === null) {
                    return v.null()
                } else if (Array.isArray(obj)) {
                    return v.tuple(obj.map(generateSchema))
                } else if (isPlainObject(obj)) {
                    return v.object(
                        Object.fromEntries(
                            Object.entries(obj).map(([key, value]) => [key, generateSchema(value)]),
                        ),
                    )
                } else {
                    return v.unknown()
                }
            case "function":
                return v.function()
            default:
                return v.unknown()
        }
    }) as () => v.GenericSchema<T>)
