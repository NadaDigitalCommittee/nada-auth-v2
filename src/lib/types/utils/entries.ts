// https://zenn.dev/8times12/articles/ff08c1fac412c9
export type Entries<T extends object> = (keyof T extends infer U
    ? U extends keyof T
        ? [U, T[U]]
        : never
    : never)[]
