export const shouldBeError = (e: unknown): Error =>
    e instanceof Error ? e : new TypeError(`Cannot throw a non-throwable type '${typeof e}'`)

export abstract class Warning {
    message: string

    stack: string

    constructor(message: string) {
        this.message = message
        this.stack = `Warning: ${message}`
    }
}
