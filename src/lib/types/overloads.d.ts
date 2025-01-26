import type { Split } from "type-fest"

import type { At } from "./utils/at"
import type { Entries } from "./utils/entries"
import type { FromEntries } from "./utils/fromEntries"
import type { Reverse } from "./utils/reverse"

declare global {
    interface String {
        at<T extends string, I extends number>(this: T, index: I): At<Split<T, "">, I>
        split<T extends string, S extends string>(this: T, separator: S): Split<T, S>
    }

    interface Array {
        at<T extends Array<unknown>, I extends number>(this: T, index: I): At<T, I>
        reverse<T extends Array<unknown>>(this: T): Reverse<T>
    }

    interface ReadonlyArray {
        at<T extends ReadonlyArray<unknown>, I extends number>(this: T, index: I): At<[...T], I>
        reverse<T extends Array<unknown>>(this: T): Reverse<[...T]>
    }

    interface ObjectConstructor {
        entries<T extends Record<PropertyKey, unknown> | ArrayLike<unknown>>(o: T): Entries<T>
        fromEntries<T extends Array<readonly [PropertyKey, unknown]>>(entries: T): FromEntries<T>
        keys<T>(o: T): (keyof T)[]
    }
}

export {}
