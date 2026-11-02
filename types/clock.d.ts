/**
 * Injectable clocks that carry the app's time zone, so code that needs "now"
 * is testable without mocking globals. This is the only module that reads
 * `Temporal.Now`.
 *
 * @module orasna/clock
 */
export type Clock = {
    readonly timeZoneId: string;
    instant(): Temporal.Instant;
    now(): Temporal.ZonedDateTime;
    today(): Temporal.PlainDate;
    time(): Temporal.PlainTime;
    dateTime(): Temporal.PlainDateTime;
};
export type ManualClock = Clock & {
    advance(by: Temporal.DurationLike): void;
    set(to: Temporal.Instant | string): void;
};
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
export declare function systemClock(timeZoneId: string): Clock;
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
export declare function fixedClock(at: Temporal.Instant | string, timeZoneId: string): Clock;
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
export declare function manualClock(start: Temporal.Instant | string, timeZoneId: string): ManualClock;
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
export declare function withTimeZone(clock: Clock, timeZoneId: string): Clock;
