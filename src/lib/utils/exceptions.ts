import { constant } from "./fp"

export const orNull = constant(null)

export abstract class Warning {
    message: string

    stack: string

    constructor(message: string) {
        this.message = message
        this.stack = `Warning: ${message}`
    }
}
