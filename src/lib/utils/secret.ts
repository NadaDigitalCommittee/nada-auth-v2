import { encodeBase64Url } from "hono/utils/encode"

export const generateSecret = (byteLength: number) => {
    const randomBytes = crypto.getRandomValues(new Uint8Array(byteLength))
    return encodeBase64Url(randomBytes.buffer).replace(/=+/, "")
}
