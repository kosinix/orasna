/**
 * Readable comparisons for Temporal values, replacing
 * `Temporal.X.compare(a, b) > 0` style checks.
 *
 * @module orasna/compare
 */
export type Comparable = Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime | Temporal.PlainYearMonth | Temporal.ZonedDateTime | Temporal.Instant;
export type Bounds = '[)' | '[]' | '()' | '(]';
/**
 * Returns true when `a` is strictly before `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isBefore(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-03')); // true
 */
export declare function isBefore<T extends Comparable>(a: T, b: T): boolean;
/**
 * Returns true when `a` is strictly after `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isAfter(Temporal.PlainTime.from('14:00'), Temporal.PlainTime.from('09:00')); // true
 */
export declare function isAfter<T extends Comparable>(a: T, b: T): boolean;
/**
 * Returns true when `a` is before or equal to `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isSameOrBefore(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-02')); // true
 */
export declare function isSameOrBefore<T extends Comparable>(a: T, b: T): boolean;
/**
 * Returns true when `a` is after or equal to `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isSameOrAfter(Temporal.PlainDate.from('2026-11-03'), Temporal.PlainDate.from('2026-11-02')); // true
 */
export declare function isSameOrAfter<T extends Comparable>(a: T, b: T): boolean;
/**
 * Returns true when `Temporal.X.compare(a, b) === 0`. Two `ZonedDateTime`
 * values in different time zones are the same moment when they refer to the
 * same instant; use `a.equals(b)` to also require the same zone and calendar.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isSameMoment(
 *   Temporal.ZonedDateTime.from('2026-11-02T14:00[Asia/Manila]'),
 *   Temporal.ZonedDateTime.from('2026-11-02T06:00[UTC]'),
 * ); // true
 */
export declare function isSameMoment<T extends Comparable>(a: T, b: T): boolean;
/**
 * Returns true when `value` lies between `start` and `end`. Bounds default to
 * `'[)'`: start included, end excluded.
 *
 * @template {Comparable} T
 * @param {T} value
 * @param {T} start
 * @param {T} end
 * @param {{ bounds?: Bounds }} [options]
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @throws {TemporalKitConfigError} When `bounds` is not one of `'[)'`, `'[]'`, `'()'`, `'(]'`.
 * @example
 * const noon = Temporal.PlainTime.from('12:00');
 * isBetween(noon, Temporal.PlainTime.from('08:00'), noon); // false: end is excluded
 */
export declare function isBetween<T extends Comparable>(value: T, start: T, end: T, options?: {
    bounds?: Bounds;
}): boolean;
/**
 * Returns the earliest of one or more values of the same type.
 *
 * @template {Comparable} T
 * @param {...T} values
 * @returns {T}
 * @throws {TemporalKitConfigError} When called with no values.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * earliest(Temporal.PlainDate.from('2026-11-05'), Temporal.PlainDate.from('2026-11-02')); // 2026-11-02
 */
export declare function earliest<T extends Comparable>(...values: T[]): T;
/**
 * Returns the latest of one or more values of the same type.
 *
 * @template {Comparable} T
 * @param {...T} values
 * @returns {T}
 * @throws {TemporalKitConfigError} When called with no values.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * latest(Temporal.PlainDate.from('2026-11-05'), Temporal.PlainDate.from('2026-11-02')); // 2026-11-05
 */
export declare function latest<T extends Comparable>(...values: T[]): T;
/**
 * Comparator for `Array.prototype.sort` that orders values from earliest to latest.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {number} -1, 0, or 1.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * dates.sort(ascending);
 */
export declare function ascending<T extends Comparable>(a: T, b: T): number;
/**
 * Comparator for `Array.prototype.sort` that orders values from latest to earliest.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {number} -1, 0, or 1.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * dates.sort(descending);
 */
export declare function descending<T extends Comparable>(a: T, b: T): number;
export type Comparison<T extends Comparable> = {
    readonly value: T;
    before(other: T): boolean;
    after(other: T): boolean;
    sameOrBefore(other: T): boolean;
    sameOrAfter(other: T): boolean;
    sameMomentAs(other: T): boolean;
    between(start: T, end: T, options?: {
        bounds?: Bounds;
    }): boolean;
};
/**
 * The comparisons available on `is(value)`. Each method compares the wrapped
 * value with its arguments, which must be the same Temporal type.
 *
 * @template {Comparable} T
 * @typedef {{
 *   readonly value: T,
 *   before(other: T): boolean,
 *   after(other: T): boolean,
 *   sameOrBefore(other: T): boolean,
 *   sameOrAfter(other: T): boolean,
 *   sameMomentAs(other: T): boolean,
 *   between(start: T, end: T, options?: { bounds?: Bounds }): boolean,
 * }} Comparison
 */
/**
 * Wraps a value for comparisons that read like a sentence:
 * `is(submitted).before(due)` instead of `isBefore(submitted, due)`. Each
 * method gives the same result and throws the same errors as the matching
 * function: `before` is `isBefore`, `after` is `isAfter`, `sameOrBefore` is
 * `isSameOrBefore`, `sameOrAfter` is `isSameOrAfter`, `sameMomentAs` is
 * `isSameMoment`, and `between` is `isBetween`.
 *
 * @template {Comparable} T
 * @param {T} value
 * @returns {Comparison<T>} A frozen object; each method returns a boolean.
 * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` when the value is not a comparable Temporal type.
 *   The methods throw `TYPE_MISMATCH` when their arguments are a different type from the value.
 * @example
 * is(submitted).before(due);
 * is(Temporal.PlainTime.from('12:00')).between(Temporal.PlainTime.from('08:00'), Temporal.PlainTime.from('12:00')); // false
 */
export declare function is<T extends Comparable>(value: T): Comparison<T>;
