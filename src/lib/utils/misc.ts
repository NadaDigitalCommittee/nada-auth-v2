import type {
    ContentfulStatusCode,
    ContentlessStatusCode,
    StatusCode,
} from "hono/utils/http-status"

export const contentlessStatusCodes: StatusCode[] = [
    101, 204, 205, 304,
] satisfies ContentlessStatusCode[]

export const isContentfulStatusCode = (code: StatusCode): code is ContentfulStatusCode =>
    !contentlessStatusCodes.includes(code)
