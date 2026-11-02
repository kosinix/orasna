/**
 * Half-open `[start, end)` intervals and normalized sets of intervals, for
 * leave periods, schedules, bookings, and attendance.
 *
 * Because every interval is half-open, 08:00–12:00 and 12:00–13:00 touch
 * (`abuts`) but do not overlap.
 *
 * @module orasna/interval
 */
export type IntervalValue = Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | Temporal.Instant;
export type IntervalTypeName = 'PlainDate' | 'PlainDateTime' | 'ZonedDateTime' | 'Instant';
/**
 * A half-open range `[start, end)` of PlainDate, PlainDateTime, ZonedDateTime,
 * or Instant values. Instances are frozen; create them with `Interval.of()`,
 * `Interval.fromInclusiveDates()`, or `Interval.parse()`.
 *
 * @template {IntervalValue} [T=IntervalValue]
 */
export declare class Interval<T extends IntervalValue = IntervalValue> {
    #private;
    /**
     * Inclusive start.
     * @readonly
     * @type {T}
     */
    readonly start: T;
    /**
     * Exclusive end.
     * @readonly
     * @type {T}
     */
    readonly end: T;
    /**
     * True when start equals end, so the interval contains nothing.
     * @readonly
     * @type {boolean}
     */
    readonly isEmpty: boolean;
    /**
     * @param {symbol} key
     * @param {T} start
     * @param {T} end
     * @param {IntervalTypeName} typeName
     */
    constructor(key: symbol, start: T, end: T, typeName: IntervalTypeName);
    /**
     * Creates the interval `[start, end)`. Equal start and end make an empty interval.
     *
     * @template {IntervalValue} V
     * @param {V} start
     * @param {V} end
     * @returns {Interval<V>}
     * @throws {TemporalKitTypeError} When start and end are not the same supported type.
     * @throws {TemporalKitRangeError} With code `INVALID_RANGE` when end is before start.
     * @example
     * Interval.of(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-07'));
     */
    static of<V extends IntervalValue>(start: V, end: V): Interval<V>;
    /**
     * Creates `[first, last + 1 day)` from an inclusive date range, such as the
     * first and last day of a leave request.
     *
     * @param {Temporal.PlainDate} first
     * @param {Temporal.PlainDate} last
     * @returns {Interval<Temporal.PlainDate>}
     * @throws {TemporalKitTypeError} When first or last is not a PlainDate.
     * @throws {TemporalKitRangeError} With code `INVALID_RANGE` when last is before first.
     * @example
     * Interval.fromInclusiveDates(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-06')).duration(); // P5D
     */
    static fromInclusiveDates(first: Temporal.PlainDate, last: Temporal.PlainDate): Interval<Temporal.PlainDate>;
    /**
     * Parses an ISO 8601 interval `'start/end'` into values of the given type.
     * Slashes inside a bracketed time zone, such as `[America/New_York]`, are handled.
     *
     * @param {string} text
     * @param {IntervalTypeName} type
     * @returns {Interval}
     * @throws {TemporalKitParseError} When the text is not `start/end` or either part is invalid.
     * @throws {TemporalKitConfigError} When the type is not supported by Interval.
     * @throws {TemporalKitRangeError} With code `INVALID_RANGE` when end is before start.
     * @example
     * Interval.parse('2026-11-02/2026-11-07', 'PlainDate');
     */
    static parse(text: string, type: IntervalTypeName): Interval;
    /**
     * Returns true when `start <= value < end`.
     *
     * @param {T} value
     * @returns {boolean}
     * @throws {TemporalKitTypeError} When value is not the interval's type.
     * @example
     * interval.contains(Temporal.PlainDate.from('2026-11-03'));
     */
    contains(value: T): boolean;
    /**
     * Returns true when `other` lies completely inside this interval.
     *
     * @param {Interval<T>} other
     * @returns {boolean}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * month.encloses(leave);
     */
    encloses(other: Interval<T>): boolean;
    /**
     * Returns true when the intervals share at least one point. Adjacent
     * intervals, such as `[08:00, 12:00)` and `[12:00, 13:00)`, do not overlap,
     * and empty intervals overlap nothing.
     *
     * @param {Interval<T>} other
     * @returns {boolean}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * morning.overlaps(lunch); // false when they only touch
     */
    overlaps(other: Interval<T>): boolean;
    /**
     * Returns true when one interval ends exactly where the other starts.
     *
     * @param {Interval<T>} other
     * @returns {boolean}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * morning.abuts(lunch); // true for [08:00, 12:00) and [12:00, 13:00)
     */
    abuts(other: Interval<T>): boolean;
    /**
     * Returns the overlapping part of both intervals, or `null` when they do not overlap.
     *
     * @param {Interval<T>} other
     * @returns {Interval<T> | null}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * schedule.intersection(actual);
     */
    intersection(other: Interval<T>): Interval<T> | null;
    /**
     * Returns both intervals as a normalized set; overlapping or adjacent
     * intervals merge into one.
     *
     * @param {Interval<T>} other
     * @returns {IntervalSet<T>}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * morning.union(afternoon);
     */
    union(other: Interval<T>): IntervalSet<T>;
    /**
     * Returns the parts of this interval not covered by `other`: zero, one, or two intervals.
     *
     * @param {Interval<T>} other
     * @returns {IntervalSet<T>}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * workday.subtract(lunch);
     */
    subtract(other: Interval<T>): IntervalSet<T>;
    /**
     * Returns the smallest interval that contains both intervals, including any gap between them.
     *
     * @param {Interval<T>} other
     * @returns {Interval<T>}
     * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
     * @example
     * firstBooking.cover(lastBooking);
     */
    cover(other: Interval<T>): Interval<T>;
    /**
     * Returns the length of the interval: whole days for PlainDate intervals,
     * otherwise exact time with `largestUnit: 'hour'`.
     *
     * @returns {Temporal.Duration}
     * @example
     * Interval.of(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-07')).duration(); // P5D
     */
    duration(): Temporal.Duration;
    /**
     * Returns the last day inside a PlainDate interval (`end - 1 day`), for display.
     *
     * @returns {Temporal.PlainDate}
     * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` for non-PlainDate intervals.
     * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for an empty interval, which has no days.
     * @example
     * Interval.fromInclusiveDates(first, last).lastDay(); // equals last
     */
    lastDay(): Temporal.PlainDate;
    /**
     * Yields every date in a PlainDate interval, from start up to but not including end.
     *
     * @returns {Generator<Temporal.PlainDate>}
     * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` for non-PlainDate intervals.
     * @example
     * for (const day of leave.days()) console.log(day.toString());
     */
    days(): Generator<Temporal.PlainDate>;
    /**
     * Returns the ISO 8601 interval text `'start/end'`.
     *
     * @returns {string}
     * @example
     * String(interval); // '2026-11-02/2026-11-07'
     */
    toString(): string;
    /**
     * Returns the ISO 8601 interval text `'start/end'`, so `JSON.stringify` works.
     *
     * @returns {string}
     * @example
     * JSON.stringify({ leave }); // '{"leave":"2026-11-02/2026-11-07"}'
     */
    toJSON(): string;
}
/**
 * A sorted set of non-empty intervals of one type. Overlapping and adjacent
 * members are merged on construction. Instances are frozen; create them with
 * `IntervalSet.from()`.
 *
 * @template {IntervalValue} [T=IntervalValue]
 */
export declare class IntervalSet<T extends IntervalValue = IntervalValue> {
    #private;
    /**
     * The member intervals, sorted by start.
     * @readonly
     * @type {readonly Interval<T>[]}
     */
    readonly intervals: readonly Interval<T>[];
    /**
     * True when the set has no intervals.
     * @readonly
     * @type {boolean}
     */
    readonly isEmpty: boolean;
    /**
     * @param {symbol} key
     * @param {readonly Interval<T>[]} normalized Sorted, merged, non-empty intervals.
     */
    constructor(key: symbol, normalized: readonly Interval<T>[]);
    /**
     * Creates a normalized set: empty intervals are dropped, the rest are sorted
     * and overlapping or adjacent intervals are merged.
     *
     * @template {IntervalValue} V
     * @param {Interval<V>[]} intervals
     * @returns {IntervalSet<V>}
     * @throws {TemporalKitConfigError} When intervals is not an array.
     * @throws {TemporalKitTypeError} When an item is not an Interval, or the intervals hold different types.
     * @example
     * IntervalSet.from([morning, afternoon]);
     */
    static from<V extends IntervalValue>(intervals: Interval<V>[]): IntervalSet<V>;
    /**
     * Returns true when any member interval contains `value`.
     *
     * @param {T} value
     * @returns {boolean}
     * @throws {TemporalKitTypeError} When value is not a supported type, or not the set's type.
     * @example
     * schedule.contains(Temporal.PlainDateTime.from('2026-11-02T09:00'));
     */
    contains(value: T): boolean;
    /**
     * Returns every point covered by this set or `other`.
     *
     * @param {IntervalSet<T> | Interval<T>} other
     * @returns {IntervalSet<T>}
     * @throws {TemporalKitTypeError} When other is not an Interval or IntervalSet of the same type.
     * @example
     * leaves.union(newLeave);
     */
    union(other: IntervalSet<T> | Interval<T>): IntervalSet<T>;
    /**
     * Returns the points covered by both this set and `other`.
     *
     * @param {IntervalSet<T> | Interval<T>} other
     * @returns {IntervalSet<T>}
     * @throws {TemporalKitTypeError} When other is not an Interval or IntervalSet of the same type.
     * @example
     * schedule.intersection(actual).totalDuration(); // hours rendered
     */
    intersection(other: IntervalSet<T> | Interval<T>): IntervalSet<T>;
    /**
     * Returns the points covered by this set but not by `other`.
     *
     * @param {IntervalSet<T> | Interval<T>} other
     * @returns {IntervalSet<T>}
     * @throws {TemporalKitTypeError} When other is not an Interval or IntervalSet of the same type.
     * @example
     * schedule.subtract(actual).totalDuration(); // undertime
     */
    subtract(other: IntervalSet<T> | Interval<T>): IntervalSet<T>;
    /**
     * Returns the parts of `within` that no member interval covers.
     *
     * @param {Interval<T>} within
     * @returns {IntervalSet<T>}
     * @throws {TemporalKitTypeError} When within is not an Interval of the same type.
     * @example
     * bookings.gaps(openingHours); // free slots
     */
    gaps(within: Interval<T>): IntervalSet<T>;
    /**
     * Returns the summed length of all member intervals: days for PlainDate
     * sets, otherwise `largestUnit: 'hour'`. An empty set returns `PT0S`.
     *
     * @returns {Temporal.Duration}
     * @example
     * schedule.totalDuration(); // PT8H
     */
    totalDuration(): Temporal.Duration;
    /**
     * Returns the member intervals as ISO 8601 strings, so `JSON.stringify` works.
     *
     * @returns {string[]}
     * @example
     * JSON.stringify(schedule); // '["2026-11-02T08:00:00/2026-11-02T12:00:00", ...]'
     */
    toJSON(): string[];
    /**
     * Iterates over the member intervals in order.
     *
     * @returns {Iterator<Interval<T>>}
     * @example
     * for (const interval of schedule) console.log(String(interval));
     */
    [Symbol.iterator](): Iterator<Interval<T>>;
}
