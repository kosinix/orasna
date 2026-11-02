/**
 * Calendar navigation: start of day/week/month/quarter/year, weekday search,
 * and nth weekday of a month.
 *
 * There is deliberately no `endOf()` for date-times: "23:59:59.999" bounds
 * cause off-by-one bugs. Use `startOfNext()` as an exclusive end instead.
 *
 * @module orasna/calendar
 */

import { TemporalKitConfigError } from './internal/errors.js';
import { assertType } from './internal/temporal.js';
import { assertBoolean, assertInteger, assertOneOf, assertWeekday, readOptions } from './internal/validate.js';

/**
 * ISO weekday numbers, matching `Temporal.PlainDate.prototype.dayOfWeek`.
 */
export const Weekday = Object.freeze({
  MONDAY: /** @type {1} */ (1),
  TUESDAY: /** @type {2} */ (2),
  WEDNESDAY: /** @type {3} */ (3),
  THURSDAY: /** @type {4} */ (4),
  FRIDAY: /** @type {5} */ (5),
  SATURDAY: /** @type {6} */ (6),
  SUNDAY: /** @type {7} */ (7),
});

/**
 * @typedef {1 | 2 | 3 | 4 | 5 | 6 | 7} WeekdayNumber
 * @typedef {'day' | 'week' | 'month' | 'quarter' | 'year'} Unit
 * @typedef {Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime} CalendarValue
 * @typedef {{ weekStartsOn?: WeekdayNumber }} WeekOptions
 */

/** @type {readonly Unit[]} */
const UNITS = Object.freeze(['day', 'week', 'month', 'quarter', 'year']);

/** @type {readonly ('week' | 'month' | 'quarter' | 'year')[]} */
const UNITS_WITHOUT_DAY = Object.freeze(['week', 'month', 'quarter', 'year']);

/** @type {readonly import('./internal/temporal.js').TypeName[]} */
const CALENDAR_VALUE_TYPES = Object.freeze(['PlainDate', 'PlainDateTime', 'ZonedDateTime']);

/**
 * Reads the `weekStartsOn` option, defaulting to Monday.
 *
 * @param {WeekOptions | undefined} options
 * @param {string} context
 * @returns {number}
 */
function readWeekStartsOn(options, context) {
  const readValue = readOptions(options, context);
  if (readValue.weekStartsOn === undefined) {
    return Weekday.MONDAY;
  }
  return assertWeekday(readValue.weekStartsOn, `${context} weekStartsOn option`);
}

/**
 * Returns the first date of the unit that contains `date`.
 *
 * @param {Temporal.PlainDate} date
 * @param {Unit} unit
 * @param {number} weekStartsOn
 * @returns {Temporal.PlainDate}
 */
function startDateOf(date, unit, weekStartsOn) {
  if (unit === 'day') {
    return date;
  }
  if (unit === 'week') {
    const daysSinceWeekStart = (date.dayOfWeek - weekStartsOn + 7) % 7;
    return date.subtract({ days: daysSinceWeekStart });
  }
  if (unit === 'month') {
    return date.with({ day: 1 });
  }
  if (unit === 'quarter') {
    const quarterIndex = Math.floor((date.month - 1) / 3);
    const firstMonthOfQuarter = quarterIndex * 3 + 1;
    return date.with({ month: firstMonthOfQuarter, day: 1 });
  }
  return date.with({ month: 1, day: 1 });
}

/**
 * Returns the first date of the unit after the one that contains `date`.
 *
 * @param {Temporal.PlainDate} date
 * @param {Unit} unit
 * @param {number} weekStartsOn
 * @returns {Temporal.PlainDate}
 */
function startDateOfNext(date, unit, weekStartsOn) {
  const startDate = startDateOf(date, unit, weekStartsOn);
  if (unit === 'day') {
    return startDate.add({ days: 1 });
  }
  if (unit === 'week') {
    return startDate.add({ weeks: 1 });
  }
  if (unit === 'month') {
    return startDate.add({ months: 1 });
  }
  if (unit === 'quarter') {
    return startDate.add({ months: 3 });
  }
  return startDate.add({ years: 1 });
}

/**
 * Converts a start date back into the type of the original value. For
 * `ZonedDateTime` this uses `startOfDay()`, so days whose midnight is skipped
 * by a DST change start at the first valid time.
 *
 * @template {CalendarValue} T
 * @param {T} original
 * @param {Temporal.PlainDate} startDate
 * @returns {T}
 */
function toSameType(original, startDate) {
  const typeName = assertType(original, CALENDAR_VALUE_TYPES, 'calendar');
  if (typeName === 'PlainDate') {
    return /** @type {T} */ (startDate);
  }
  if (typeName === 'PlainDateTime') {
    return /** @type {T} */ (startDate.toPlainDateTime());
  }
  const zoned = /** @type {Temporal.ZonedDateTime} */ (original);
  const zonedOnStartDate = startDate.toZonedDateTime(zoned.timeZoneId);
  return /** @type {T} */ (zonedOnStartDate.startOfDay());
}

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
export function startOf(value, unit, options) {
  assertType(value, CALENDAR_VALUE_TYPES, 'startOf(value)');
  const validUnit = assertOneOf(unit, UNITS, 'startOf() unit');
  const weekStartsOn = readWeekStartsOn(options, 'startOf()');

  if (validUnit === 'day' && isZoned(value)) {
    const zoned = /** @type {Temporal.ZonedDateTime} */ (value);
    return /** @type {T} */ (zoned.startOfDay());
  }

  const date = datePartOf(value);
  const startDate = startDateOf(date, validUnit, weekStartsOn);
  return toSameType(value, startDate);
}

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
export function startOfNext(value, unit, options) {
  assertType(value, CALENDAR_VALUE_TYPES, 'startOfNext(value)');
  const validUnit = assertOneOf(unit, UNITS, 'startOfNext() unit');
  const weekStartsOn = readWeekStartsOn(options, 'startOfNext()');

  const date = datePartOf(value);
  const nextStartDate = startDateOfNext(date, validUnit, weekStartsOn);
  return toSameType(value, nextStartDate);
}

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
export function lastDayOf(date, unit, options) {
  assertType(date, ['PlainDate'], 'lastDayOf(date)');
  const validUnit = assertOneOf(unit, UNITS_WITHOUT_DAY, 'lastDayOf() unit');
  const weekStartsOn = readWeekStartsOn(options, 'lastDayOf()');

  const nextStartDate = startDateOfNext(date, validUnit, weekStartsOn);
  return nextStartDate.subtract({ days: 1 });
}

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
export function nextWeekday(date, weekday, options) {
  assertType(date, ['PlainDate'], 'nextWeekday(date)');
  const targetWeekday = assertWeekday(weekday, 'nextWeekday() weekday');
  const includeToday = readIncludeToday(options, 'nextWeekday()');

  let daysAhead = (targetWeekday - date.dayOfWeek + 7) % 7;
  if (daysAhead === 0 && !includeToday) {
    daysAhead = 7;
  }
  return date.add({ days: daysAhead });
}

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
export function previousWeekday(date, weekday, options) {
  assertType(date, ['PlainDate'], 'previousWeekday(date)');
  const targetWeekday = assertWeekday(weekday, 'previousWeekday() weekday');
  const includeToday = readIncludeToday(options, 'previousWeekday()');

  let daysBack = (date.dayOfWeek - targetWeekday + 7) % 7;
  if (daysBack === 0 && !includeToday) {
    daysBack = 7;
  }
  return date.subtract({ days: daysBack });
}

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
export function nthWeekdayOfMonth(month, weekday, n) {
  assertType(month, ['PlainYearMonth'], 'nthWeekdayOfMonth(month)');
  const targetWeekday = assertWeekday(weekday, 'nthWeekdayOfMonth() weekday');
  const occurrence = assertInteger(n, 'nthWeekdayOfMonth() n');
  const isValidOccurrence = occurrence === -1 || (occurrence >= 1 && occurrence <= 5);
  if (!isValidOccurrence) {
    throw new TemporalKitConfigError(
      `nthWeekdayOfMonth() n must be 1, 2, 3, 4, 5, or -1 (last), but received ${occurrence}.`,
    );
  }

  if (occurrence === -1) {
    const lastDate = month.toPlainDate({ day: month.daysInMonth });
    const daysBack = (lastDate.dayOfWeek - targetWeekday + 7) % 7;
    return lastDate.subtract({ days: daysBack });
  }

  const firstDate = month.toPlainDate({ day: 1 });
  const daysToFirstMatch = (targetWeekday - firstDate.dayOfWeek + 7) % 7;
  const weeksToAdd = occurrence - 1;
  const candidate = firstDate.add({ days: daysToFirstMatch + weeksToAdd * 7 });
  if (candidate.month !== firstDate.month) {
    return null;
  }
  return candidate;
}

/**
 * @param {{ includeToday?: boolean } | undefined} options
 * @param {string} context
 * @returns {boolean}
 */
function readIncludeToday(options, context) {
  const readValue = readOptions(options, context);
  if (readValue.includeToday === undefined) {
    return false;
  }
  return assertBoolean(readValue.includeToday, `${context} includeToday option`);
}

/**
 * Returns the calendar date of a PlainDate, PlainDateTime, or ZonedDateTime.
 *
 * @param {CalendarValue} value
 * @returns {Temporal.PlainDate}
 */
function datePartOf(value) {
  const typeName = assertType(value, CALENDAR_VALUE_TYPES, 'calendar');
  if (typeName === 'PlainDate') {
    return /** @type {Temporal.PlainDate} */ (value);
  }
  const dateTimeValue = /** @type {Temporal.PlainDateTime | Temporal.ZonedDateTime} */ (value);
  return dateTimeValue.toPlainDate();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isZoned(value) {
  const typeName = assertType(value, CALENDAR_VALUE_TYPES, 'calendar');
  return typeName === 'ZonedDateTime';
}
