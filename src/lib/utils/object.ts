import type { IsAny, IsUnknown, Or, Paths } from "type-fest"

export const isPlainObject = (obj: unknown) => {
    if (obj == null) return false
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proto = Object.getPrototypeOf(obj)
    return proto === Object.prototype || proto === null
}

type ObjectPathsReturnType<T> = Array<Or<IsUnknown<T>, IsAny<T>> extends true ? string : Paths<T>>
type ObjectPathsOptions = Partial<{
    fullPathOnly: boolean
}>

export const objectPaths = <T>(obj: T, options?: ObjectPathsOptions): ObjectPathsReturnType<T> => {
    if (obj == null) return []
    if (isPlainObject(obj) || Array.isArray(obj)) {
        // Object.entriesでsymbolはスキップされる
        return (Object.entries(obj) as [Exclude<PropertyKey, symbol>, unknown][]).flatMap(
            ([key, value]) => {
                const paths = objectPaths(value, options).map((path) => `${key}.${path}`)
                if (options?.fullPathOnly) {
                    return paths.length ? paths : [`${key}`]
                } else {
                    return [`${key}`, ...paths]
                }
            },
        ) as ObjectPathsReturnType<T>
    } else return []
}
