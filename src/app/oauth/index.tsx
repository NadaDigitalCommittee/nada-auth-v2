import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"

import { sheets } from "./sheets"
import { signin } from "./signin"

import { ErrorAlert } from "@/components/ErrorAlert"

const app = new Hono()
    .route("/signin", signin)
    .route("/sheets", sheets)
    .onError((error, c) => {
        if (error instanceof HTTPException && error.res) return error.res
        const { status, message } =
            error instanceof HTTPException
                ? error
                : ({ status: 500, message: "Internal Server Error" } as const)
        c.status(status)
        return c.render(<ErrorAlert>{message}</ErrorAlert>)
    })

export { app as oauth }
