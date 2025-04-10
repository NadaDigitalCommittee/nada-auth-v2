import { Box, Divider, Stack, Step, StepLabel, Stepper, Typography, css } from "@mui/material"
import type { ReactNode } from "react"

export type AppStep = {
    name: string
    nameVerbose: string
}

export const App = ({
    appSteps,
    activeStep,
    children,
}: {
    appSteps: AppStep[]
    activeStep: number
    children: ReactNode
}) => (
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
            <Typography
                variant="h1"
                css={css`
                    font-size: 1.5rem;
                    font-weight: normal;
                `}
            >
                {appSteps[activeStep]?.nameVerbose}
            </Typography>
            <Stepper
                activeStep={activeStep}
                alternativeLabel
                sx={{
                    width: "100%",
                }}
            >
                {appSteps.map((step) => (
                    <Step key={step.name}>
                        <StepLabel
                            css={css`
                                white-space: nowrap;
                            `}
                        >
                            {step.name}
                        </StepLabel>
                    </Step>
                ))}
            </Stepper>
            <Divider flexItem />
            {children}
        </Stack>
    </Box>
)
