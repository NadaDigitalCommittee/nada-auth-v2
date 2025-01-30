import type { ReactNode } from "hono/jsx"

import type { MaybePromise } from "@/lib/types/utils/maybe"

export const createLayout =
    ({ head }: { head?: MaybePromise<ReactNode> }) =>
    ({ children }: { children?: MaybePromise<ReactNode> }) => (
        <html>
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                {head}
            </head>
            <body>{children}</body>
        </html>
    )
