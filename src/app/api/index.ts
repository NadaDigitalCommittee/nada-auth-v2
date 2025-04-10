import { Hono } from "hono"

import { interactions } from "./interactions"

import { id } from "@/lib/utils/fp"

const app = new Hono()
    // https://github.com/honojs/hono/issues/2781
    .mount("/interactions", interactions.fetch, { replaceRequest: id })

/**
 * @package
 */
export { app as api }
