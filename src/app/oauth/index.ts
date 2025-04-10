import { Hono } from "hono"

import { sheets } from "./sheets"
import { signin } from "./signin"

const app = new Hono().route("/signin", signin).route("/sheets", sheets)

export { app as oauth }
