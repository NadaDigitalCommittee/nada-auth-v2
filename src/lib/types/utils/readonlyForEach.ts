export type ReadonlyForEach<T> = {
    [K in keyof T]: Readonly<T[K]>
}
