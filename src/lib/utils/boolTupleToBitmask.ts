import type { BoolTupleToBitmask, ValuesPairToBitmask } from "@/lib/types/utils/boolTupleToBitmask"

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
export const valuesPairToBitmask = <T0, T1>(b0: T0, b1: T1) =>
    ({
        // @ts-expect-error ts2589 type-fest@4.33.0で出現 動作は正しいので後回し
        bitmask: boolTupleToBitmask(!!b0, !!b1),
        bindings: [b0, b1],
    }) as ValuesPairToBitmask<T0, T1>
