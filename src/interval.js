/**
 * Half-open `[start, end)` intervals and normalized sets of intervals, for
 * leave periods, schedules, bookings, and attendance.
 *
 * Because every interval is half-open, 08:00–12:00 and 12:00–13:00 touch
 * (`abuts`) but do not overlap.
 *
 * @module orasna/interval
 */

import {
  TemporalKitConfigError,
  TemporalKitParseError,
  TemporalKitRangeError,
  TemporalKitTypeError,
} from './internal/errors.js';
import { assertSameType, assertType, getTemporal } from './internal/temporal.js';
import { assertOneOf } from './internal/validate.js';

/**
 * @typedef {Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | Temporal.Instant} IntervalValue
 * @typedef {'PlainDate' | 'PlainDateTime' | 'ZonedDateTime' | 'Instant'} IntervalTypeName
 */

/** @type {readonly IntervalTypeName[]} */
const INTERVAL_TYPES = Object.freeze(['PlainDate', 'PlainDateTime', 'ZonedDateTime', 'Instant']);

/** Guards the constructors so instances come only from the static factories. */
const CONSTRUCTOR_KEY = Symbol('orasna interval');

/**
 * Compares two values of the same interval type.
 *
 * @param {IntervalTypeName} typeName
 * @param {IntervalValue} first
 * @param {IntervalValue} second
 * @returns {number}
 */
function compareValues(typeName, first, second) {
  const Temporal = getTemporal();
  const compareFunction = /** @type {any} */ (Temporal)[typeName].compare;
  return compareFunction(first, second);
}

/**
 * A half-open range `[start, end)` of PlainDate, PlainDateTime, ZonedDateTime,
 * or Instant values. Instances are frozen; create them with `Interval.of()`,
 * `Interval.fromInclusiveDates()`, or `Interval.parse()`.
 *
 * @template {IntervalValue} [T=IntervalValue]
 */
export class Interval {
  /** @type {IntervalTypeName} */
  #typeName;

  /**
   * Inclusive start.
   * @readonly
   * @type {T}
   */
  start;

  /**
   * Exclusive end.
   * @readonly
   * @type {T}
   */
  end;

  /**
   * True when start equals end, so the interval contains nothing.
   * @readonly
   * @type {boolean}
   */
  isEmpty;

  /**
   * @param {symbol} key
   * @param {T} start
   * @param {T} end
   * @param {IntervalTypeName} typeName
   */
  constructor(key, start, end, typeName) {
    if (key !== CONSTRUCTOR_KEY) {
      throw new TemporalKitConfigError('Interval cannot be constructed directly; use Interval.of(start, end).');
    }
    this.#typeName = typeName;
    this.start = start;
    this.end = end;
    this.isEmpty = compareValues(typeName, start, end) === 0;
    Object.freeze(this);
  }

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
  static of(start, end) {
    const typeName = /** @type {IntervalTypeName} */ (assertSameType([start, end], INTERVAL_TYPES, 'Interval.of'));
    const comparison = compareValues(typeName, start, end);
    if (comparison > 0) {
      throw new TemporalKitRangeError(
        'INVALID_RANGE',
        `Interval.of() received end ${end} before start ${start}. Swap the arguments; an interval runs from start to end.`,
      );
    }
    return new Interval(CONSTRUCTOR_KEY, start, end, typeName);
  }

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
  static fromInclusiveDates(first, last) {
    assertSameType([first, last], ['PlainDate'], 'Interval.fromInclusiveDates');
    const Temporal = getTemporal();
    if (Temporal.PlainDate.compare(first, last) > 0) {
      throw new TemporalKitRangeError(
        'INVALID_RANGE',
        `Interval.fromInclusiveDates() received last day ${last} before first day ${first}. Swap the arguments.`,
      );
    }
    const exclusiveEnd = last.add({ days: 1 });
    return new Interval(CONSTRUCTOR_KEY, first, exclusiveEnd, 'PlainDate');
  }

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
  static parse(text, type) {
    const Temporal = getTemporal();
    const typeName = assertOneOf(type, INTERVAL_TYPES, 'Interval.parse() type');
    if (typeof text !== 'string') {
      throw new TemporalKitParseError(`Interval.parse() expects a string, but received ${typeof text}.`, {
        input: text,
        pattern: 'start/end',
      });
    }

    const pieces = splitIntervalText(text);
    if (pieces === null) {
      throw new TemporalKitParseError(
        `Interval.parse() expects 'start/end' with exactly one separating slash, but received ${JSON.stringify(text)}.`,
        { input: text, pattern: 'start/end' },
      );
    }

    const fromFunction = /** @type {any} */ (Temporal)[typeName].from;
    /** @type {IntervalValue} */
    let start;
    /** @type {IntervalValue} */
    let end;
    try {
      start = fromFunction(pieces.start);
      end = fromFunction(pieces.end);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TemporalKitParseError(
        `Interval.parse() could not read ${JSON.stringify(text)} as Temporal.${typeName} values: ${reason}`,
        { input: text, pattern: 'start/end' },
      );
    }
    return Interval.of(start, end);
  }

  /**
   * Returns true when `start <= value < end`.
   *
   * @param {T} value
   * @returns {boolean}
   * @throws {TemporalKitTypeError} When value is not the interval's type.
   * @example
   * interval.contains(Temporal.PlainDate.from('2026-11-03'));
   */
  contains(value) {
    assertSameType([this.start, value], INTERVAL_TYPES, 'Interval.contains');
    const typeName = this.#typeName;
    const isAtOrAfterStart = compareValues(typeName, value, this.start) >= 0;
    const isBeforeEnd = compareValues(typeName, value, this.end) < 0;
    return isAtOrAfterStart && isBeforeEnd;
  }

  /**
   * Returns true when `other` lies completely inside this interval.
   *
   * @param {Interval<T>} other
   * @returns {boolean}
   * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
   * @example
   * month.encloses(leave);
   */
  encloses(other) {
    const typeName = this.#assertCompatible(other, 'Interval.encloses');
    const startsInside = compareValues(typeName, other.start, this.start) >= 0;
    const endsInside = compareValues(typeName, other.end, this.end) <= 0;
    return startsInside && endsInside;
  }

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
  overlaps(other) {
    const typeName = this.#assertCompatible(other, 'Interval.overlaps');
    if (this.isEmpty) {
      return false;
    }
    if (other.isEmpty) {
      return false;
    }
    const startsBeforeOtherEnds = compareValues(typeName, this.start, other.end) < 0;
    const otherStartsBeforeThisEnds = compareValues(typeName, other.start, this.end) < 0;
    return startsBeforeOtherEnds && otherStartsBeforeThisEnds;
  }

  /**
   * Returns true when one interval ends exactly where the other starts.
   *
   * @param {Interval<T>} other
   * @returns {boolean}
   * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
   * @example
   * morning.abuts(lunch); // true for [08:00, 12:00) and [12:00, 13:00)
   */
  abuts(other) {
    const typeName = this.#assertCompatible(other, 'Interval.abuts');
    const thisEndsAtOtherStart = compareValues(typeName, this.end, other.start) === 0;
    const otherEndsAtThisStart = compareValues(typeName, other.end, this.start) === 0;
    return thisEndsAtOtherStart || otherEndsAtThisStart;
  }

  /**
   * Returns the overlapping part of both intervals, or `null` when they do not overlap.
   *
   * @param {Interval<T>} other
   * @returns {Interval<T> | null}
   * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
   * @example
   * schedule.intersection(actual);
   */
  intersection(other) {
    const typeName = this.#assertCompatible(other, 'Interval.intersection');
    if (!this.overlaps(other)) {
      return null;
    }
    const laterStart = compareValues(typeName, this.start, other.start) >= 0 ? this.start : other.start;
    const earlierEnd = compareValues(typeName, this.end, other.end) <= 0 ? this.end : other.end;
    return new Interval(CONSTRUCTOR_KEY, laterStart, earlierEnd, typeName);
  }

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
  union(other) {
    this.#assertCompatible(other, 'Interval.union');
    return IntervalSet.from([this, other]);
  }

  /**
   * Returns the parts of this interval not covered by `other`: zero, one, or two intervals.
   *
   * @param {Interval<T>} other
   * @returns {IntervalSet<T>}
   * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
   * @example
   * workday.subtract(lunch);
   */
  subtract(other) {
    this.#assertCompatible(other, 'Interval.subtract');
    return IntervalSet.from([this]).subtract(other);
  }

  /**
   * Returns the smallest interval that contains both intervals, including any gap between them.
   *
   * @param {Interval<T>} other
   * @returns {Interval<T>}
   * @throws {TemporalKitTypeError} When other is not an Interval of the same type.
   * @example
   * firstBooking.cover(lastBooking);
   */
  cover(other) {
    const typeName = this.#assertCompatible(other, 'Interval.cover');
    const earlierStart = compareValues(typeName, this.start, other.start) <= 0 ? this.start : other.start;
    const laterEnd = compareValues(typeName, this.end, other.end) >= 0 ? this.end : other.end;
    return new Interval(CONSTRUCTOR_KEY, earlierStart, laterEnd, typeName);
  }

  /**
   * Returns the length of the interval: whole days for PlainDate intervals,
   * otherwise exact time with `largestUnit: 'hour'`.
   *
   * @returns {Temporal.Duration}
   * @example
   * Interval.of(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-07')).duration(); // P5D
   */
  duration() {
    const start = /** @type {any} */ (this.start);
    if (this.#typeName === 'PlainDate') {
      return start.until(this.end, { largestUnit: 'day' });
    }
    return start.until(this.end, { largestUnit: 'hour' });
  }

  /**
   * Returns the last day inside a PlainDate interval (`end - 1 day`), for display.
   *
   * @returns {Temporal.PlainDate}
   * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` for non-PlainDate intervals.
   * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for an empty interval, which has no days.
   * @example
   * Interval.fromInclusiveDates(first, last).lastDay(); // equals last
   */
  lastDay() {
    const end = this.#assertDateInterval('Interval.lastDay');
    if (this.isEmpty) {
      throw new TemporalKitRangeError('INVALID_RANGE', `Interval.lastDay() was called on the empty interval ${this}, which has no days.`);
    }
    return end.subtract({ days: 1 });
  }

  /**
   * Yields every date in a PlainDate interval, from start up to but not including end.
   *
   * @returns {Generator<Temporal.PlainDate>}
   * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` for non-PlainDate intervals.
   * @example
   * for (const day of leave.days()) console.log(day.toString());
   */
  days() {
    const end = this.#assertDateInterval('Interval.days');
    const start = /** @type {Temporal.PlainDate} */ (this.start);
    return iterateDays(start, end);
  }

  /**
   * Returns the ISO 8601 interval text `'start/end'`.
   *
   * @returns {string}
   * @example
   * String(interval); // '2026-11-02/2026-11-07'
   */
  toString() {
    return `${this.start}/${this.end}`;
  }

  /**
   * Returns the ISO 8601 interval text `'start/end'`, so `JSON.stringify` works.
   *
   * @returns {string}
   * @example
   * JSON.stringify({ leave }); // '{"leave":"2026-11-02/2026-11-07"}'
   */
  toJSON() {
    return this.toString();
  }

  /**
   * @param {unknown} other
   * @param {string} context
   * @returns {IntervalTypeName}
   */
  #assertCompatible(other, context) {
    if (!(other instanceof Interval)) {
      throw new TemporalKitTypeError('UNSUPPORTED_TYPE', `${context}() expects an Interval, but received ${typeof other}.`);
    }
    assertSameType([this.start, other.start], INTERVAL_TYPES, context);
    return this.#typeName;
  }

  /**
   * @param {string} context
   * @returns {Temporal.PlainDate} The end of the interval.
   */
  #assertDateInterval(context) {
    if (this.#typeName !== 'PlainDate') {
      throw new TemporalKitTypeError(
        'UNSUPPORTED_TYPE',
        `${context}() only works on PlainDate intervals, but this interval holds Temporal.${this.#typeName} values.`,
      );
    }
    return /** @type {Temporal.PlainDate} */ (this.end);
  }
}

/**
 * @param {Temporal.PlainDate} start
 * @param {Temporal.PlainDate} end
 * @returns {Generator<Temporal.PlainDate>}
 */
function* iterateDays(start, end) {
  const Temporal = getTemporal();
  let current = start;
  while (Temporal.PlainDate.compare(current, end) < 0) {
    yield current;
    current = current.add({ days: 1 });
  }
}

/**
 * Splits `start/end` at the slash that is not inside `[...]` brackets.
 *
 * @param {string} text
 * @returns {{ start: string, end: string } | null}
 */
function splitIntervalText(text) {
  let bracketDepth = 0;
  /** @type {number[]} */
  const slashPositions = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '[') {
      bracketDepth += 1;
    } else if (character === ']') {
      bracketDepth -= 1;
    } else if (character === '/' && bracketDepth === 0) {
      slashPositions.push(index);
    }
  }
  if (slashPositions.length !== 1) {
    return null;
  }
  const slashIndex = slashPositions[0];
  return { start: text.slice(0, slashIndex), end: text.slice(slashIndex + 1) };
}

/**
 * A sorted set of non-empty intervals of one type. Overlapping and adjacent
 * members are merged on construction. Instances are frozen; create them with
 * `IntervalSet.from()`.
 *
 * @template {IntervalValue} [T=IntervalValue]
 */
export class IntervalSet {
  /**
   * The member intervals, sorted by start.
   * @readonly
   * @type {readonly Interval<T>[]}
   */
  intervals;

  /**
   * True when the set has no intervals.
   * @readonly
   * @type {boolean}
   */
  isEmpty;

  /**
   * @param {symbol} key
   * @param {readonly Interval<T>[]} normalized Sorted, merged, non-empty intervals.
   */
  constructor(key, normalized) {
    if (key !== CONSTRUCTOR_KEY) {
      throw new TemporalKitConfigError('IntervalSet cannot be constructed directly; use IntervalSet.from(intervals).');
    }
    this.intervals = Object.freeze([...normalized]);
    this.isEmpty = normalized.length === 0;
    Object.freeze(this);
  }

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
  static from(intervals) {
    getTemporal();
    if (!Array.isArray(intervals)) {
      throw new TemporalKitConfigError(`IntervalSet.from() expects an array of Interval, but received ${typeof intervals}.`);
    }
    intervals.forEach((item, index) => {
      if (!(item instanceof Interval)) {
        throw new TemporalKitTypeError(
          'UNSUPPORTED_TYPE',
          `IntervalSet.from() item ${index} is not an Interval; create it with Interval.of(start, end).`,
        );
      }
    });
    if (intervals.length === 0) {
      return new IntervalSet(CONSTRUCTOR_KEY, []);
    }

    const starts = intervals.map((item) => item.start);
    const typeName = /** @type {IntervalTypeName} */ (assertSameType(starts, INTERVAL_TYPES, 'IntervalSet.from'));
    const nonEmpty = intervals.filter((item) => !item.isEmpty);
    const sorted = [...nonEmpty].sort((first, second) => compareValues(typeName, first.start, second.start));

    /** @type {Interval<V>[]} */
    const merged = [];
    for (const current of sorted) {
      const previous = merged[merged.length - 1];
      if (previous === undefined) {
        merged.push(current);
        continue;
      }
      const touchesOrOverlaps = compareValues(typeName, current.start, previous.end) <= 0;
      if (!touchesOrOverlaps) {
        merged.push(current);
        continue;
      }
      const extendsPrevious = compareValues(typeName, current.end, previous.end) > 0;
      if (extendsPrevious) {
        merged[merged.length - 1] = new Interval(CONSTRUCTOR_KEY, previous.start, current.end, typeName);
      }
    }
    return new IntervalSet(CONSTRUCTOR_KEY, merged);
  }

  /**
   * Returns true when any member interval contains `value`.
   *
   * @param {T} value
   * @returns {boolean}
   * @throws {TemporalKitTypeError} When value is not a supported type, or not the set's type.
   * @example
   * schedule.contains(Temporal.PlainDateTime.from('2026-11-02T09:00'));
   */
  contains(value) {
    assertType(value, INTERVAL_TYPES, 'IntervalSet.contains(value)');
    return this.intervals.some((interval) => interval.contains(value));
  }

  /**
   * Returns every point covered by this set or `other`.
   *
   * @param {IntervalSet<T> | Interval<T>} other
   * @returns {IntervalSet<T>}
   * @throws {TemporalKitTypeError} When other is not an Interval or IntervalSet of the same type.
   * @example
   * leaves.union(newLeave);
   */
  union(other) {
    const otherIntervals = this.#readOther(other, 'IntervalSet.union');
    return IntervalSet.from([...this.intervals, ...otherIntervals]);
  }

  /**
   * Returns the points covered by both this set and `other`.
   *
   * @param {IntervalSet<T> | Interval<T>} other
   * @returns {IntervalSet<T>}
   * @throws {TemporalKitTypeError} When other is not an Interval or IntervalSet of the same type.
   * @example
   * schedule.intersection(actual).totalDuration(); // hours rendered
   */
  intersection(other) {
    const otherIntervals = this.#readOther(other, 'IntervalSet.intersection');
    /** @type {Interval<T>[]} */
    const pieces = [];
    for (const ownInterval of this.intervals) {
      for (const otherInterval of otherIntervals) {
        const overlap = ownInterval.intersection(otherInterval);
        if (overlap !== null) {
          pieces.push(overlap);
        }
      }
    }
    return IntervalSet.from(pieces);
  }

  /**
   * Returns the points covered by this set but not by `other`.
   *
   * @param {IntervalSet<T> | Interval<T>} other
   * @returns {IntervalSet<T>}
   * @throws {TemporalKitTypeError} When other is not an Interval or IntervalSet of the same type.
   * @example
   * schedule.subtract(actual).totalDuration(); // undertime
   */
  subtract(other) {
    const otherIntervals = this.#readOther(other, 'IntervalSet.subtract');
    /** @type {Interval<T>[]} */
    let remaining = [...this.intervals];
    for (const cut of otherIntervals) {
      /** @type {Interval<T>[]} */
      const next = [];
      for (const piece of remaining) {
        next.push(...subtractOne(piece, cut));
      }
      remaining = next;
    }
    return IntervalSet.from(remaining);
  }

  /**
   * Returns the parts of `within` that no member interval covers.
   *
   * @param {Interval<T>} within
   * @returns {IntervalSet<T>}
   * @throws {TemporalKitTypeError} When within is not an Interval of the same type.
   * @example
   * bookings.gaps(openingHours); // free slots
   */
  gaps(within) {
    if (!(within instanceof Interval)) {
      throw new TemporalKitTypeError('UNSUPPORTED_TYPE', `IntervalSet.gaps() expects an Interval, but received ${typeof within}.`);
    }
    return IntervalSet.from([within]).subtract(this);
  }

  /**
   * Returns the summed length of all member intervals: days for PlainDate
   * sets, otherwise `largestUnit: 'hour'`. An empty set returns `PT0S`.
   *
   * @returns {Temporal.Duration}
   * @example
   * schedule.totalDuration(); // PT8H
   */
  totalDuration() {
    const Temporal = getTemporal();
    let total = new Temporal.Duration();
    for (const interval of this.intervals) {
      total = total.add(interval.duration());
    }
    return total;
  }

  /**
   * Returns the member intervals as ISO 8601 strings, so `JSON.stringify` works.
   *
   * @returns {string[]}
   * @example
   * JSON.stringify(schedule); // '["2026-11-02T08:00:00/2026-11-02T12:00:00", ...]'
   */
  toJSON() {
    return this.intervals.map((interval) => interval.toString());
  }

  /**
   * Iterates over the member intervals in order.
   *
   * @returns {Iterator<Interval<T>>}
   * @example
   * for (const interval of schedule) console.log(String(interval));
   */
  [Symbol.iterator]() {
    return this.intervals[Symbol.iterator]();
  }

  /**
   * @param {unknown} other
   * @param {string} context
   * @returns {readonly Interval<T>[]}
   */
  #readOther(other, context) {
    /** @type {readonly Interval<T>[]} */
    let otherIntervals;
    if (other instanceof Interval) {
      otherIntervals = [other];
    } else if (other instanceof IntervalSet) {
      otherIntervals = other.intervals;
    } else {
      throw new TemporalKitTypeError(
        'UNSUPPORTED_TYPE',
        `${context}() expects an Interval or IntervalSet, but received ${typeof other}.`,
      );
    }

    const firstOther = otherIntervals[0];
    const firstOwn = this.intervals[0];
    if (firstOther !== undefined && firstOwn !== undefined) {
      assertSameType([firstOwn.start, firstOther.start], INTERVAL_TYPES, context);
    }
    return otherIntervals;
  }
}

/**
 * Removes `cut` from `piece`, returning zero, one, or two intervals.
 *
 * @template {IntervalValue} T
 * @param {Interval<T>} piece
 * @param {Interval<T>} cut
 * @returns {Interval<T>[]}
 */
function subtractOne(piece, cut) {
  if (!piece.overlaps(cut)) {
    return [piece];
  }
  const typeName = /** @type {IntervalTypeName} */ (assertType(piece.start, INTERVAL_TYPES, 'IntervalSet.subtract'));
  /** @type {Interval<T>[]} */
  const result = [];
  const pieceStartsBeforeCut = compareValues(typeName, piece.start, cut.start) < 0;
  if (pieceStartsBeforeCut) {
    result.push(new Interval(CONSTRUCTOR_KEY, piece.start, cut.start, typeName));
  }
  const pieceEndsAfterCut = compareValues(typeName, piece.end, cut.end) > 0;
  if (pieceEndsAfterCut) {
    result.push(new Interval(CONSTRUCTOR_KEY, cut.end, piece.end, typeName));
  }
  return result;
}
