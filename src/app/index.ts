import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"
import type { H } from "hono/types"
import type { StatusCode } from "hono/utils/http-status"

import { api } from "./api"
import { authn } from "./authn"
import { invite } from "./invite"

import { discordRest } from "@/lib/middleware/discordRest"
import { envVarsValidator } from "@/lib/middleware/envVarsValidator"
import type { Env } from "@/lib/schema/env"
import { isContentfulStatusCode } from "@/lib/utils/misc"

const assetsHandler: H<Env> = async (c) => {
    const res = await (async () => {
        const _res = await c.env.ASSETS.fetch(c.req.raw)
        // NOTE: https://zenn.dev/yusukebe/articles/647aa9ba8c1550#1.レスポンスヘッダの追加
        return new Response(_res.body, _res)
    })()
    const status = res.status as StatusCode
    if (!res.ok && isContentfulStatusCode(status))
        return c.text(`${status} ${res.statusText}`, status)
    res.headers.set("Access-Control-Allow-Origin", "*")
    res.headers.set("Cache-Control", "max-age=86400")
    return res
}

const app = new Hono()
    .use(envVarsValidator)
    .use(discordRest)
    .use(secureHeaders())
    .route("/api", api)
    .route("/invite", invite)
    .route("/authn", authn)
    .get("/robots.txt", assetsHandler)
    .get("/assets/*", assetsHandler)

export type AppType = typeof app
export default app
