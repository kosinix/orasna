/**
 * Working-day arithmetic with organization-supplied rules. The package ships
 * no holiday data: holidays and suspensions are passed in by the app.
 *
 * Precedence: `extraWorkingDays` beats `holidays` and `nonWorkingDays`,
 * which beat `weekend`.
 *
 * @module orasna/business
 */
import { Interval } from './interval.js';
export type WorkingHoursWindow = {
    /**
     * Wall-clock start such as `'08:00'`.
     */
    start: string;
    /**
     * Wall-clock end such as `'12:00'`; must be after start.
     */
    end: string;
};
export type BusinessCalendarOptions = {
    /**
     * ISO weekdays that are not worked; default `[6, 7]` (Saturday, Sunday).
     */
    weekend?: number[];
    holidays?: (Temporal.PlainDate | string)[];
    /**
     * Suspensions and closures.
     */
    nonWorkingDays?: (Temporal.PlainDate | string)[];
    /**
     * Make-up days that override weekend and holidays.
     */
    extraWorkingDays?: (Temporal.PlainDate | string)[];
    /**
     * Daily windows, e.g. 08:00–12:00 and 13:00–17:00.
     */
    workingHours?: WorkingHoursWindow[];
};
/**
 * A set of working-day rules. Instances are frozen; use `with()` to derive a
 * changed calendar.
 */
export declare class BusinessCalendar {
    #private;
    /**
     * @param {BusinessCalendarOptions} [options]
     * @throws {TemporalKitConfigError} For invalid options, or a weekend that covers all seven days.
     * @throws {TemporalKitParseError} When a date or time string cannot be read.
     * @example
     * const calendar = new BusinessCalendar({
     *   holidays: ['2026-11-30', '2026-12-25'],
     *   workingHours: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
     * });
     */
    constructor(options?: BusinessCalendarOptions);
    /**
     * Returns true when `date` is a working day under this calendar's rules.
     *
     * @param {Temporal.PlainDate} date
     * @returns {boolean}
     * @throws {TemporalKitTypeError} When date is not a PlainDate.
     * @example
     * calendar.isWorkingDay(Temporal.PlainDate.from('2026-11-07')); // false (Saturday)
     */
    isWorkingDay(date: Temporal.PlainDate): boolean;
    /**
     * Returns the next working day after `date`, or `date` itself when
     * `includeToday` is true and it is a working day.
     *
     * @param {Temporal.PlainDate} date
     * @param {{ includeToday?: boolean }} [options]
     * @returns {Temporal.PlainDate}
     * @throws {TemporalKitTypeError} When date is not a PlainDate.
     * @throws {TemporalKitConfigError} When options are invalid, or no working day exists within 3,660 days.
     * @example
     * calendar.nextWorkingDay(Temporal.PlainDate.from('2026-11-27')); // 2026-12-01 when 2026-11-30 is a holiday
     */
    nextWorkingDay(date: Temporal.PlainDate, options?: {
        includeToday?: boolean;
    }): Temporal.PlainDate;
    /**
     * Returns the previous working day before `date`, or `date` itself when
     * `includeToday` is true and it is a working day.
     *
     * @param {Temporal.PlainDate} date
     * @param {{ includeToday?: boolean }} [options]
     * @returns {Temporal.PlainDate}
     * @throws {TemporalKitTypeError} When date is not a PlainDate.
     * @throws {TemporalKitConfigError} When options are invalid, or no working day exists within 3,660 days.
     * @example
     * calendar.previousWorkingDay(Temporal.PlainDate.from('2026-11-02')); // 2026-10-30
     */
    previousWorkingDay(date: Temporal.PlainDate, options?: {
        includeToday?: boolean;
    }): Temporal.PlainDate;
    /**
     * Moves `n` working days from `date`. Negative `n` goes back; `0` returns
     * `date` unchanged, even when it is not a working day.
     *
     * @param {Temporal.PlainDate} date
     * @param {number} n
     * @returns {Temporal.PlainDate}
     * @throws {TemporalKitTypeError} When date is not a PlainDate.
     * @throws {TemporalKitConfigError} When n is not an integer, or no working day exists within 3,660 days.
     * @example
     * calendar.addWorkingDays(Temporal.PlainDate.from('2026-11-27'), 1); // 2026-12-01 when 2026-11-30 is a holiday
     */
    addWorkingDays(date: Temporal.PlainDate, n: number): Temporal.PlainDate;
    /**
     * Counts working days in the half-open range `[start, end)`. Returns a
     * negative count when `end` is before `start`.
     *
     * @param {Temporal.PlainDate} start
     * @param {Temporal.PlainDate} end
     * @returns {number}
     * @throws {TemporalKitTypeError} When start or end is not a PlainDate.
     * @example
     * calendar.workingDaysBetween(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-09')); // 5
     */
    workingDaysBetween(start: Temporal.PlainDate, end: Temporal.PlainDate): number;
    /**
     * Yields every working day inside a PlainDate interval.
     *
     * @param {Interval<Temporal.PlainDate>} range
     * @returns {Generator<Temporal.PlainDate>}
     * @throws {TemporalKitTypeError} When range is not a PlainDate Interval.
     * @example
     * const leave = Interval.fromInclusiveDates(first, last);
     * const daysCharged = [...calendar.workingDays(leave)].length;
     */
    workingDays(range: Interval<Temporal.PlainDate>): Generator<Temporal.PlainDate>;
    /**
     * Returns the working time between two date-times, counting only the
     * `workingHours` windows on working days. Returns a negative duration when
     * `end` is before `start`.
     *
     * @param {Temporal.PlainDateTime} start
     * @param {Temporal.PlainDateTime} end
     * @returns {Temporal.Duration} Balanced to `largestUnit: 'hour'`.
     * @throws {TemporalKitTypeError} When start or end is not a PlainDateTime.
     * @throws {TemporalKitConfigError} When the calendar has no `workingHours`.
     * @example
     * calendar.workingDurationBetween(
     *   Temporal.PlainDateTime.from('2026-11-02T10:00'),
     *   Temporal.PlainDateTime.from('2026-11-03T10:00'),
     * ); // PT8H with 08:00–12:00 and 13:00–17:00 hours
     */
    workingDurationBetween(start: Temporal.PlainDateTime, end: Temporal.PlainDateTime): Temporal.Duration;
    /**
     * Returns a new calendar with some options replaced. Lists are replaced, not merged.
     *
     * @param {Partial<BusinessCalendarOptions>} changes
     * @returns {BusinessCalendar}
     * @throws {TemporalKitConfigError} When changes is not an object or produces invalid options.
     * @example
     * const withSuspension = calendar.with({ nonWorkingDays: ['2026-11-03'] });
     */
    with(changes: Partial<BusinessCalendarOptions>): BusinessCalendar;
}
