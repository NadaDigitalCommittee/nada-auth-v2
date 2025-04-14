import type { ArraySlice, ArrayValues, Split } from "type-fest"

import type { ArrayMap } from "./utils/array"
import type { At } from "./utils/at"
import type { Entries } from "./utils/entries"
import type { FromEntries } from "./utils/fromEntries"
import type { Reverse } from "./utils/reverse"

interface DevEnv {
    DEV: true
    PROD: false
}
interface ProdEnv {
    DEV: false
    PROD: true
}
declare global {
    interface String {
        at<T extends string, I extends number>(
            this: T,
            index: I,
        ): At<Split<T, "", { strictLiteralChecks: true }>, I>
        split<T extends string, S extends string>(
            this: T,
            separator: S,
        ): Split<T, S, { strictLiteralChecks: true }>
    }

    interface Array {
        at<T extends Array<unknown>, I extends number>(this: T, index: I): At<T, I>
        reverse<T extends Array<unknown>>(this: T): Reverse<T>
        slice<T extends Array<unknown>, Start extends number = 0, End extends number = T["length"]>(
            this: T,
            start?: Start,
            end?: End,
        ): ArraySlice<T, Start, End>
        /* eslint-disable @typescript-eslint/no-explicit-any */
        map<T extends Array<unknown>, U>(
            this: T,
            callbackfn: (value: ArrayValues<T>, index: number, array: T) => U,
            thisArg?: any,
        ): ArrayMap<T, U>
        /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    interface ReadonlyArray {
        at<T extends ReadonlyArray<unknown>, I extends number>(this: T, index: I): At<[...T], I>
        reverse<T extends ReadonlyArray<unknown>>(this: T): Reverse<[...T]>
        slice<
            T extends ReadonlyArray<unknown>,
            Start extends number = 0,
            End extends number = T["length"],
        >(
            this: T,
            start?: Start,
            end?: End,
        ): ArraySlice<T, Start, End>
        /* eslint-disable @typescript-eslint/no-explicit-any */
        map<T extends ReadonlyArray<unknown>, U>(
            this: T,
            callbackfn: (value: ArrayValues<T>, index: number, array: T) => U,
            thisArg?: any,
        ): ArrayMap<[...T], U>
        /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    interface ObjectConstructor {
        entries<const T extends Record<PropertyKey, unknown>>(o: T): Entries<T>
        fromEntries<const T extends Array<[PropertyKey, unknown]>>(entries: T): FromEntries<T>
        keys<const T>(o: T): `${Exclude<keyof T, symbol>}`[]
    }

    interface ImportMeta {
        env: NodeJS.ProcessEnv & (DevEnv | ProdEnv)
    }

    interface ReadonlyMap<K, V> {
        get(key: K): V
        has(key: unknown): key is K
    }

    // es2015.collection
    interface ReadonlyMapConstructor extends MapConstructor {
        new (): ReadonlyMap<unknown, unknown>
        new <K, V>(entries?: readonly (readonly [K, V])[] | null): ReadonlyMap<K, V>
        readonly prototype: ReadonlyMap<unknown, unknown>
    }

    // es2015.iterable
    interface ReadonlyMapConstructor {
        new (): ReadonlyMap<unknown, unknown>
        new <K, V>(iterable?: Iterable<readonly [K, V]> | null): ReadonlyMap<K, V>
    }
    declare const ReadonlyMap: ReadonlyMapConstructor
}

export {}
