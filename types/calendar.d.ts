/**
 * Calendar navigation: start of day/week/month/quarter/year, weekday search,
 * and nth weekday of a month.
 *
 * There is deliberately no `endOf()` for date-times: "23:59:59.999" bounds
 * cause off-by-one bugs. Use `startOfNext()` as an exclusive end instead.
 *
 * @module orasna/calendar
 */
/**
 * ISO weekday numbers, matching `Temporal.PlainDate.prototype.dayOfWeek`.
 */
export declare const Weekday: Readonly<{
    MONDAY: 1;
    TUESDAY: 2;
    WEDNESDAY: 3;
    THURSDAY: 4;
    FRIDAY: 5;
    SATURDAY: 6;
    SUNDAY: 7;
}>;
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Unit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type CalendarValue = Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
export type WeekOptions = {
    weekStartsOn?: WeekdayNumber;
};
/**
 * Returns the start of the day, week, month, quarter, or year containing
 * `value`, as the same type.
 *
 * @template {CalendarValue} T
 * @param {T} value
 * @param {Unit} unit
 * @param {WeekOptions} [options] `weekStartsOn` defaults to 1 (Monday).
 * @returns {T}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When `value` is not a PlainDate, PlainDateTime, or ZonedDateTime.
 * @throws {TemporalKitConfigError} When `unit` or `weekStartsOn` is invalid.
 * @example
 * startOf(Temporal.PlainDate.from('2026-11-05'), 'week'); // 2026-11-02 (Monday)
 */
export declare function startOf<T extends CalendarValue>(value: T, unit: Unit, options?: WeekOptions): T;
/**
 * Returns the start of the unit after the one containing `value`. Use it as
 * the exclusive end of a range: `[startOf(x, 'month'), startOfNext(x, 'month'))`.
 *
 * @template {CalendarValue} T
 * @param {T} value
 * @param {Unit} unit
 * @param {WeekOptions} [options] `weekStartsOn` defaults to 1 (Monday).
 * @returns {T}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When `value` is not a PlainDate, PlainDateTime, or ZonedDateTime.
 * @throws {TemporalKitConfigError} When `unit` or `weekStartsOn` is invalid.
 * @example
 * startOfNext(Temporal.PlainDateTime.from('2026-11-05T10:00'), 'month'); // 2026-12-01T00:00:00
 */
export declare function startOfNext<T extends CalendarValue>(value: T, unit: Unit, options?: WeekOptions): T;
/**
 * Returns the last date of the week, month, quarter, or year containing `date`.
 *
 * @param {Temporal.PlainDate} date
 * @param {'week' | 'month' | 'quarter' | 'year'} unit
 * @param {WeekOptions} [options] `weekStartsOn` defaults to 1 (Monday).
 * @returns {Temporal.PlainDate}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When `date` is not a PlainDate.
 * @throws {TemporalKitConfigError} When `unit` is `'day'` or unknown, or `weekStartsOn` is invalid.
 * @example
 * lastDayOf(Temporal.PlainDate.from('2028-02-10'), 'month'); // 2028-02-29
 */
export declare function lastDayOf(date: Temporal.PlainDate, unit: 'week' | 'month' | 'quarter' | 'year', options?: WeekOptions): Temporal.PlainDate;
/**
 * Returns the next date that falls on `weekday`. With `includeToday: true`,
 * `date` itself is returned when it already falls on `weekday`.
 *
 * @param {Temporal.PlainDate} date
 * @param {WeekdayNumber} weekday ISO weekday, 1 (Monday) to 7 (Sunday).
 * @param {{ includeToday?: boolean }} [options]
 * @returns {Temporal.PlainDate}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When `date` is not a PlainDate.
 * @throws {TemporalKitConfigError} When `weekday` or an option is invalid.
 * @example
 * nextWeekday(Temporal.PlainDate.from('2026-11-02'), Weekday.FRIDAY); // 2026-11-06
 */
export declare function nextWeekday(date: Temporal.PlainDate, weekday: WeekdayNumber, options?: {
    includeToday?: boolean;
}): Temporal.PlainDate;
/**
 * Returns the previous date that falls on `weekday`. With `includeToday: true`,
 * `date` itself is returned when it already falls on `weekday`.
 *
 * @param {Temporal.PlainDate} date
 * @param {WeekdayNumber} weekday ISO weekday, 1 (Monday) to 7 (Sunday).
 * @param {{ includeToday?: boolean }} [options]
 * @returns {Temporal.PlainDate}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When `date` is not a PlainDate.
 * @throws {TemporalKitConfigError} When `weekday` or an option is invalid.
 * @example
 * previousWeekday(Temporal.PlainDate.from('2026-11-02'), Weekday.FRIDAY); // 2026-10-30
 */
export declare function previousWeekday(date: Temporal.PlainDate, weekday: WeekdayNumber, options?: {
    includeToday?: boolean;
}): Temporal.PlainDate;
/**
 * Returns the nth occurrence of `weekday` in `month`, or `null` when that
 * occurrence does not exist (for example, a 5th Monday). `n = -1` means the
 * last occurrence.
 *
 * @param {Temporal.PlainYearMonth} month
 * @param {WeekdayNumber} weekday ISO weekday, 1 (Monday) to 7 (Sunday).
 * @param {1 | 2 | 3 | 4 | 5 | -1} n
 * @returns {Temporal.PlainDate | null}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When `month` is not a PlainYearMonth.
 * @throws {TemporalKitConfigError} When `weekday` or `n` is invalid.
 * @example
 * nthWeekdayOfMonth(Temporal.PlainYearMonth.from('2026-11'), Weekday.MONDAY, 5); // 2026-11-30
 */
export declare function nthWeekdayOfMonth(month: Temporal.PlainYearMonth, weekday: WeekdayNumber, n: 1 | 2 | 3 | 4 | 5 | -1): Temporal.PlainDate | null;
