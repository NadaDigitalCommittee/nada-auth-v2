import { Alert, AlertTitle, css } from "@mui/material"
import type { ReactNode } from "react"

export const ErrorAlert = ({ title, children }: { title?: ReactNode; children: ReactNode }) => (
    <Alert
        severity="error"
        css={css`
            width: 100%;
            box-sizing: border-box;
        `}
    >
        {title && <AlertTitle>{title}</AlertTitle>}
        {children}
    </Alert>
)
