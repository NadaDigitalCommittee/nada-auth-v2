import { Hono } from "hono"

import { interactions } from "./interactions"
import { oauth } from "./oauth"

import { id } from "@/lib/utils/fp"

const app = new Hono()
    // https://github.com/honojs/hono/issues/2781
    .mount("/interactions", interactions.fetch, { replaceRequest: id })
    .route("/oauth", oauth)

/**
 * @package
 */
export { app as api }
