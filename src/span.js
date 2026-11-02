/**
 * Durations from wall-clock times, including shifts that cross midnight,
 * plus totals and clock-style duration text.
 *
 * For locale-aware duration text, use `Intl.DurationFormat`.
 *
 * @module orasna/span
 */

import { TemporalKitConfigError, TemporalKitRangeError } from './internal/errors.js';
import { assertSameType, assertType, getTemporal } from './internal/temporal.js';
import { assertOneOf, padNumber, readOptions } from './internal/validate.js';

/**
 * @typedef {Temporal.PlainDateTime | Temporal.ZonedDateTime | Temporal.Instant} ElapsedValue
 */

/** @type {readonly ('auto' | 'never')[]} */
const OVERNIGHT_VALUES = Object.freeze(['auto', 'never']);

/** @type {readonly ('h:mm' | 'h:mm:ss')[]} */
const CLOCK_PATTERNS = Object.freeze(['h:mm', 'h:mm:ss']);

const HOURS_PER_DAY = 24;

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
export function timeSpan(start, end, options) {
  assertSameType([start, end], ['PlainTime'], 'timeSpan');
  const readValue = readOptions(options, 'timeSpan()');
  const overnightOption = readValue.overnight === undefined ? 'auto' : readValue.overnight;
  const overnight = assertOneOf(overnightOption, OVERNIGHT_VALUES, 'timeSpan() overnight option');

  const Temporal = getTemporal();
  const comparison = Temporal.PlainTime.compare(start, end);

  if (comparison === 0) {
    return new Temporal.Duration();
  }
  if (comparison < 0) {
    return start.until(end, { largestUnit: 'hour' });
  }
  if (overnight === 'never') {
    throw new TemporalKitRangeError(
      'INVALID_RANGE',
      `timeSpan() received end ${end} before start ${start} with overnight: 'never'. ` +
        "Swap the arguments, or use overnight: 'auto' to treat the end as the next day.",
    );
  }

  const backwardsDuration = start.until(end, { largestUnit: 'hour' });
  return backwardsDuration.add({ hours: HOURS_PER_DAY });
}

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
export function elapsed(start, end) {
  assertSameType([start, end], ['PlainDateTime', 'ZonedDateTime', 'Instant'], 'elapsed');
  const startValue = /** @type {any} */ (start);
  return startValue.until(end, { largestUnit: 'hour' });
}

/**
 * Throws when a duration contains years, months, or weeks, which have no fixed
 * length without a reference date.
 *
 * @param {Temporal.Duration} duration
 * @param {string} context
 */
function assertNoCalendarUnits(duration, context) {
  const hasYears = duration.years !== 0;
  const hasMonths = duration.months !== 0;
  const hasWeeks = duration.weeks !== 0;
  if (hasYears || hasMonths || hasWeeks) {
    throw new TemporalKitRangeError(
      'NEEDS_REFERENCE_DATE',
      `${context} received ${duration}, which contains years, months, or weeks. ` +
        'Those units have no fixed length; convert it first with duration.round({ largestUnit: "hour", relativeTo }).',
    );
  }
}

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
export function totalHours(duration) {
  assertType(duration, ['Duration'], 'totalHours(duration)');
  assertNoCalendarUnits(duration, 'totalHours()');
  return duration.total({ unit: 'hour' });
}

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
export function totalMinutes(duration) {
  assertType(duration, ['Duration'], 'totalMinutes(duration)');
  assertNoCalendarUnits(duration, 'totalMinutes()');
  return duration.total({ unit: 'minute' });
}

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
export function sumDurations(list) {
  const Temporal = getTemporal();
  if (!Array.isArray(list)) {
    throw new TemporalKitConfigError(`sumDurations() expects an array of Temporal.Duration, but received ${typeof list}.`);
  }

  let total = new Temporal.Duration();
  list.forEach((item, index) => {
    assertType(item, ['Duration'], `sumDurations() item ${index}`);
    assertNoCalendarUnits(item, `sumDurations() item ${index}`);
    total = total.add(item);
  });
  return total.round({ largestUnit: 'hour' });
}

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
export function formatClockDuration(duration, pattern) {
  assertType(duration, ['Duration'], 'formatClockDuration(duration)');
  const validPattern = assertOneOf(pattern, CLOCK_PATTERNS, 'formatClockDuration() pattern');
  assertNoCalendarUnits(duration, 'formatClockDuration()');

  const includeSeconds = validPattern === 'h:mm:ss';
  const smallestUnit = includeSeconds ? 'second' : 'minute';
  const balanced = duration.round({ largestUnit: 'hour', smallestUnit, roundingMode: 'trunc' });

  const sign = balanced.sign < 0 ? '-' : '';
  const hours = String(Math.abs(balanced.hours));
  const minutes = padNumber(Math.abs(balanced.minutes), 2);

  if (!includeSeconds) {
    return `${sign}${hours}:${minutes}`;
  }
  const seconds = padNumber(Math.abs(balanced.seconds), 2);
  return `${sign}${hours}:${minutes}:${seconds}`;
}
