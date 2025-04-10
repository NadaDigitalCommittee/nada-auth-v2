import { type AppStep } from "@/components/App"

export const appSteps = [
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
        nameVerbose: "アクセス許可",
    },
    {
        name: "完了",
        nameVerbose: "完了",
    },
] as const satisfies AppStep[]
