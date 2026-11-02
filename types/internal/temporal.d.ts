/**
 * The single place where orasna reads the Temporal global, plus
 * type detection helpers that work for native and polyfilled Temporal.
 */
export type TypeName = 'PlainDate' | 'PlainTime' | 'PlainDateTime' | 'PlainYearMonth' | 'PlainMonthDay' | 'ZonedDateTime' | 'Instant' | 'Duration';
/**
 * @typedef {'PlainDate' | 'PlainTime' | 'PlainDateTime' | 'PlainYearMonth' | 'PlainMonthDay'
 *   | 'ZonedDateTime' | 'Instant' | 'Duration'} TypeName
 */
/** @type {readonly TypeName[]} */
export declare const ALL_TYPE_NAMES: readonly TypeName[];
/**
 * Returns `globalThis.Temporal`, read at call time.
 *
 * @returns {typeof Temporal}
 * @throws {TemporalKitEnvironmentError} When `globalThis.Temporal` is missing.
 */
export declare function getTemporal(): typeof Temporal;
/**
 * Returns the Temporal type name of a value, such as `'PlainDate'`, or `null`
 * when the value is not a Temporal object. Uses `Symbol.toStringTag` rather
 * than `instanceof` so native and polyfilled objects are both recognized.
 *
 * @param {unknown} value
 * @returns {TypeName | null}
 */
export declare function typeOf(value: unknown): TypeName | null;
/**
 * Describes a value for error messages: `Temporal.PlainDate 2026-11-02`,
 * `string "abc"`, `null`, and so on.
 *
 * @param {unknown} value
 * @returns {string}
 */
export declare function describeValue(value: unknown): string;
/**
 * Asserts that a value is a Temporal object of one of the allowed types and
 * returns its type name. Also ensures Temporal is available.
 *
 * @param {unknown} value
 * @param {readonly TypeName[]} allowedTypes
 * @param {string} context Function and parameter name for error messages, e.g. `'startOf(value)'`.
 * @returns {TypeName}
 * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE`.
 */
export declare function assertType(value: unknown, allowedTypes: readonly TypeName[], context: string): TypeName;
/**
 * Asserts that every value is a Temporal object of the same allowed type and
 * returns that type name.
 *
 * @param {readonly unknown[]} values
 * @param {readonly TypeName[]} allowedTypes
 * @param {string} context Function name for error messages, e.g. `'isBefore'`.
 * @returns {TypeName}
 * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` or `TYPE_MISMATCH`.
 */
export declare function assertSameType(values: readonly unknown[], allowedTypes: readonly TypeName[], context: string): TypeName;
