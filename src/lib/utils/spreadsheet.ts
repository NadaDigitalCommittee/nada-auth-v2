import type { sheets_v4 } from "googleapis"

export const sheetId = 0
export const valuesRangeA1 = "A2:I"

const BASE26_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const BASE = 26
const indexToA1Digits = (n: number, acc: number[] = []): string[] => {
    const digits = n < BASE ? [] : indexToA1Digits(~-(n / BASE), acc)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    digits.push(BASE26_DIGITS[n % BASE]!)
    return digits
}

export const zeroBasedRangeToA1Notation = (colIndex: number, rowIndex: number) =>
    `${indexToA1Digits(colIndex).join("")}${rowIndex + 1}`

// prettier-ignore
const header = [
    ["種別","利用者の種別にマッチします。\n0が生徒、-1がそれ以外の利用者（教職員など）に対応します。"],
    ["学年", "利用者が生徒の場合、学年を表す1, 2, 3, 4, 5, 6の数字にマッチします。"],
    ["回生", "利用者が生徒の場合、何回生かを表す数字にマッチします。"],
    ["組", "利用者が生徒の場合、組を表す数字にマッチします。"],
    ["番号", "利用者が生徒の場合、出席番号を表す数字にマッチします。"],
    ["姓", "利用者の姓（上の名前）にマッチします。\nこの項目は字形の差異による影響を受けやすいため、他の項目で代用することを検討してください。"],
    ["名", "利用者の名（下の名前）にマッチします。\nこの項目は字形の差異による影響を受けやすいため、他の項目で代用することを検討してください。"],
    ["ロール", "利用者に付与するロールのIDを入力します。先頭にハイフンマイナス（-）をつけると、すでに付与されているロールを削除できます。"],
    ["ニックネーム", "利用者に設定するニックネームを表す、フォーマット指定子を含んだ文字列を入力します。"],
] as const

const maxRowIndex = 1000

const headerRange = {
    sheetId,
    startColumnIndex: 0,
    startRowIndex: 0,
    endColumnIndex: 9,
    endRowIndex: 1,
} as const satisfies sheets_v4.Schema$GridRange

const valuesRange = {
    sheetId,
    startColumnIndex: 0,
    startRowIndex: 0,
    endColumnIndex: 9,
    endRowIndex: maxRowIndex,
} as const satisfies sheets_v4.Schema$GridRange

export const spreadsheetInit: sheets_v4.Schema$Request[] = [
    {
        updateCells: {
            range: headerRange,
            rows: [
                {
                    values: header.map(([stringValue, note]) => ({
                        userEnteredValue: { stringValue },
                        note,
                    })),
                },
            ],
            fields: "userEnteredValue.stringValue,note",
        },
    },
    {
        updateSheetProperties: {
            properties: {
                sheetId,
                gridProperties: {
                    frozenRowCount: 1,
                },
            },
            fields: "gridProperties.frozenRowCount",
        },
    },
    {
        updateDimensionProperties: {
            range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: 5,
            },
            properties: {
                pixelSize: 40,
            },
            fields: "pixelSize",
        },
    },
    {
        updateDimensionProperties: {
            range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 5,
                endIndex: 7,
            },
            properties: {
                pixelSize: 80,
            },
            fields: "pixelSize",
        },
    },
    {
        updateDimensionProperties: {
            range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 7,
                endIndex: 9,
            },
            properties: {
                pixelSize: 160,
            },
            fields: "pixelSize",
        },
    },
    {
        updateBorders: {
            range: {
                sheetId,
                startRowIndex: 0,
                startColumnIndex: 6,
                endRowIndex: maxRowIndex,
                endColumnIndex: 7,
            },
            right: {
                style: "SOLID",
            },
        },
    },
    {
        updateBorders: {
            range: {
                sheetId,
                startRowIndex: 0,
                startColumnIndex: 8,
                endRowIndex: maxRowIndex,
                endColumnIndex: 9,
            },
            right: {
                style: "SOLID",
            },
        },
    },
    {
        addProtectedRange: {
            protectedRange: {
                range: headerRange,
                warningOnly: true,
            },
        },
    },
    {
        repeatCell: {
            range: valuesRange,
            cell: {
                userEnteredFormat: {
                    wrapStrategy: "WRAP",
                    horizontalAlignment: "CENTER",
                    verticalAlignment: "MIDDLE",
                },
            },
            fields: "userEnteredFormat.wrapStrategy,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment",
        },
    },
]
