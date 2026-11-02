/**
 * Injectable clocks that carry the app's time zone, so code that needs "now"
 * is testable without mocking globals. This is the only module that reads
 * `Temporal.Now`.
 *
 * @module orasna/clock
 */

import { TemporalKitConfigError, TemporalKitParseError } from './internal/errors.js';
import { getTemporal, typeOf } from './internal/temporal.js';
import { assertTimeZoneId } from './internal/validate.js';

/**
 * A source of "now" that also carries the app's time zone.
 *
 * - `timeZoneId`: the zone used by `now()`, `today()`, `time()`, and `dateTime()`.
 * - `instant()`: the current exact time.
 * - `now()`: the current time in `timeZoneId`.
 * - `today()`: today's date in `timeZoneId`.
 * - `time()`: the current wall-clock time in `timeZoneId`.
 * - `dateTime()`: the current date and wall-clock time in `timeZoneId`.
 *
 * @typedef {{
 *   readonly timeZoneId: string,
 *   instant(): Temporal.Instant,
 *   now(): Temporal.ZonedDateTime,
 *   today(): Temporal.PlainDate,
 *   time(): Temporal.PlainTime,
 *   dateTime(): Temporal.PlainDateTime,
 * }} Clock
 */

/**
 * @typedef {Clock & {
 *   advance(by: Temporal.DurationLike): void,
 *   set(to: Temporal.Instant | string): void,
 * }} ManualClock
 */

/**
 * Builds a frozen clock from a source of instants.
 *
 * @param {string} timeZoneId Already validated.
 * @param {() => Temporal.Instant} readInstant
 * @returns {Clock}
 */
function createClock(timeZoneId, readInstant) {
  const now = () => readInstant().toZonedDateTimeISO(timeZoneId);
  return Object.freeze({
    timeZoneId,
    instant: () => readInstant(),
    now,
    today: () => now().toPlainDate(),
    time: () => now().toPlainTime(),
    dateTime: () => now().toPlainDateTime(),
  });
}

/**
 * Converts an Instant or ISO string with an offset to an Instant.
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {Temporal.Instant}
 */
function toInstant(value, context) {
  const Temporal = getTemporal();
  if (typeOf(value) === 'Instant') {
    return /** @type {Temporal.Instant} */ (value);
  }
  if (typeof value !== 'string') {
    throw new TemporalKitConfigError(
      `${context} expects a Temporal.Instant or an ISO string with an offset, such as '2026-11-02T06:30:00Z'.`,
    );
  }
  try {
    return Temporal.Instant.from(value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TemporalKitParseError(
      `${context} could not read ${JSON.stringify(value)} as an Instant; include an offset such as 'Z' or '+08:00'. ${reason}`,
      { input: value, pattern: 'ISO 8601 instant' },
    );
  }
}

/**
 * Returns a clock that reads the real system time, reported in `timeZoneId`.
 * The zone is required because servers often run in UTC while users do not.
 *
 * @param {string} timeZoneId
 * @returns {Clock}
 * @throws {TemporalKitConfigError} When the time zone is missing or unknown.
 * @example
 * export const clock = systemClock('Asia/Manila');
 * clock.today(); // today's date in Manila
 */
export function systemClock(timeZoneId) {
  const Temporal = getTemporal();
  const validZone = assertTimeZoneId(timeZoneId, 'systemClock()');
  return createClock(validZone, () => Temporal.Now.instant());
}

/**
 * Returns a clock frozen at one instant, for tests.
 *
 * @param {Temporal.Instant | string} at
 * @param {string} timeZoneId
 * @returns {Clock}
 * @throws {TemporalKitParseError} When `at` is a string that is not an ISO instant.
 * @throws {TemporalKitConfigError} When `at` has the wrong type or the time zone is missing or unknown.
 * @example
 * const clock = fixedClock('2026-11-02T00:30:00Z', 'Asia/Manila');
 * clock.today(); // 2026-11-02
 */
export function fixedClock(at, timeZoneId) {
  getTemporal();
  const fixedInstant = toInstant(at, 'fixedClock()');
  const validZone = assertTimeZoneId(timeZoneId, 'fixedClock()');
  return createClock(validZone, () => fixedInstant);
}

/**
 * Returns a clock that only moves when told to, for tests of timeouts,
 * expiry, and schedules. `advance()` adds a duration in the clock's time zone,
 * so `{ days: 1 }` keeps the wall-clock time across DST changes, while
 * `{ hours: 24 }` adds exact time.
 *
 * @param {Temporal.Instant | string} start
 * @param {string} timeZoneId
 * @returns {ManualClock}
 * @throws {TemporalKitParseError} When `start` is a string that is not an ISO instant.
 * @throws {TemporalKitConfigError} When `start` has the wrong type or the time zone is missing or unknown.
 * @example
 * const clock = manualClock('2026-11-02T00:00:00Z', 'UTC');
 * clock.advance({ hours: 1 });
 * clock.instant().toString(); // '2026-11-02T01:00:00Z'
 */
export function manualClock(start, timeZoneId) {
  getTemporal();
  let currentInstant = toInstant(start, 'manualClock()');
  const validZone = assertTimeZoneId(timeZoneId, 'manualClock()');
  const baseClock = createClock(validZone, () => currentInstant);

  /**
   * @param {Temporal.DurationLike} by
   */
  const advance = (by) => {
    const Temporal = getTemporal();
    /** @type {Temporal.Duration} */
    let duration;
    try {
      duration = Temporal.Duration.from(by);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TemporalKitConfigError(`manualClock().advance() expects a duration such as { hours: 1 } or 'PT1H'. ${reason}`);
    }
    const zonedNow = currentInstant.toZonedDateTimeISO(validZone);
    currentInstant = zonedNow.add(duration).toInstant();
  };

  /**
   * @param {Temporal.Instant | string} to
   */
  const set = (to) => {
    currentInstant = toInstant(to, 'manualClock().set()');
  };

  return Object.freeze({ ...baseClock, advance, set });
}

/**
 * Returns a clock that reads time from `clock` but reports it in another zone.
 *
 * @param {Clock} clock
 * @param {string} timeZoneId
 * @returns {Clock}
 * @throws {TemporalKitConfigError} When `clock` is not a clock, or the time zone is missing or unknown.
 * @example
 * const tokyo = withTimeZone(systemClock('Asia/Manila'), 'Asia/Tokyo');
 */
export function withTimeZone(clock, timeZoneId) {
  getTemporal();
  const hasInstantMethod = clock !== null && typeof clock === 'object' && typeof clock.instant === 'function';
  if (!hasInstantMethod) {
    throw new TemporalKitConfigError('withTimeZone() expects a clock with an instant() method, such as systemClock(zone).');
  }
  const validZone = assertTimeZoneId(timeZoneId, 'withTimeZone()');
  return createClock(validZone, () => clock.instant());
}
