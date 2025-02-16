/**
 * Generates a sequence of numbers in a specified range, excluding the end value.
 *
 * @param from - The starting value of the range.
 * @param to - The end value of the range (exclusive).
 * @param step - The increment (or decrement) value for each step in the range. Defaults to 1 if `from` is less than `to`, otherwise -1.
 * @yields The next number in the range sequence.
 *
 * @see [./tests/range.test.ts]({@link ./tests/range.test.ts})
 * @example
 * ```ts
 * // Generates numbers from 1 to 4
 * for (const num of exclusiveRange(1, 5)) {
 *     console.log(num); // 1, 2, 3, 4
 * }
 *
 * // Generates numbers from 5 to 2
 * for (const num of exclusiveRange(5, 1)) {
 *     console.log(num); // 5, 4, 3, 2
 * }
 * ```
 */
export function* exclusiveRange(from: number, to: number, step: number = from < to ? 1 : -1) {
    for (let i: number = from; 0 < step * (to - i); i += step) {
        yield i
    }
}
