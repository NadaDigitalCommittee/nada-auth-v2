import type {
    ContentfulStatusCode,
    ContentlessStatusCode,
    StatusCode,
} from "hono/utils/http-status"
import { Buffer } from "node:buffer"

export const generateDataUrlFromHttpUrl = async (url: URL | string) => {
    const res = await fetch(url)
    const blob = await res.blob()
    return `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`
}

export const contentlessStatusCodes: StatusCode[] = [
    101, 204, 205, 304,
] satisfies ContentlessStatusCode[]

export const isContentfulStatusCode = (code: StatusCode): code is ContentfulStatusCode =>
    !contentlessStatusCodes.includes(code)
