export const isPlainObject = (obj: unknown) => {
    if (obj == null) return false
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proto = Object.getPrototypeOf(obj)
    return proto === Object.prototype || proto === null
}
