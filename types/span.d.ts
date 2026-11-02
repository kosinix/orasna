/**
 * Durations from wall-clock times, including shifts that cross midnight,
 * plus totals and clock-style duration text.
 *
 * For locale-aware duration text, use `Intl.DurationFormat`.
 *
 * @module orasna/span
 */
export type ElapsedValue = Temporal.PlainDateTime | Temporal.ZonedDateTime | Temporal.Instant;
/**
 * Returns the duration between two wall-clock times. With `overnight: 'auto'`
 * (the default), an `end` earlier than `start` means the next day.
 *
 * @param {Temporal.PlainTime} start
 * @param {Temporal.PlainTime} end
 * @param {{ overnight?: 'auto' | 'never' }} [options]
 * @returns {Temporal.Duration} Balanced to hours; `PT0S` when start equals end.
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When start or end is not a PlainTime.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` when end is before start and `overnight` is `'never'`.
 * @throws {TemporalKitConfigError} When `overnight` is not `'auto'` or `'never'`.
 * @example
 * timeSpan(Temporal.PlainTime.from('22:00'), Temporal.PlainTime.from('06:00')); // PT8H
 */
export declare function timeSpan(start: Temporal.PlainTime, end: Temporal.PlainTime, options?: {
    overnight?: 'auto' | 'never';
}): Temporal.Duration;
/**
 * Returns the exact elapsed time between two values of the same type, with
 * `largestUnit: 'hour'`. For `ZonedDateTime`, DST changes are counted, so a
 * day can have 23 or 25 hours. The result is negative when `end` is before `start`.
 *
 * @template {ElapsedValue} T
 * @param {T} start
 * @param {T} end
 * @returns {Temporal.Duration}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the values are mixed or unsupported types.
 * @example
 * elapsed(
 *   Temporal.ZonedDateTime.from('2026-03-08T00:00[America/New_York]'),
 *   Temporal.ZonedDateTime.from('2026-03-08T04:00[America/New_York]'),
 * ); // PT3H
 */
export declare function elapsed<T extends ElapsedValue>(start: T, end: T): Temporal.Duration;
/**
 * Returns the total number of hours in a duration, including fractions.
 * Days count as 24 hours.
 *
 * @param {Temporal.Duration} duration
 * @returns {number}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a Duration.
 * @throws {TemporalKitRangeError} With code `NEEDS_REFERENCE_DATE` for years, months, or weeks.
 * @example
 * totalHours(Temporal.Duration.from('PT7H45M')); // 7.75
 */
export declare function totalHours(duration: Temporal.Duration): number;
/**
 * Returns the total number of minutes in a duration, including fractions.
 * Days count as 24 hours.
 *
 * @param {Temporal.Duration} duration
 * @returns {number}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a Duration.
 * @throws {TemporalKitRangeError} With code `NEEDS_REFERENCE_DATE` for years, months, or weeks.
 * @example
 * totalMinutes(Temporal.Duration.from('PT1H30M')); // 90
 */
export declare function totalMinutes(duration: Temporal.Duration): number;
/**
 * Adds a list of durations and balances the result to `largestUnit: 'hour'`.
 * An empty list returns `PT0S`.
 *
 * @param {Temporal.Duration[]} list
 * @returns {Temporal.Duration}
 * @throws {TemporalKitConfigError} When `list` is not an array.
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When an item is not a Duration.
 * @throws {TemporalKitRangeError} With code `NEEDS_REFERENCE_DATE` when an item has years, months, or weeks.
 * @example
 * sumDurations([Temporal.Duration.from('PT7H45M'), Temporal.Duration.from('PT8H30M')]); // PT16H15M
 */
export declare function sumDurations(list: Temporal.Duration[]): Temporal.Duration;
/**
 * Formats a duration as clock text such as `'8:30'`, `'-0:15'`, or `'27:05'`.
 * Hours are not wrapped at 24, and smaller units are truncated toward zero.
 *
 * @param {Temporal.Duration} duration
 * @param {'h:mm' | 'h:mm:ss'} pattern
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a Duration.
 * @throws {TemporalKitRangeError} With code `NEEDS_REFERENCE_DATE` for years, months, or weeks.
 * @throws {TemporalKitConfigError} When the pattern is not `'h:mm'` or `'h:mm:ss'`.
 * @example
 * formatClockDuration(Temporal.Duration.from('PT27H5M'), 'h:mm'); // '27:05'
 */
export declare function formatClockDuration(duration: Temporal.Duration, pattern: 'h:mm' | 'h:mm:ss'): string;
