import { css } from "@mui/material"
import type { ReactNode } from "react"

export const Unselectable = ({ children }: { children: ReactNode }) => (
    <span
        css={css`
            user-select: none;
        `}
    >
        {children}
    </span>
)
