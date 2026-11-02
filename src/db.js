/**
 * String-level converters between Temporal values and MySQL / PostgreSQL
 * column text, plus hooks for the `mysql2` and `pg` drivers. The package
 * never imports a driver; drivers are passed in.
 *
 * Convert Temporal values with the `to*` functions before binding them as
 * query parameters.
 *
 * MySQL zero dates (`0000-00-00`) and PostgreSQL `infinity` throw by default;
 * pass `{ onSpecialValue: 'null' }` to map them to `null`.
 *
 * @module orasna/db
 */

import {
  TemporalKitConfigError,
  TemporalKitParseError,
  TemporalKitRangeError,
} from './internal/errors.js';
import { assertType, getTemporal } from './internal/temporal.js';
import {
  assertInteger,
  assertOneOf,
  assertTimeZoneId,
  padNumber,
  parseFractionDigits,
  readOptions,
} from './internal/validate.js';

/**
 * @typedef {{ onSpecialValue?: 'throw' | 'null' }} SpecialValueOptions
 * @typedef {{ fractionalDigits?: number }} FractionOptions
 * @typedef {{ type: string, string(): string | null }} MySQL2Field
 * @typedef {(field: MySQL2Field, next: () => unknown) => unknown} TypeCastFn
 * @typedef {{ setTypeParser(oid: number, parser: (text: string) => unknown): void }} PgTypes
 */

const MYSQL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MYSQL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const MYSQL_TIME_PATTERN = /^(-)?(\d{2,3}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const PG_DATE_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})$/;
const PG_TIME_PATTERN = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const PG_TIMESTAMP_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;
const PG_TIMESTAMPTZ_PATTERN =
  /^(\d{4,})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/;

const MYSQL_TIME_MAX_HOURS = 838;
const PG_INFINITY_VALUES = Object.freeze(['infinity', '-infinity']);

const PG_OID_DATE = 1082;
const PG_OID_TIME = 1083;
const PG_OID_TIMESTAMP = 1114;
const PG_OID_TIMESTAMPTZ = 1184;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * @param {SpecialValueOptions | undefined} options
 * @param {string} context
 * @returns {'throw' | 'null'}
 */
function readSpecialValueOption(options, context) {
  const readValue = readOptions(options, context);
  if (readValue.onSpecialValue === undefined) {
    return 'throw';
  }
  return assertOneOf(readValue.onSpecialValue, /** @type {const} */ (['throw', 'null']), `${context} onSpecialValue option`);
}

/**
 * @param {FractionOptions | undefined} options
 * @param {string} context
 * @returns {number}
 */
function readFractionalDigits(options, context) {
  const readValue = readOptions(options, context);
  if (readValue.fractionalDigits === undefined) {
    return 0;
  }
  const digits = assertInteger(readValue.fractionalDigits, `${context} fractionalDigits option`);
  if (digits < 0 || digits > 6) {
    throw new TemporalKitConfigError(`${context} fractionalDigits must be 0 to 6, matching MySQL DATETIME(0) to DATETIME(6), but received ${digits}.`);
  }
  return digits;
}

/**
 * Handles a special column value according to `onSpecialValue`.
 *
 * @param {string} text
 * @param {'throw' | 'null'} mode
 * @param {string} context
 * @param {string} columnFormat
 * @returns {null}
 */
function handleSpecialValue(text, mode, context, columnFormat) {
  if (mode === 'null') {
    return null;
  }
  throw new TemporalKitParseError(
    `${context} received the special value ${JSON.stringify(text)}, which has no Temporal equivalent. ` +
      "Pass { onSpecialValue: 'null' } to read it as null.",
    { input: text, pattern: columnFormat },
  );
}

/**
 * @param {unknown} text
 * @param {string} context
 * @param {string} columnFormat
 * @returns {string}
 */
function assertText(text, context, columnFormat) {
  getTemporal();
  if (typeof text !== 'string') {
    throw new TemporalKitParseError(`${context} expects column text such as ${columnFormat}, but received ${typeof text}.`, {
      input: text,
      pattern: columnFormat,
    });
  }
  return text;
}

/**
 * @param {string} text
 * @param {string} context
 * @param {string} columnFormat
 * @returns {never}
 */
function throwFormatMismatch(text, context, columnFormat) {
  throw new TemporalKitParseError(`${context} expected column text like ${columnFormat}, but received ${JSON.stringify(text)}.`, {
    input: text,
    pattern: columnFormat,
  });
}

/**
 * Runs a Temporal construction and turns its RangeError into a parse error.
 *
 * @template R
 * @param {() => R} build
 * @param {string} text
 * @param {string} context
 * @param {string} columnFormat
 * @returns {R}
 */
function buildValue(build, text, context, columnFormat) {
  try {
    return build();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TemporalKitParseError(`${context} read ${JSON.stringify(text)}, but it is not a valid value: ${reason}`, {
      input: text,
      pattern: columnFormat,
    });
  }
}

/**
 * @param {RegExpExecArray} match
 * @param {number} firstIndex Index of the year group.
 * @returns {{ year: number, month: number, day: number }}
 */
function dateFieldsFrom(match, firstIndex) {
  return {
    year: Number(match[firstIndex]),
    month: Number(match[firstIndex + 1]),
    day: Number(match[firstIndex + 2]),
  };
}

/**
 * @param {RegExpExecArray} match
 * @param {number} firstIndex Index of the hour group; the fraction group follows seconds.
 * @returns {{ hour: number, minute: number, second: number, millisecond: number, microsecond: number }}
 */
function timeFieldsFrom(match, firstIndex) {
  const subSecond = parseFractionDigits(match[firstIndex + 3]);
  return {
    hour: Number(match[firstIndex]),
    minute: Number(match[firstIndex + 1]),
    second: Number(match[firstIndex + 2]),
    millisecond: subSecond.millisecond,
    microsecond: subSecond.microsecond,
  };
}

/**
 * Returns the fractional seconds text, such as `.123456`, `.5`, or `''`.
 *
 * @param {{ millisecond: number, microsecond: number }} value
 * @param {number | 'auto'} digits `'auto'` trims trailing zeros; a number truncates to that many digits.
 * @returns {string}
 */
function formatFraction(value, digits) {
  const sixDigits = `${padNumber(value.millisecond, 3)}${padNumber(value.microsecond, 3)}`;
  if (digits === 'auto') {
    const trimmed = sixDigits.replace(/0+$/, '');
    if (trimmed === '') {
      return '';
    }
    return `.${trimmed}`;
  }
  if (digits === 0) {
    return '';
  }
  return `.${sixDigits.slice(0, digits)}`;
}

/**
 * @param {Temporal.PlainDate | Temporal.PlainDateTime} value
 * @param {number} minimumYear
 * @param {string} context
 * @returns {string}
 */
function formatDatePart(value, minimumYear, context) {
  const isoValue = value.withCalendar('iso8601');
  if (isoValue.year < minimumYear) {
    throw new TemporalKitRangeError('INVALID_RANGE', `${context} cannot store year ${isoValue.year}; the column accepts years from ${minimumYear}.`);
  }
  return `${padNumber(isoValue.year, 4)}-${padNumber(isoValue.month, 2)}-${padNumber(isoValue.day, 2)}`;
}

/**
 * @param {Temporal.PlainTime | Temporal.PlainDateTime} value
 * @param {number | 'auto'} digits
 * @returns {string}
 */
function formatTimePart(value, digits) {
  const wholeSeconds = `${padNumber(value.hour, 2)}:${padNumber(value.minute, 2)}:${padNumber(value.second, 2)}`;
  return `${wholeSeconds}${formatFraction(value, digits)}`;
}

// ---------------------------------------------------------------------------
// MySQL
// ---------------------------------------------------------------------------

/**
 * Reads MySQL `DATE` text as a PlainDate.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDate | null} `null` only for zero dates with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD`, not a real date, or a zero date by default.
 * @example
 * fromMySQLDate('2026-11-02'); // Temporal.PlainDate 2026-11-02
 */
export function fromMySQLDate(text, options) {
  const context = 'fromMySQLDate()';
  const columnFormat = 'YYYY-MM-DD';
  const input = assertText(text, context, columnFormat);
  const mode = readSpecialValueOption(options, context);
  const Temporal = getTemporal();

  const match = MYSQL_DATE_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }
  const fields = dateFieldsFrom(match, 1);
  if (fields.month === 0 || fields.day === 0) {
    return handleSpecialValue(input, mode, context, columnFormat);
  }
  return buildValue(() => Temporal.PlainDate.from(fields, { overflow: 'reject' }), input, context, columnFormat);
}

/**
 * Formats a PlainDate as MySQL `DATE` text.
 *
 * @param {Temporal.PlainDate} date
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDate.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for negative years.
 * @example
 * toMySQLDate(Temporal.PlainDate.from('2026-11-02')); // '2026-11-02'
 */
export function toMySQLDate(date) {
  assertType(date, ['PlainDate'], 'toMySQLDate(date)');
  return formatDatePart(date, 0, 'toMySQLDate()');
}

/**
 * Reads MySQL `DATETIME` text (0–6 fractional digits) as a PlainDateTime.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDateTime | null} `null` only for zero dates with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD HH:MM:SS[.ffffff]`, is invalid, or a zero date by default.
 * @example
 * fromMySQLDateTime('2026-11-02 14:30:00.123'); // Temporal.PlainDateTime 2026-11-02T14:30:00.123
 */
export function fromMySQLDateTime(text, options) {
  const context = 'fromMySQLDateTime()';
  const input = assertText(text, context, 'YYYY-MM-DD HH:MM:SS[.ffffff]');
  const mode = readSpecialValueOption(options, context);
  return parseMySQLDateTime(input, mode, context);
}

/**
 * @param {string} input
 * @param {'throw' | 'null'} mode
 * @param {string} context
 * @returns {Temporal.PlainDateTime | null}
 */
function parseMySQLDateTime(input, mode, context) {
  const columnFormat = 'YYYY-MM-DD HH:MM:SS[.ffffff]';
  const Temporal = getTemporal();
  const match = MYSQL_DATE_TIME_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }
  const dateFields = dateFieldsFrom(match, 1);
  if (dateFields.month === 0 || dateFields.day === 0) {
    return handleSpecialValue(input, mode, context, columnFormat);
  }
  const fields = { ...dateFields, ...timeFieldsFrom(match, 4) };
  return buildValue(() => Temporal.PlainDateTime.from(fields, { overflow: 'reject' }), input, context, columnFormat);
}

/**
 * Formats a PlainDateTime as MySQL `DATETIME` text. Fractional seconds are
 * truncated to `fractionalDigits` (default 0, matching a plain `DATETIME` column).
 *
 * @param {Temporal.PlainDateTime} dateTime
 * @param {FractionOptions} [options]
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDateTime.
 * @throws {TemporalKitConfigError} When fractionalDigits is not 0 to 6.
 * @example
 * toMySQLDateTime(Temporal.PlainDateTime.from('2026-11-02T14:30:00.123'), { fractionalDigits: 3 }); // '2026-11-02 14:30:00.123'
 */
export function toMySQLDateTime(dateTime, options) {
  assertType(dateTime, ['PlainDateTime'], 'toMySQLDateTime(dateTime)');
  const digits = readFractionalDigits(options, 'toMySQLDateTime()');
  return formatMySQLDateTime(dateTime, digits, 'toMySQLDateTime()');
}

/**
 * @param {Temporal.PlainDateTime} dateTime
 * @param {number} digits
 * @param {string} context
 * @returns {string}
 */
function formatMySQLDateTime(dateTime, digits, context) {
  const isoDateTime = dateTime.withCalendar('iso8601');
  return `${formatDatePart(isoDateTime, 0, context)} ${formatTimePart(isoDateTime, digits)}`;
}

/**
 * Reads MySQL `TIMESTAMP` text as an Instant. MySQL renders `TIMESTAMP` in
 * the connection's session time zone, so that zone is required.
 *
 * @param {string} text
 * @param {string} sessionTimeZone The connection's `time_zone`, such as `'Asia/Manila'` or `'UTC'`.
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.Instant | null} `null` only for zero dates with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD HH:MM:SS[.ffffff]`, is invalid, or a zero date by default.
 * @throws {TemporalKitConfigError} When the session time zone is missing or unknown.
 * @example
 * fromMySQLTimestamp('2026-11-02 14:30:00', 'Asia/Manila'); // Temporal.Instant 2026-11-02T06:30:00Z
 */
export function fromMySQLTimestamp(text, sessionTimeZone, options) {
  const context = 'fromMySQLTimestamp()';
  const input = assertText(text, context, 'YYYY-MM-DD HH:MM:SS[.ffffff]');
  const timeZone = assertTimeZoneId(sessionTimeZone, context);
  const mode = readSpecialValueOption(options, context);
  const dateTime = parseMySQLDateTime(input, mode, context);
  if (dateTime === null) {
    return null;
  }
  return dateTime.toZonedDateTime(timeZone).toInstant();
}

/**
 * Formats an Instant as MySQL `TIMESTAMP` text in the session time zone.
 *
 * @param {Temporal.Instant} instant
 * @param {string} sessionTimeZone The connection's `time_zone`, such as `'Asia/Manila'` or `'UTC'`.
 * @param {FractionOptions} [options]
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not an Instant.
 * @throws {TemporalKitConfigError} When the session time zone is missing or unknown, or fractionalDigits is invalid.
 * @example
 * toMySQLTimestamp(Temporal.Instant.from('2026-11-02T06:30:00Z'), 'Asia/Manila'); // '2026-11-02 14:30:00'
 */
export function toMySQLTimestamp(instant, sessionTimeZone, options) {
  const context = 'toMySQLTimestamp()';
  assertType(instant, ['Instant'], 'toMySQLTimestamp(instant)');
  const timeZone = assertTimeZoneId(sessionTimeZone, context);
  const digits = readFractionalDigits(options, context);
  const wallClock = instant.toZonedDateTimeISO(timeZone).toPlainDateTime();
  return formatMySQLDateTime(wallClock, digits, context);
}

/**
 * Reads MySQL `TIME` text. The caller must choose the meaning: a time of day
 * (`'PlainTime'`, 00:00:00 to 23:59:59) or an elapsed time (`'Duration'`,
 * -838:59:59 to 838:59:59).
 *
 * @param {string} text
 * @param {{ as: 'PlainTime' | 'Duration' }} options
 * @returns {Temporal.PlainTime | Temporal.Duration}
 * @throws {TemporalKitConfigError} When `as` is missing or not `'PlainTime'` or `'Duration'`.
 * @throws {TemporalKitParseError} When the text does not match, or is out of range for the chosen type.
 * @example
 * fromMySQLTime('838:59:59', { as: 'Duration' }); // Temporal.Duration PT838H59M59S
 */
export function fromMySQLTime(text, options) {
  const context = 'fromMySQLTime()';
  const columnFormat = '[-]HH:MM:SS[.ffffff]';
  const input = assertText(text, context, columnFormat);
  const readValue = readOptions(options, context);
  if (readValue.as === undefined) {
    throw new TemporalKitConfigError("fromMySQLTime() needs { as: 'PlainTime' } or { as: 'Duration' }; MySQL TIME can mean either.");
  }
  const targetType = assertOneOf(readValue.as, /** @type {const} */ (['PlainTime', 'Duration']), 'fromMySQLTime() as option');
  const Temporal = getTemporal();

  const match = MYSQL_TIME_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }
  const isNegative = match[1] === '-';
  const fields = timeFieldsFrom(match, 2);

  if (targetType === 'PlainTime') {
    if (isNegative) {
      throw new TemporalKitParseError(`fromMySQLTime() cannot read negative ${JSON.stringify(input)} as a PlainTime; use { as: 'Duration' }.`, {
        input,
        pattern: columnFormat,
      });
    }
    return buildValue(() => Temporal.PlainTime.from(fields, { overflow: 'reject' }), input, context, columnFormat);
  }

  const isOutOfRange = fields.hour > MYSQL_TIME_MAX_HOURS || fields.minute > 59 || fields.second > 59;
  if (isOutOfRange) {
    throw new TemporalKitParseError(`fromMySQLTime() read ${JSON.stringify(input)}, which is outside MySQL TIME's -838:59:59 to 838:59:59.`, {
      input,
      pattern: columnFormat,
    });
  }
  const duration = new Temporal.Duration(0, 0, 0, 0, fields.hour, fields.minute, fields.second, fields.millisecond, fields.microsecond);
  if (isNegative) {
    return duration.negated();
  }
  return duration;
}

/**
 * Formats a PlainTime or a Duration as MySQL `TIME` text. Fractional
 * seconds are written only when nonzero, up to microseconds.
 *
 * @param {Temporal.PlainTime | Temporal.Duration} value
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainTime or Duration.
 * @throws {TemporalKitRangeError} With code `NEEDS_REFERENCE_DATE` for durations with years, months, or weeks,
 *   or `INVALID_RANGE` beyond ±838:59:59.
 * @example
 * toMySQLTime(Temporal.Duration.from('PT27H5M')); // '27:05:00'
 */
export function toMySQLTime(value) {
  const typeName = assertType(value, ['PlainTime', 'Duration'], 'toMySQLTime(value)');
  if (typeName === 'PlainTime') {
    return formatTimePart(/** @type {Temporal.PlainTime} */ (value), 'auto');
  }

  const duration = /** @type {Temporal.Duration} */ (value);
  const hasCalendarUnits = duration.years !== 0 || duration.months !== 0 || duration.weeks !== 0;
  if (hasCalendarUnits) {
    throw new TemporalKitRangeError(
      'NEEDS_REFERENCE_DATE',
      `toMySQLTime() received ${duration}, which has years, months, or weeks. Round it to hours with a relativeTo date first.`,
    );
  }
  const balanced = duration.round({ largestUnit: 'hour', smallestUnit: 'microsecond', roundingMode: 'trunc' }).abs();
  const isBeyondMaximum = balanced.hours > MYSQL_TIME_MAX_HOURS;
  const isMaximumWithFraction =
    balanced.hours === MYSQL_TIME_MAX_HOURS &&
    balanced.minutes === 59 &&
    balanced.seconds === 59 &&
    (balanced.milliseconds !== 0 || balanced.microseconds !== 0);
  if (isBeyondMaximum || isMaximumWithFraction) {
    throw new TemporalKitRangeError('INVALID_RANGE', `toMySQLTime() received ${duration}, which is outside MySQL TIME's -838:59:59 to 838:59:59.`);
  }

  const sign = duration.sign < 0 ? '-' : '';
  const wholeSeconds = `${padNumber(balanced.hours, 2)}:${padNumber(balanced.minutes, 2)}:${padNumber(balanced.seconds, 2)}`;
  const fraction = formatFraction({ millisecond: balanced.milliseconds, microsecond: balanced.microseconds }, 'auto');
  return `${sign}${wholeSeconds}${fraction}`;
}

/**
 * Returns a `typeCast` function for `mysql2` that reads `DATE`, `DATETIME`,
 * `TIMESTAMP`, and `TIME` columns as Temporal values, and passes every other
 * column to `next()`.
 *
 * @param {{ timeAs: 'PlainTime' | 'Duration', sessionTimeZone: string } & SpecialValueOptions} options
 * @returns {TypeCastFn}
 * @throws {TemporalKitConfigError} When `timeAs` or `sessionTimeZone` is missing or invalid.
 * @example
 * const pool = mysql.createPool({
 *   timezone: '+08:00',
 *   typeCast: mysql2TypeCast({ timeAs: 'Duration', sessionTimeZone: 'Asia/Manila' }),
 * });
 */
export function mysql2TypeCast(options) {
  const context = 'mysql2TypeCast()';
  getTemporal();
  if (options === undefined) {
    throw new TemporalKitConfigError("mysql2TypeCast() needs options, such as { timeAs: 'Duration', sessionTimeZone: 'Asia/Manila' }.");
  }
  const readValue = readOptions(options, context);
  if (readValue.timeAs === undefined) {
    throw new TemporalKitConfigError("mysql2TypeCast() needs timeAs: 'PlainTime' or 'Duration'; MySQL TIME can mean either.");
  }
  const timeAs = assertOneOf(readValue.timeAs, /** @type {const} */ (['PlainTime', 'Duration']), `${context} timeAs option`);
  const sessionTimeZone = assertTimeZoneId(readValue.sessionTimeZone, `${context} sessionTimeZone option:`);
  const specialValueOptions = { onSpecialValue: readSpecialValueOption({ onSpecialValue: readValue.onSpecialValue }, context) };

  /** @type {TypeCastFn} */
  const typeCast = (field, next) => {
    const fieldType = field.type;
    const isDate = fieldType === 'DATE' || fieldType === 'NEWDATE';
    const isDateTime = fieldType === 'DATETIME' || fieldType === 'DATETIME2';
    const isTimestamp = fieldType === 'TIMESTAMP' || fieldType === 'TIMESTAMP2';
    const isTime = fieldType === 'TIME' || fieldType === 'TIME2';
    const isTemporalColumn = isDate || isDateTime || isTimestamp || isTime;
    if (!isTemporalColumn) {
      return next();
    }

    const text = field.string();
    if (text === null) {
      return null;
    }
    if (isDate) {
      return fromMySQLDate(text, specialValueOptions);
    }
    if (isDateTime) {
      return fromMySQLDateTime(text, specialValueOptions);
    }
    if (isTimestamp) {
      return fromMySQLTimestamp(text, sessionTimeZone, specialValueOptions);
    }
    return fromMySQLTime(text, { as: timeAs });
  };
  return typeCast;
}

// ---------------------------------------------------------------------------
// PostgreSQL
// ---------------------------------------------------------------------------

/**
 * Reads PostgreSQL `date` text as a PlainDate.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDate | null} `null` only for `infinity` / `-infinity` with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD` (BC dates are not supported), invalid, or infinity by default.
 * @example
 * fromPgDate('2026-11-02'); // Temporal.PlainDate 2026-11-02
 */
export function fromPgDate(text, options) {
  const context = 'fromPgDate()';
  const columnFormat = 'YYYY-MM-DD';
  const input = assertText(text, context, columnFormat);
  const mode = readSpecialValueOption(options, context);
  const Temporal = getTemporal();
  if (PG_INFINITY_VALUES.includes(input)) {
    return handleSpecialValue(input, mode, context, columnFormat);
  }
  const match = PG_DATE_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }
  const fields = dateFieldsFrom(match, 1);
  return buildValue(() => Temporal.PlainDate.from(fields, { overflow: 'reject' }), input, context, columnFormat);
}

/**
 * Reads PostgreSQL `time` text as a PlainTime. `24:00:00`, which PostgreSQL
 * allows, has no PlainTime equivalent and throws.
 *
 * @param {string} text
 * @returns {Temporal.PlainTime}
 * @throws {TemporalKitParseError} When the text is not `HH:MM:SS[.ffffff]` or is not a valid time.
 * @example
 * fromPgTime('14:30:00'); // Temporal.PlainTime 14:30:00
 */
export function fromPgTime(text) {
  const context = 'fromPgTime()';
  const columnFormat = 'HH:MM:SS[.ffffff]';
  const input = assertText(text, context, columnFormat);
  const Temporal = getTemporal();
  const match = PG_TIME_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }
  const fields = timeFieldsFrom(match, 1);
  return buildValue(() => Temporal.PlainTime.from(fields, { overflow: 'reject' }), input, context, columnFormat);
}

/**
 * Reads PostgreSQL `timestamp` (without time zone) text as a PlainDateTime.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDateTime | null} `null` only for `infinity` / `-infinity` with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text does not match, is invalid, or is infinity by default.
 * @example
 * fromPgTimestamp('2026-11-02 14:30:00'); // Temporal.PlainDateTime 2026-11-02T14:30:00
 */
export function fromPgTimestamp(text, options) {
  const context = 'fromPgTimestamp()';
  const columnFormat = 'YYYY-MM-DD HH:MM:SS[.ffffff]';
  const input = assertText(text, context, columnFormat);
  const mode = readSpecialValueOption(options, context);
  const Temporal = getTemporal();
  if (PG_INFINITY_VALUES.includes(input)) {
    return handleSpecialValue(input, mode, context, columnFormat);
  }
  const match = PG_TIMESTAMP_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }
  const fields = { ...dateFieldsFrom(match, 1), ...timeFieldsFrom(match, 4) };
  return buildValue(() => Temporal.PlainDateTime.from(fields, { overflow: 'reject' }), input, context, columnFormat);
}

/**
 * Reads PostgreSQL `timestamptz` text as an Instant. Accepts offsets such as
 * `+08`, `+08:00`, `+05:30`, and historical second offsets like `+05:53:28`.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.Instant | null} `null` only for `infinity` / `-infinity` with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text does not match, is invalid, or is infinity by default.
 * @example
 * fromPgTimestamptz('2026-11-02 14:30:00+08'); // Temporal.Instant 2026-11-02T06:30:00Z
 */
export function fromPgTimestamptz(text, options) {
  const context = 'fromPgTimestamptz()';
  const columnFormat = 'YYYY-MM-DD HH:MM:SS[.ffffff]+HH[:MM[:SS]]';
  const input = assertText(text, context, columnFormat);
  const mode = readSpecialValueOption(options, context);
  const Temporal = getTemporal();
  if (PG_INFINITY_VALUES.includes(input)) {
    return handleSpecialValue(input, mode, context, columnFormat);
  }
  const match = PG_TIMESTAMPTZ_PATTERN.exec(input);
  if (match === null) {
    return throwFormatMismatch(input, context, columnFormat);
  }

  const fields = { ...dateFieldsFrom(match, 1), ...timeFieldsFrom(match, 4) };
  const dateTime = buildValue(() => Temporal.PlainDateTime.from(fields, { overflow: 'reject' }), input, context, columnFormat);

  const offsetSign = match[8];
  const offsetHours = match[9];
  const offsetMinutes = match[10] === undefined ? '00' : match[10];
  let offset = `${offsetSign}${offsetHours}:${offsetMinutes}`;
  if (match[11] !== undefined) {
    offset += `:${match[11]}`;
  }
  const isoText = `${dateTime.toString({ calendarName: 'never' })}${offset}`;
  return buildValue(() => Temporal.Instant.from(isoText), input, context, columnFormat);
}

/**
 * Formats a PlainDate as PostgreSQL `date` text.
 *
 * @param {Temporal.PlainDate} date
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDate.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001 (BC dates are not supported).
 * @example
 * toPgDate(Temporal.PlainDate.from('2026-11-02')); // '2026-11-02'
 */
export function toPgDate(date) {
  assertType(date, ['PlainDate'], 'toPgDate(date)');
  return formatDatePart(date, 1, 'toPgDate()');
}

/**
 * Formats a PlainTime as PostgreSQL `time` text, with microseconds only when nonzero.
 *
 * @param {Temporal.PlainTime} time
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainTime.
 * @example
 * toPgTime(Temporal.PlainTime.from('14:30')); // '14:30:00'
 */
export function toPgTime(time) {
  assertType(time, ['PlainTime'], 'toPgTime(time)');
  return formatTimePart(time, 'auto');
}

/**
 * Formats a PlainDateTime as PostgreSQL `timestamp` text, with microseconds only when nonzero.
 *
 * @param {Temporal.PlainDateTime} dateTime
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDateTime.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001.
 * @example
 * toPgTimestamp(Temporal.PlainDateTime.from('2026-11-02T14:30')); // '2026-11-02 14:30:00'
 */
export function toPgTimestamp(dateTime) {
  assertType(dateTime, ['PlainDateTime'], 'toPgTimestamp(dateTime)');
  const isoDateTime = dateTime.withCalendar('iso8601');
  return `${formatDatePart(isoDateTime, 1, 'toPgTimestamp()')} ${formatTimePart(isoDateTime, 'auto')}`;
}

/**
 * Formats an Instant as PostgreSQL `timestamptz` text in UTC, such as
 * `'2026-11-02 06:30:00+00:00'`.
 *
 * @param {Temporal.Instant} instant
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not an Instant.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001.
 * @example
 * toPgTimestamptz(Temporal.Instant.from('2026-11-02T06:30:00Z')); // '2026-11-02 06:30:00+00:00'
 */
export function toPgTimestamptz(instant) {
  assertType(instant, ['Instant'], 'toPgTimestamptz(instant)');
  const inUtc = instant.toZonedDateTimeISO('UTC').toPlainDateTime();
  return `${formatDatePart(inUtc, 1, 'toPgTimestamptz()')} ${formatTimePart(inUtc, 'auto')}+00:00`;
}

/**
 * Registers parsers on the `pg` driver's `types` object for `date` (1082),
 * `time` (1083), `timestamp` (1114), and `timestamptz` (1184).
 *
 * @param {PgTypes} pgTypes Usually `import pg from 'pg'; pg.types`.
 * @param {{ timeAs?: 'PlainTime' } & SpecialValueOptions} [options]
 * @returns {void}
 * @throws {TemporalKitConfigError} When pgTypes has no setTypeParser function, or options are invalid.
 * @example
 * import pg from 'pg';
 * registerPgTypeParsers(pg.types);
 */
export function registerPgTypeParsers(pgTypes, options) {
  const context = 'registerPgTypeParsers()';
  getTemporal();
  const hasSetTypeParser = pgTypes !== null && typeof pgTypes === 'object' && typeof pgTypes.setTypeParser === 'function';
  if (!hasSetTypeParser) {
    throw new TemporalKitConfigError("registerPgTypeParsers() expects the pg driver's types object, such as pg.types, with a setTypeParser() method.");
  }
  const readValue = readOptions(options, context);
  if (readValue.timeAs !== undefined) {
    assertOneOf(readValue.timeAs, /** @type {const} */ (['PlainTime']), `${context} timeAs option`);
  }
  const specialValueOptions = { onSpecialValue: readSpecialValueOption({ onSpecialValue: readValue.onSpecialValue }, context) };

  pgTypes.setTypeParser(PG_OID_DATE, (text) => fromPgDate(text, specialValueOptions));
  pgTypes.setTypeParser(PG_OID_TIME, (text) => fromPgTime(text));
  pgTypes.setTypeParser(PG_OID_TIMESTAMP, (text) => fromPgTimestamp(text, specialValueOptions));
  pgTypes.setTypeParser(PG_OID_TIMESTAMPTZ, (text) => fromPgTimestamptz(text, specialValueOptions));
}
