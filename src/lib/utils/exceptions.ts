export const shouldBeError = (e: unknown): Error =>
    e instanceof Error ? e : new TypeError(`Cannot throw a non-throwable type '${typeof e}'`)

export const wrapWithTryCatch = <R>(cb: () => R): R | Error => {
    try {
        return cb()
    } catch (e) {
        return shouldBeError(e)
    }
}

export const wrapWithTryCatchAsync = async <R>(cb: () => Promise<R>): Promise<R | Error> => {
    try {
        return await cb()
    } catch (e) {
        return shouldBeError(e)
    }
}

export abstract class Warning {
    message: string

    stack: string

    constructor(message: string) {
        this.message = message
        this.stack = `Warning: ${message}`
    }
}
