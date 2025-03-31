import { css } from "@mui/material"
import type { ReactNode } from "react"

export const createLayout = ({ head }: { head?: ReactNode }) =>
    function RootLayout({ children }: { children?: ReactNode }) {
        return (
            <html>
                <head>
                    <meta charSet="utf-8" />
                    <meta name="viewport" content="width=device-width,initial-scale=1" />
                    {head}
                </head>
                <body
                    css={css`
                        margin: 0;
                        padding: 0;
                    `}
                >
                    {children}
                </body>
            </html>
        )
    }
