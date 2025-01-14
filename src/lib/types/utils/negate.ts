export type NegateBool<B extends boolean> = B extends true ? false : true

export type NegateNumber<N extends number> = number extends N
    ? number
    : N extends 0
      ? 0
      : `-${N}` extends `${infer M extends number}`
        ? M
        : `${N}` extends `-${infer M extends number}`
          ? M
          : never
