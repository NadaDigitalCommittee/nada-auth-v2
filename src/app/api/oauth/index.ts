import { vValidator } from "@hono/valibot-validator"
import { OAuth2Client } from "google-auth-library"
import { Hono } from "hono"
import { hc } from "hono/client"
import * as v from "valibot"

import { callback } from "./callback"

import type { Env } from "@/lib/schema/env"
import { $Session, $SessionId } from "@/lib/schema/kvNamespaces"
import { sharedCookieNames } from "@/lib/utils/cookie"
import { wrapWithTryCatchAsync } from "@/lib/utils/exceptions"
import { generateSecret } from "@/lib/utils/secret"

const app = new Hono<Env>()
    .get(
        "/",
        vValidator(
            "cookie",
            v.object({
                [sharedCookieNames.sessionId]: $SessionId,
            }),
        ),
        async (c) => {
            const sessionRecord = c.env.Sessions
            const sessionId = c.req.valid("cookie").sid
            const rawSession = await wrapWithTryCatchAsync(
                async () => await sessionRecord.get(sessionId, "json"),
            )
            const sessionParseResult = v.safeParse($Session, rawSession)
            if (!sessionParseResult.success) return c.text("Session Expired", 400)
            const session = sessionParseResult.output
            if (+!session.state ^ +!session.nonce) return c.text("Internal Server Error", 500)
            const reqUrl = new URL(c.req.url)
            reqUrl.protocol = "https:"
            reqUrl.search = ""
            const honoClient = hc<typeof app>(reqUrl.href)
            const redirectUri = honoClient.callback.$url()
            const state = session.state ?? generateSecret(64)
            const nonce = session.nonce ?? generateSecret(64)
            Object.assign(session, { state, nonce })
            await sessionRecord.put(sessionId, JSON.stringify(session))
            const oAuth2client = new OAuth2Client()
            const authUrl = oAuth2client.generateAuthUrl({
                response_type: "code",
                client_id: c.env.GOOGLE_OAUTH_CLIENT_ID,
                redirect_uri: redirectUri.href,
                scope: "openid email profile",
                state,
                nonce,
            })
            return c.redirect(authUrl)
        },
    )
    .route("/callback", callback)

/**
 * @package
 */
export { app as oauth }
