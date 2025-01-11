import { Buffer } from "node:buffer"

export const generateSecret = (byteLength: number) => {
    const randomBytes = crypto.getRandomValues(new Uint8Array(byteLength))
    return Buffer.from(randomBytes.buffer).toString("base64url")
}
