import { Step, StepLabel, Stepper, Typography, css } from "@mui/material"

export type AppStep = {
    name: string
    nameVerbose: string
}
export const appSteps: AppStep[] = [
    {
        name: "情報入力",
        nameVerbose: "プロフィール情報を入力",
    },
    {
        name: "サインイン",
        nameVerbose: "Google でサインイン",
    },
    {
        name: "アクセス許可",
    },
    {
        name: "完了",
    },
].map((step) => ({ nameVerbose: step.name, ...step }))

export const AppStepper = ({ activeStep }: { activeStep: number }) => (
    <>
        <Typography
            variant="h1"
            css={css`
                font-size: 1.5rem;
                font-weight: normal;
            `}
        >
            {appSteps[activeStep].nameVerbose}
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
    </>
)
