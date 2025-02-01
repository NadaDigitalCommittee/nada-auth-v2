import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import type { ReactNode } from "react"

export const createLayout =
    ({ head }: { head?: ReactNode }) =>
    ({ children }: { children?: ReactNode }) => (
        <html>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                {head}
            </head>
            <body>
                <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
            </body>
        </html>
    )
