export const id = <T>(input: T): T => input
/**
 * @description Narrowing
 */
export const inOperator = <T extends object>(key: PropertyKey, obj: T): key is keyof T => key in obj
