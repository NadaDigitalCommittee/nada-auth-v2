import type { BuildTuple } from "type-fest/source/internal"

import type { RepeatArray } from "./repeatArray"

// 非負整数どうしのみ
export type Multiply<M extends number, N extends number> = M extends infer _M extends number
    ? // @ts-expect-error 定義では出るが、それぞれの参照では出ないエラー
      // 型 '"length"' と 'keyof RepeatArray<BuildTuple<_M>, N>' を比較するスタックが深すぎます。ts(2321)
      //    https://susisu.hatenablog.com/entry/2020/09/12/214343 オブジェクトのプロパティ内で再帰する が使えるかも
      // 型 '"length"' はインデックスの種類 'RepeatArray<BuildTuple<_M>, N>' に使用できません。ts(2536)
      //    (たぶん) コンパイラの敗北
      // TODO: とりあえず再帰制限をなんとかする
      RepeatArray<BuildTuple<_M>, N>["length"]
    : never
