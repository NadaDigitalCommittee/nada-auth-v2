export const isPlainObject = (obj: unknown) => {
    if (obj == null) return false
    const proto: unknown = Object.getPrototypeOf(obj)
    return proto === Object.prototype || proto === null
}
