export type BoolToNumber<B extends boolean> = B extends true ? 1 : B extends false ? 0 : 0 | 1
