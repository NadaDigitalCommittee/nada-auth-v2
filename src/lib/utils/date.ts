export const ACADEMIC_YEAR_FIRST_MONTH = 3 // 4 - 1

export const getJstAcademicYear = (date: Date) => {
    const jstDate = new Date(date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
    const jstYear = jstDate.getFullYear()
    const jstMonth = jstDate.getMonth()
    return jstYear - +(jstMonth < ACADEMIC_YEAR_FIRST_MONTH)
}
