import type { AppStep } from "@/components/App"

export const appSteps = [
    {
        name: "サインイン",
        nameVerbose: "Google でサインイン",
    },
    {
        name: "アクセス許可",
        nameVerbose: "アクセス許可",
    },
    {
        name: "フォルダ選択",
        nameVerbose: "スプレッドシートを作成するフォルダを選択",
    },
    {
        name: "完了",
        nameVerbose: "完了",
    },
] as const satisfies AppStep[]
