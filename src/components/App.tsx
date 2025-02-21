import { Box, Divider, Stack, css } from "@mui/material"
import type { ReactNode } from "react"

import { AppStepper } from "./AppStepper"

export const App = ({ activeStep, children }: { activeStep: number; children: ReactNode }) => (
    <Box
        css={css`
            display: grid;
            place-items: center;
            width: 100%;
            height: 100vh;
            margin: 0;
        `}
    >
        <Stack
            css={css`
                margin: auto;
                padding: 2rem;
                @media (max-width: 400px) {
                    padding: 1rem;
                }
                width: fit-content;
                box-sizing: border-box;
                border: none;
                border-radius: 1rem;
            `}
            sx={{
                boxShadow: 2,
            }}
            alignItems="center"
            justifyContent="center"
            spacing={2}
            component="main"
        >
            <AppStepper activeStep={activeStep} />
            <Divider flexItem />
            {children}
        </Stack>
    </Box>
)
