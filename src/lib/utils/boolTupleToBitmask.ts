import type { BoolTupleToBitmask, ValuesToBitmask } from "@/lib/types/utils/boolTupleToBitmask"

/**
 *
 * @description Boolean の組を受け取り、それと一意に対応するビットマスクを返す。2 個以上の Boolean 条件で switch するためのユーティリティ
 */
export const boolTupleToBitmask = <T extends boolean[]>(...tuple: T) =>
    tuple.reverse().reduce<number>((acc, cur, i) => acc | (+cur << i), 0) as BoolTupleToBitmask<T>

/**
 *
 * @description 意地でも Narrowing をはたらかせるためのユーティリティ
 */
export const valuesToBitmask = <T extends unknown[]>(...values: T) =>
    ({
        bitmask: boolTupleToBitmask(...values.map(Boolean)),
        bindings: values,
    }) as ValuesToBitmask<T>
