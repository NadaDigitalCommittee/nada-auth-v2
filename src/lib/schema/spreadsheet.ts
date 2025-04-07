import * as v from "valibot"

export const $AppPropertiesV1 = v.object({
    version: v.literal("1"),
})

export type AppPropertiesV1 = v.InferOutput<typeof $AppPropertiesV1>
