import { Hono } from "hono"

import { signin } from "./signin"

const app = new Hono().route("/signin", signin)

export { app as oauth }
