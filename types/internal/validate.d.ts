/**
 * Argument validation and small string helpers shared by the modules.
 */
/**
 * Returns the options object, or an empty object when `options` is undefined.
 *
 * @template {object} O
 * @param {O | undefined} options
 * @param {string} context
 * @returns {Partial<O>}
 * @throws {TemporalKitConfigError} When options is not an object.
 */
export declare function readOptions<O extends object>(options: O | undefined, context: string): Partial<O>;
/**
 * Asserts that a value is one of the allowed literal values.
 *
 * @template T
 * @param {unknown} value
 * @param {readonly T[]} allowed
 * @param {string} context Name of the argument or option, e.g. `"startOf() unit"`.
 * @returns {T}
 * @throws {TemporalKitConfigError}
 */
export declare function assertOneOf<T>(value: unknown, allowed: readonly T[], context: string): T;
/**
 * Asserts that a value is an integer.
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {number}
 * @throws {TemporalKitConfigError}
 */
export declare function assertInteger(value: unknown, context: string): number;
/**
 * Asserts that a value is a boolean.
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {boolean}
 * @throws {TemporalKitConfigError}
 */
export declare function assertBoolean(value: unknown, context: string): boolean;
/**
 * Asserts that a value is an ISO weekday number, 1 (Monday) to 7 (Sunday).
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {number}
 * @throws {TemporalKitConfigError}
 */
export declare function assertWeekday(value: unknown, context: string): number;
/**
 * Validates a time zone ID and returns its canonical form, such as
 * `'Asia/Manila'` for `'asia/manila'`.
 *
 * @param {unknown} timeZoneId
 * @param {string} context
 * @returns {string}
 * @throws {TemporalKitConfigError} When the ID is missing or not a known time zone.
 */
export declare function assertTimeZoneId(timeZoneId: unknown, context: string): string;
/**
 * Left-pads a non-negative integer with zeros.
 *
 * @param {number} value
 * @param {number} width
 * @returns {string}
 */
export declare function padNumber(value: number, width: number): string;
/**
 * Splits a string of 1 to 9 fractional-second digits into sub-second fields.
 * `'5'` means 500 milliseconds; `'000123'` means 123 microseconds.
 *
 * @param {string | undefined} digits
 * @returns {{ millisecond: number, microsecond: number, nanosecond: number }}
 */
export declare function parseFractionDigits(digits: string | undefined): {
    millisecond: number;
    microsecond: number;
    nanosecond: number;
};
