import { Buffer } from "node:buffer"

export const generateDataUrlFromHttpUrl = async (url: URL | string) => {
    const res = await fetch(url)
    const blob = await res.blob()
    return `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`
}
