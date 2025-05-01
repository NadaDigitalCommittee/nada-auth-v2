import { Hono } from "hono"

import { interactions } from "./interactions"

const app = new Hono()
    // https://github.com/honojs/hono/issues/2781
    .mount("/interactions", interactions.fetch, { replaceRequest: false })

/**
 * @package
 */
export { app as api }
