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
import { TemporalKitConfigError, TemporalKitParseError, TemporalKitTypeError } from './internal/errors.js';
import { assertSameType, assertType, getTemporal, typeOf } from './internal/temporal.js';
import { assertBoolean, assertInteger, assertWeekday, readOptions } from './internal/validate.js';

/**
 * @typedef {object} WorkingHoursWindow
 * @property {string} start Wall-clock start such as `'08:00'`.
 * @property {string} end Wall-clock end such as `'12:00'`; must be after start.
 */

/**
 * @typedef {object} BusinessCalendarOptions
 * @property {number[]} [weekend] ISO weekdays that are not worked; default `[6, 7]` (Saturday, Sunday).
 * @property {(Temporal.PlainDate | string)[]} [holidays]
 * @property {(Temporal.PlainDate | string)[]} [nonWorkingDays] Suspensions and closures.
 * @property {(Temporal.PlainDate | string)[]} [extraWorkingDays] Make-up days that override weekend and holidays.
 * @property {WorkingHoursWindow[]} [workingHours] Daily windows, e.g. 08:00–12:00 and 13:00–17:00.
 */

/** Searches for a working day give up after this many days, so bad configuration cannot hang a server. */
const MAX_SEARCH_DAYS = 3660;

const DEFAULT_WEEKEND = Object.freeze([6, 7]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A set of working-day rules. Instances are frozen; use `with()` to derive a
 * changed calendar.
 */
export class BusinessCalendar {
  /** @type {BusinessCalendarOptions} */
  #options;
  /** @type {Set<number>} */
  #weekend;
  /** @type {Set<string>} */
  #holidays;
  /** @type {Set<string>} */
  #nonWorkingDays;
  /** @type {Set<string>} */
  #extraWorkingDays;
  /** @type {{ start: Temporal.PlainTime, end: Temporal.PlainTime }[]} */
  #workingHours;

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
  constructor(options) {
    getTemporal();
    const readValue = readOptions(options, 'BusinessCalendar');

    this.#weekend = readWeekend(readValue.weekend);
    this.#holidays = readDateSet(readValue.holidays, 'holidays');
    this.#nonWorkingDays = readDateSet(readValue.nonWorkingDays, 'nonWorkingDays');
    this.#extraWorkingDays = readDateSet(readValue.extraWorkingDays, 'extraWorkingDays');
    this.#workingHours = readWorkingHours(readValue.workingHours);

    this.#options = Object.freeze({
      weekend: [...this.#weekend],
      holidays: [...this.#holidays],
      nonWorkingDays: [...this.#nonWorkingDays],
      extraWorkingDays: [...this.#extraWorkingDays],
      workingHours: this.#workingHours.map((window) => ({ start: window.start.toString(), end: window.end.toString() })),
    });
    Object.freeze(this);
  }

  /**
   * Returns true when `date` is a working day under this calendar's rules.
   *
   * @param {Temporal.PlainDate} date
   * @returns {boolean}
   * @throws {TemporalKitTypeError} When date is not a PlainDate.
   * @example
   * calendar.isWorkingDay(Temporal.PlainDate.from('2026-11-07')); // false (Saturday)
   */
  isWorkingDay(date) {
    assertType(date, ['PlainDate'], 'isWorkingDay(date)');
    return this.#isWorkingDay(date);
  }

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
  nextWorkingDay(date, options) {
    assertType(date, ['PlainDate'], 'nextWorkingDay(date)');
    const includeToday = readIncludeToday(options, 'nextWorkingDay()');
    return this.#searchWorkingDay(date, 1, includeToday, 'nextWorkingDay()');
  }

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
  previousWorkingDay(date, options) {
    assertType(date, ['PlainDate'], 'previousWorkingDay(date)');
    const includeToday = readIncludeToday(options, 'previousWorkingDay()');
    return this.#searchWorkingDay(date, -1, includeToday, 'previousWorkingDay()');
  }

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
  addWorkingDays(date, n) {
    assertType(date, ['PlainDate'], 'addWorkingDays(date)');
    const steps = assertInteger(n, 'addWorkingDays() n');
    if (steps === 0) {
      return date;
    }

    const direction = steps > 0 ? 1 : -1;
    let current = date;
    for (let step = 0; step < Math.abs(steps); step += 1) {
      current = this.#searchWorkingDay(current, direction, false, 'addWorkingDays()');
    }
    return current;
  }

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
  workingDaysBetween(start, end) {
    assertSameType([start, end], ['PlainDate'], 'workingDaysBetween');
    const Temporal = getTemporal();
    const comparison = Temporal.PlainDate.compare(start, end);
    if (comparison > 0) {
      return -this.#countWorkingDays(end, start);
    }
    return this.#countWorkingDays(start, end);
  }

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
  workingDays(range) {
    if (!(range instanceof Interval)) {
      throw new TemporalKitTypeError('UNSUPPORTED_TYPE', 'workingDays() expects an Interval of PlainDate values, such as Interval.fromInclusiveDates(first, last).');
    }
    assertType(range.start, ['PlainDate'], 'workingDays(range)');
    return this.#iterateWorkingDays(range);
  }

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
  workingDurationBetween(start, end) {
    assertSameType([start, end], ['PlainDateTime'], 'workingDurationBetween');
    if (this.#workingHours.length === 0) {
      throw new TemporalKitConfigError(
        "workingDurationBetween() needs workingHours, such as [{ start: '08:00', end: '17:00' }], in the BusinessCalendar options.",
      );
    }
    const Temporal = getTemporal();
    const comparison = Temporal.PlainDateTime.compare(start, end);
    if (comparison > 0) {
      return this.#sumWorkingTime(end, start).negated();
    }
    return this.#sumWorkingTime(start, end);
  }

  /**
   * Returns a new calendar with some options replaced. Lists are replaced, not merged.
   *
   * @param {Partial<BusinessCalendarOptions>} changes
   * @returns {BusinessCalendar}
   * @throws {TemporalKitConfigError} When changes is not an object or produces invalid options.
   * @example
   * const withSuspension = calendar.with({ nonWorkingDays: ['2026-11-03'] });
   */
  with(changes) {
    if (changes === null || typeof changes !== 'object') {
      throw new TemporalKitConfigError(`BusinessCalendar.with() expects an object of option changes, but received ${String(changes)}.`);
    }
    return new BusinessCalendar({ ...this.#options, ...changes });
  }

  /**
   * @param {Temporal.PlainDate} date
   * @returns {boolean}
   */
  #isWorkingDay(date) {
    const key = toDateKey(date);
    if (this.#extraWorkingDays.has(key)) {
      return true;
    }
    if (this.#holidays.has(key)) {
      return false;
    }
    if (this.#nonWorkingDays.has(key)) {
      return false;
    }
    if (this.#weekend.has(date.withCalendar('iso8601').dayOfWeek)) {
      return false;
    }
    return true;
  }

  /**
   * @param {Temporal.PlainDate} date
   * @param {1 | -1} direction
   * @param {boolean} includeToday
   * @param {string} context
   * @returns {Temporal.PlainDate}
   */
  #searchWorkingDay(date, direction, includeToday, context) {
    if (includeToday && this.#isWorkingDay(date)) {
      return date;
    }
    let candidate = date;
    for (let daysSearched = 1; daysSearched <= MAX_SEARCH_DAYS; daysSearched += 1) {
      candidate = candidate.add({ days: direction });
      if (this.#isWorkingDay(candidate)) {
        return candidate;
      }
    }
    throw new TemporalKitConfigError(
      `${context} found no working day within ${MAX_SEARCH_DAYS} days of ${date}. Check the weekend, holidays, and nonWorkingDays options.`,
    );
  }

  /**
   * @param {Temporal.PlainDate} start
   * @param {Temporal.PlainDate} end Not before start.
   * @returns {number}
   */
  #countWorkingDays(start, end) {
    const Temporal = getTemporal();
    let count = 0;
    let current = start;
    while (Temporal.PlainDate.compare(current, end) < 0) {
      if (this.#isWorkingDay(current)) {
        count += 1;
      }
      current = current.add({ days: 1 });
    }
    return count;
  }

  /**
   * @param {Interval<Temporal.PlainDate>} range
   * @returns {Generator<Temporal.PlainDate>}
   */
  *#iterateWorkingDays(range) {
    for (const day of range.days()) {
      if (this.#isWorkingDay(day)) {
        yield day;
      }
    }
  }

  /**
   * @param {Temporal.PlainDateTime} start
   * @param {Temporal.PlainDateTime} end Not before start.
   * @returns {Temporal.Duration}
   */
  #sumWorkingTime(start, end) {
    const Temporal = getTemporal();
    const range = Interval.of(start, end);
    let total = new Temporal.Duration();
    let day = start.toPlainDate();
    const lastDay = end.toPlainDate();

    while (Temporal.PlainDate.compare(day, lastDay) <= 0) {
      if (this.#isWorkingDay(day)) {
        for (const window of this.#workingHours) {
          const windowInterval = Interval.of(day.toPlainDateTime(window.start), day.toPlainDateTime(window.end));
          const overlap = range.intersection(windowInterval);
          if (overlap !== null) {
            total = total.add(overlap.duration());
          }
        }
      }
      day = day.add({ days: 1 });
    }
    return total.round({ largestUnit: 'hour' });
  }
}

/**
 * @param {unknown} weekend
 * @returns {Set<number>}
 */
function readWeekend(weekend) {
  if (weekend === undefined) {
    return new Set(DEFAULT_WEEKEND);
  }
  if (!Array.isArray(weekend)) {
    throw new TemporalKitConfigError(`BusinessCalendar weekend must be an array of ISO weekdays such as [6, 7], but received ${typeof weekend}.`);
  }
  const days = new Set();
  weekend.forEach((item, index) => {
    days.add(assertWeekday(item, `BusinessCalendar weekend[${index}]`));
  });
  if (days.size === 7) {
    throw new TemporalKitConfigError(
      'BusinessCalendar weekend covers all seven weekdays, so no day could ever be a working day. Remove at least one weekday.',
    );
  }
  return days;
}

/**
 * @param {unknown} list
 * @param {string} optionName
 * @returns {Set<string>}
 */
function readDateSet(list, optionName) {
  if (list === undefined) {
    return new Set();
  }
  if (!Array.isArray(list)) {
    throw new TemporalKitConfigError(`BusinessCalendar ${optionName} must be an array of PlainDate or 'YYYY-MM-DD' strings, but received ${typeof list}.`);
  }
  const keys = new Set();
  list.forEach((item, index) => {
    keys.add(readDateKey(item, `${optionName}[${index}]`));
  });
  return keys;
}

/**
 * @param {unknown} item
 * @param {string} path
 * @returns {string}
 */
function readDateKey(item, path) {
  const Temporal = getTemporal();
  if (typeOf(item) === 'PlainDate') {
    return toDateKey(/** @type {Temporal.PlainDate} */ (item));
  }
  if (typeof item !== 'string') {
    throw new TemporalKitConfigError(`BusinessCalendar ${path} must be a PlainDate or a 'YYYY-MM-DD' string, but received ${typeof item}.`);
  }
  if (!ISO_DATE_PATTERN.test(item)) {
    throw new TemporalKitParseError(`BusinessCalendar ${path} must look like 'YYYY-MM-DD', but received ${JSON.stringify(item)}.`, {
      input: item,
      path,
    });
  }
  try {
    const date = Temporal.PlainDate.from(item, { overflow: 'reject' });
    return toDateKey(date);
  } catch {
    throw new TemporalKitParseError(`BusinessCalendar ${path} is not a real date: ${JSON.stringify(item)}.`, { input: item, path });
  }
}

/**
 * Returns the ISO calendar string used as a Set key.
 *
 * @param {Temporal.PlainDate} date
 * @returns {string}
 */
function toDateKey(date) {
  return date.withCalendar('iso8601').toString();
}

/**
 * @param {unknown} windows
 * @returns {{ start: Temporal.PlainTime, end: Temporal.PlainTime }[]}
 */
function readWorkingHours(windows) {
  if (windows === undefined) {
    return [];
  }
  if (!Array.isArray(windows)) {
    throw new TemporalKitConfigError("BusinessCalendar workingHours must be an array such as [{ start: '08:00', end: '17:00' }].");
  }

  const Temporal = getTemporal();
  const parsed = windows.map((window, index) => {
    const path = `workingHours[${index}]`;
    if (window === null || typeof window !== 'object') {
      throw new TemporalKitConfigError(`BusinessCalendar ${path} must be an object with start and end, such as { start: '08:00', end: '12:00' }.`);
    }
    const start = readTime(window.start, `${path}.start`);
    const end = readTime(window.end, `${path}.end`);
    if (Temporal.PlainTime.compare(start, end) >= 0) {
      throw new TemporalKitConfigError(
        `BusinessCalendar ${path} ends at ${end}, which is not after its start ${start}. Overnight windows are not supported; split them at midnight.`,
      );
    }
    return { start, end };
  });

  const sorted = [...parsed].sort((first, second) => Temporal.PlainTime.compare(first.start, second.start));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (Temporal.PlainTime.compare(current.start, previous.end) < 0) {
      throw new TemporalKitConfigError(
        `BusinessCalendar workingHours overlap: ${previous.start}–${previous.end} and ${current.start}–${current.end}.`,
      );
    }
  }
  return sorted;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {Temporal.PlainTime}
 */
function readTime(value, path) {
  const Temporal = getTemporal();
  if (typeOf(value) === 'PlainTime') {
    return /** @type {Temporal.PlainTime} */ (value);
  }
  if (typeof value !== 'string') {
    throw new TemporalKitConfigError(`BusinessCalendar ${path} must be a time string such as '08:00', but received ${typeof value}.`);
  }
  try {
    return Temporal.PlainTime.from(value, { overflow: 'reject' });
  } catch {
    throw new TemporalKitParseError(`BusinessCalendar ${path} is not a valid time: ${JSON.stringify(value)}. Use 'HH:mm', such as '08:00'.`, {
      input: value,
      path,
    });
  }
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
