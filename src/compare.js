/**
 * Readable comparisons for Temporal values, replacing
 * `Temporal.X.compare(a, b) > 0` style checks.
 *
 * @module orasna/compare
 */

import { TemporalKitConfigError, TemporalKitTypeError } from './internal/errors.js';
import { assertSameType, assertType, getTemporal, typeOf } from './internal/temporal.js';
import { assertOneOf, readOptions } from './internal/validate.js';

/**
 * A Temporal value that has a total order.
 *
 * @typedef {Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime
 *   | Temporal.PlainYearMonth | Temporal.ZonedDateTime | Temporal.Instant} Comparable
 */

/**
 * Interval bounds notation: `[` and `]` include the endpoint, `(` and `)` exclude it.
 *
 * @typedef {'[)' | '[]' | '()' | '(]'} Bounds
 */

/** @type {readonly import('./internal/temporal.js').TypeName[]} */
const COMPARABLE_TYPES = Object.freeze([
  'PlainDate',
  'PlainTime',
  'PlainDateTime',
  'PlainYearMonth',
  'ZonedDateTime',
  'Instant',
]);

/** @type {readonly Bounds[]} */
const BOUNDS_VALUES = Object.freeze(['[)', '[]', '()', '(]']);

/**
 * Compares two values of the same Temporal type and returns -1, 0, or 1.
 *
 * @param {unknown[]} values Values to validate; the first two are compared.
 * @param {string} context Function name for error messages.
 * @returns {number}
 */
function compareValues(values, context) {
  rejectPlainMonthDay(values, context);
  const typeName = assertSameType(values, COMPARABLE_TYPES, context);
  const Temporal = getTemporal();
  const compareFunction = /** @type {any} */ (Temporal)[typeName].compare;
  return compareFunction(values[0], values[1]);
}

/**
 * Gives `PlainMonthDay` its own, more helpful error message.
 *
 * @param {unknown[]} values
 * @param {string} context
 */
function rejectPlainMonthDay(values, context) {
  getTemporal();
  for (const value of values) {
    if (typeOf(value) === 'PlainMonthDay') {
      throw new TemporalKitTypeError(
        'UNSUPPORTED_TYPE',
        `${context}() cannot compare Temporal.PlainMonthDay values because month-days have no order without a year. ` +
          'Convert them with toPlainDate({ year }) first.',
      );
    }
  }
}

/**
 * Returns true when `a` is strictly before `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isBefore(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-03')); // true
 */
export function isBefore(a, b) {
  const result = compareValues([a, b], 'isBefore');
  return result < 0;
}

/**
 * Returns true when `a` is strictly after `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isAfter(Temporal.PlainTime.from('14:00'), Temporal.PlainTime.from('09:00')); // true
 */
export function isAfter(a, b) {
  const result = compareValues([a, b], 'isAfter');
  return result > 0;
}

/**
 * Returns true when `a` is before or equal to `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isSameOrBefore(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-02')); // true
 */
export function isSameOrBefore(a, b) {
  const result = compareValues([a, b], 'isSameOrBefore');
  return result <= 0;
}

/**
 * Returns true when `a` is after or equal to `b`.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isSameOrAfter(Temporal.PlainDate.from('2026-11-03'), Temporal.PlainDate.from('2026-11-02')); // true
 */
export function isSameOrAfter(a, b) {
  const result = compareValues([a, b], 'isSameOrAfter');
  return result >= 0;
}

/**
 * Returns true when `Temporal.X.compare(a, b) === 0`. Two `ZonedDateTime`
 * values in different time zones are the same moment when they refer to the
 * same instant; use `a.equals(b)` to also require the same zone and calendar.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * isSameMoment(
 *   Temporal.ZonedDateTime.from('2026-11-02T14:00[Asia/Manila]'),
 *   Temporal.ZonedDateTime.from('2026-11-02T06:00[UTC]'),
 * ); // true
 */
export function isSameMoment(a, b) {
  const result = compareValues([a, b], 'isSameMoment');
  return result === 0;
}

/**
 * Returns true when `value` lies between `start` and `end`. Bounds default to
 * `'[)'`: start included, end excluded.
 *
 * @template {Comparable} T
 * @param {T} value
 * @param {T} start
 * @param {T} end
 * @param {{ bounds?: Bounds }} [options]
 * @returns {boolean}
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @throws {TemporalKitConfigError} When `bounds` is not one of `'[)'`, `'[]'`, `'()'`, `'(]'`.
 * @example
 * const noon = Temporal.PlainTime.from('12:00');
 * isBetween(noon, Temporal.PlainTime.from('08:00'), noon); // false: end is excluded
 */
export function isBetween(value, start, end, options) {
  return checkBetween(value, start, end, options, 'isBetween');
}

/**
 * Shared implementation of `isBetween()` and `is(value).between()`.
 *
 * @param {unknown} value
 * @param {unknown} start
 * @param {unknown} end
 * @param {{ bounds?: Bounds } | undefined} options
 * @param {string} context Function name for error messages.
 * @returns {boolean}
 */
function checkBetween(value, start, end, options, context) {
  const readOptionsResult = readOptions(options, `${context}()`);
  const boundsOption = readOptionsResult.bounds === undefined ? '[)' : readOptionsResult.bounds;
  const bounds = assertOneOf(boundsOption, BOUNDS_VALUES, `${context}() bounds option`);

  rejectPlainMonthDay([value, start, end], context);
  const typeName = assertSameType([value, start, end], COMPARABLE_TYPES, context);
  const compareFunction = /** @type {any} */ (getTemporal())[typeName].compare;

  const comparedToStart = compareFunction(value, start);
  const comparedToEnd = compareFunction(value, end);

  const includesStart = bounds.startsWith('[');
  const includesEnd = bounds.endsWith(']');

  let isAfterStart = comparedToStart > 0;
  if (includesStart) {
    isAfterStart = comparedToStart >= 0;
  }

  let isBeforeEnd = comparedToEnd < 0;
  if (includesEnd) {
    isBeforeEnd = comparedToEnd <= 0;
  }

  return isAfterStart && isBeforeEnd;
}

/**
 * Returns the earliest of one or more values of the same type.
 *
 * @template {Comparable} T
 * @param {...T} values
 * @returns {T}
 * @throws {TemporalKitConfigError} When called with no values.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * earliest(Temporal.PlainDate.from('2026-11-05'), Temporal.PlainDate.from('2026-11-02')); // 2026-11-02
 */
export function earliest(...values) {
  return pickExtreme(values, 'earliest', -1);
}

/**
 * Returns the latest of one or more values of the same type.
 *
 * @template {Comparable} T
 * @param {...T} values
 * @returns {T}
 * @throws {TemporalKitConfigError} When called with no values.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * latest(Temporal.PlainDate.from('2026-11-05'), Temporal.PlainDate.from('2026-11-02')); // 2026-11-05
 */
export function latest(...values) {
  return pickExtreme(values, 'latest', 1);
}

/**
 * @template {Comparable} T
 * @param {T[]} values
 * @param {string} context
 * @param {1 | -1} wantedSign 1 picks the latest value, -1 the earliest.
 * @returns {T}
 */
function pickExtreme(values, context, wantedSign) {
  getTemporal();
  if (values.length === 0) {
    throw new TemporalKitConfigError(`${context}() needs at least one value, but was called with none.`);
  }
  rejectPlainMonthDay(values, context);
  const typeName = assertSameType(values, COMPARABLE_TYPES, context);
  const compareFunction = /** @type {any} */ (getTemporal())[typeName].compare;

  let best = values[0];
  for (const candidate of values) {
    const comparison = compareFunction(candidate, best);
    if (comparison === wantedSign) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Comparator for `Array.prototype.sort` that orders values from earliest to latest.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {number} -1, 0, or 1.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * dates.sort(ascending);
 */
export function ascending(a, b) {
  return compareValues([a, b], 'ascending');
}

/**
 * Comparator for `Array.prototype.sort` that orders values from latest to earliest.
 *
 * @template {Comparable} T
 * @param {T} a
 * @param {T} b
 * @returns {number} -1, 0, or 1.
 * @throws {TemporalKitTypeError} When the values are not the same comparable Temporal type.
 * @example
 * dates.sort(descending);
 */
export function descending(a, b) {
  return compareValues([b, a], 'descending');
}

/**
 * The comparisons available on `is(value)`. Each method compares the wrapped
 * value with its arguments, which must be the same Temporal type.
 *
 * @template {Comparable} T
 * @typedef {{
 *   readonly value: T,
 *   before(other: T): boolean,
 *   after(other: T): boolean,
 *   sameOrBefore(other: T): boolean,
 *   sameOrAfter(other: T): boolean,
 *   sameMomentAs(other: T): boolean,
 *   between(start: T, end: T, options?: { bounds?: Bounds }): boolean,
 * }} Comparison
 */

/**
 * Wraps a value for comparisons that read like a sentence:
 * `is(submitted).before(due)` instead of `isBefore(submitted, due)`. Each
 * method gives the same result and throws the same errors as the matching
 * function: `before` is `isBefore`, `after` is `isAfter`, `sameOrBefore` is
 * `isSameOrBefore`, `sameOrAfter` is `isSameOrAfter`, `sameMomentAs` is
 * `isSameMoment`, and `between` is `isBetween`.
 *
 * @template {Comparable} T
 * @param {T} value
 * @returns {Comparison<T>} A frozen object; each method returns a boolean.
 * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` when the value is not a comparable Temporal type.
 *   The methods throw `TYPE_MISMATCH` when their arguments are a different type from the value.
 * @example
 * is(submitted).before(due);
 * is(Temporal.PlainTime.from('12:00')).between(Temporal.PlainTime.from('08:00'), Temporal.PlainTime.from('12:00')); // false
 */
export function is(value) {
  rejectPlainMonthDay([value], 'is');
  assertType(value, COMPARABLE_TYPES, 'is(value)');

  return Object.freeze({
    value,
    before: (other) => compareValues([value, other], 'is(value).before') < 0,
    after: (other) => compareValues([value, other], 'is(value).after') > 0,
    sameOrBefore: (other) => compareValues([value, other], 'is(value).sameOrBefore') <= 0,
    sameOrAfter: (other) => compareValues([value, other], 'is(value).sameOrAfter') >= 0,
    sameMomentAs: (other) => compareValues([value, other], 'is(value).sameMomentAs') === 0,
    between: (start, end, options) => checkBetween(value, start, end, options, 'is(value).between'),
  });
}
