import type { Split } from "type-fest"

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
    }

    interface ReadonlyArray {
        at<T extends ReadonlyArray<unknown>, I extends number>(this: T, index: I): At<[...T], I>
        reverse<T extends ReadonlyArray<unknown>>(this: T): Reverse<[...T]>
    }

    interface ObjectConstructor {
        entries<const T extends Record<PropertyKey, unknown>>(o: T): Entries<T>
        fromEntries<const T extends Array<[PropertyKey, unknown]>>(entries: T): FromEntries<T>
        keys<const T>(o: T): `${Exclude<keyof T, symbol>}`[]
    }

    interface ImportMeta {
        env: NodeJS.ProcessEnv & (DevEnv | ProdEnv)
    }
}

export {}
