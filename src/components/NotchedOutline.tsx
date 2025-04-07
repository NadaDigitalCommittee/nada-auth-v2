import { Stack, Typography, css } from "@mui/material"
import type { PropsWithChildren, ReactNode } from "react"

export const NotchedOutline = ({
    children,
    label,
}: PropsWithChildren<{
    label: ReactNode
}>) => (
    <fieldset
        css={css`
            --caption-fontsize: 0.8rem;
            border: solid 1px #5a5a5a;
            border-radius: 5px;
            padding: 1rem;
            width: 100%;
            box-sizing: border-box;
            margin: 0;
        `}
    >
        <Typography
            variant="caption"
            component="legend"
            css={css`
                font-size: var(--caption-fontsize);
                padding: 0 0.3em;
            `}
        >
            {label}
        </Typography>
        <Stack
            direction="row"
            css={css`
                width: 100%;
                height: 100%;
                margin-top: calc(-1 * var(--caption-fontsize));
                align-items: center;
                justify-content: space-between;
            `}
        >
            {children}
        </Stack>
    </fieldset>
)
