/**
 * Argument validation and small string helpers shared by the modules.
 */

import { TemporalKitConfigError } from './errors.js';
import { getTemporal } from './temporal.js';

/**
 * Returns the options object, or an empty object when `options` is undefined.
 *
 * @template {object} O
 * @param {O | undefined} options
 * @param {string} context
 * @returns {Partial<O>}
 * @throws {TemporalKitConfigError} When options is not an object.
 */
export function readOptions(options, context) {
  if (options === undefined) {
    return {};
  }
  if (options === null || typeof options !== 'object') {
    throw new TemporalKitConfigError(`${context} options must be an object, but received ${String(options)}.`);
  }
  return options;
}

/**
 * Asserts that a value is one of the allowed literal values.
 *
 * @template T
 * @param {unknown} value
 * @param {readonly T[]} allowed
 * @param {string} context Name of the argument or option, e.g. `"startOf() unit"`.
 * @returns {T}
 * @throws {TemporalKitConfigError}
 */
export function assertOneOf(value, allowed, context) {
  const isAllowed = allowed.includes(/** @type {T} */ (value));
  if (!isAllowed) {
    const allowedText = allowed.map((item) => JSON.stringify(item)).join(', ');
    throw new TemporalKitConfigError(`${context} must be one of ${allowedText}, but received ${JSON.stringify(value)}.`);
  }
  return /** @type {T} */ (value);
}

/**
 * Asserts that a value is an integer.
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {number}
 * @throws {TemporalKitConfigError}
 */
export function assertInteger(value, context) {
  if (typeof value !== 'number') {
    throw new TemporalKitConfigError(`${context} must be an integer, but received ${typeof value} ${String(value)}.`);
  }
  if (!Number.isInteger(value)) {
    throw new TemporalKitConfigError(`${context} must be an integer, but received ${value}.`);
  }
  return value;
}

/**
 * Asserts that a value is a boolean.
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {boolean}
 * @throws {TemporalKitConfigError}
 */
export function assertBoolean(value, context) {
  if (typeof value !== 'boolean') {
    throw new TemporalKitConfigError(`${context} must be true or false, but received ${typeof value} ${String(value)}.`);
  }
  return value;
}

/**
 * Asserts that a value is an ISO weekday number, 1 (Monday) to 7 (Sunday).
 *
 * @param {unknown} value
 * @param {string} context
 * @returns {number}
 * @throws {TemporalKitConfigError}
 */
export function assertWeekday(value, context) {
  const weekday = assertInteger(value, context);
  if (weekday < 1) {
    throw new TemporalKitConfigError(`${context} must be an ISO weekday from 1 (Monday) to 7 (Sunday), but received ${weekday}.`);
  }
  if (weekday > 7) {
    throw new TemporalKitConfigError(`${context} must be an ISO weekday from 1 (Monday) to 7 (Sunday), but received ${weekday}.`);
  }
  return weekday;
}

/**
 * Validates a time zone ID and returns its canonical form, such as
 * `'Asia/Manila'` for `'asia/manila'`.
 *
 * @param {unknown} timeZoneId
 * @param {string} context
 * @returns {string}
 * @throws {TemporalKitConfigError} When the ID is missing or not a known time zone.
 */
export function assertTimeZoneId(timeZoneId, context) {
  const Temporal = getTemporal();
  if (timeZoneId === undefined) {
    throw new TemporalKitConfigError(`${context} requires a time zone ID such as 'Asia/Manila' or 'UTC'; none was given.`);
  }
  if (typeof timeZoneId !== 'string') {
    throw new TemporalKitConfigError(`${context} time zone must be a string such as 'Asia/Manila', but received ${typeof timeZoneId}.`);
  }
  if (timeZoneId === '') {
    throw new TemporalKitConfigError(`${context} time zone must not be an empty string; use an ID such as 'Asia/Manila' or 'UTC'.`);
  }
  try {
    const probe = Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timeZoneId);
    return probe.timeZoneId;
  } catch {
    throw new TemporalKitConfigError(`${context} received an unknown time zone ${JSON.stringify(timeZoneId)}. Use an IANA ID such as 'Asia/Manila'.`);
  }
}

/**
 * Left-pads a non-negative integer with zeros.
 *
 * @param {number} value
 * @param {number} width
 * @returns {string}
 */
export function padNumber(value, width) {
  return String(value).padStart(width, '0');
}

/**
 * Splits a string of 1 to 9 fractional-second digits into sub-second fields.
 * `'5'` means 500 milliseconds; `'000123'` means 123 microseconds.
 *
 * @param {string | undefined} digits
 * @returns {{ millisecond: number, microsecond: number, nanosecond: number }}
 */
export function parseFractionDigits(digits) {
  if (digits === undefined || digits === '') {
    return { millisecond: 0, microsecond: 0, nanosecond: 0 };
  }
  const nineDigits = digits.padEnd(9, '0');
  return {
    millisecond: Number(nineDigits.slice(0, 3)),
    microsecond: Number(nineDigits.slice(3, 6)),
    nanosecond: Number(nineDigits.slice(6, 9)),
  };
}
