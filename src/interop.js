/**
 * Conversion to and from JSON, legacy `Date`, and HTML form inputs. Nothing
 * here touches the DOM, so it also works in Node for server-rendered forms.
 *
 * Temporal objects already serialize through `toJSON()`, so only revival is
 * needed for JSON. Revival is schema-based: you list which paths hold which type.
 *
 * @module orasna/interop
 */

import {
  TemporalKitConfigError,
  TemporalKitParseError,
  TemporalKitRangeError,
  TemporalKitTypeError,
} from './internal/errors.js';
import { ALL_TYPE_NAMES, assertType, describeValue, getTemporal, typeOf } from './internal/temporal.js';
import { assertOneOf, padNumber, parseFractionDigits } from './internal/validate.js';

/**
 * @typedef {import('./internal/temporal.js').TypeName} TypeName
 * @typedef {Record<string, TypeName>} Schema Dotted paths to Temporal type names; `'*'` matches every array item.
 * @typedef {'date' | 'time' | 'datetime-local' | 'month' | 'week'} InputType
 * @typedef {Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime | Temporal.PlainYearMonth} InputValue
 */

/**
 * A compiled schema node.
 *
 * @typedef {object} SchemaNode
 * @property {TypeName | undefined} typeName Set when this path holds a Temporal value.
 * @property {Map<string, SchemaNode>} children
 */

const WILDCARD = '*';

/** @type {readonly InputType[]} */
const INPUT_TYPES = Object.freeze(['date', 'time', 'datetime-local', 'month', 'week']);

const DATE_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const DATE_TIME_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const MONTH_PATTERN = /^(\d{4,})-(\d{2})$/;
const WEEK_PATTERN = /^(\d{4,})-W(\d{2})$/;

/** @type {Readonly<Record<InputType, string>>} */
const INPUT_FORMAT_DESCRIPTIONS = Object.freeze({
  date: 'yyyy-MM-dd',
  time: 'HH:mm[:ss[.SSS]]',
  'datetime-local': "yyyy-MM-dd'T'HH:mm[:ss[.SSS]]",
  month: 'yyyy-MM',
  week: "yyyy-'W'ww",
});

/** @type {Readonly<Record<InputType, TypeName>>} */
const INPUT_VALUE_TYPES = Object.freeze({
  date: 'PlainDate',
  time: 'PlainTime',
  'datetime-local': 'PlainDateTime',
  month: 'PlainYearMonth',
  week: 'PlainDate',
});

// ---------------------------------------------------------------------------
// JSON revival
// ---------------------------------------------------------------------------

/**
 * Returns a reviver for `JSON.parse` that turns the strings at the schema's
 * paths into Temporal values. Unlisted keys are left alone; `null` and
 * missing values are kept as they are.
 *
 * @param {Schema} schema
 * @returns {(this: unknown, key: string, value: unknown) => unknown}
 * @throws {TemporalKitConfigError} When the schema is invalid.
 * @example
 * const body = JSON.parse(text, createReviver({ createdAt: 'Instant', 'logs.*.timeIn': 'PlainTime' }));
 */
export function createReviver(schema) {
  getTemporal();
  const root = compileSchema(schema);

  /**
   * @this {unknown}
   * @param {string} key
   * @param {unknown} value
   * @returns {unknown}
   */
  function reviver(key, value) {
    // JSON.parse calls the reviver last for the root, with key '' on a holder
    // object whose only key is ''. Everything is revived from the root down.
    const isRootCall = key === '' && isRootHolder(this);
    if (!isRootCall) {
      return value;
    }
    return reviveNode(value, root, []);
  }
  return reviver;
}

/**
 * Returns a copy of an already-parsed object (such as `req.body` or the result
 * of `response.json()`) with the strings at the schema's paths turned into
 * Temporal values. The input is not mutated; untouched branches are shared.
 *
 * @template O
 * @param {O} object
 * @param {Schema} schema
 * @returns {O}
 * @throws {TemporalKitConfigError} When the schema is invalid.
 * @throws {TemporalKitParseError} When a listed value is not a valid string for its type; `path` names it.
 * @example
 * const body = reviveFields(req.body, { 'leave.start': 'PlainDate', 'leave.end': 'PlainDate' });
 */
export function reviveFields(object, schema) {
  getTemporal();
  const root = compileSchema(schema);
  return /** @type {O} */ (reviveNode(object, root, []));
}

/**
 * @param {unknown} holder
 * @returns {boolean}
 */
function isRootHolder(holder) {
  if (holder === null || typeof holder !== 'object') {
    return false;
  }
  const keys = Object.keys(holder);
  return keys.length === 1 && keys[0] === '';
}

/**
 * @param {unknown} schema
 * @returns {SchemaNode}
 */
function compileSchema(schema) {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new TemporalKitConfigError("Schema must be an object of dotted paths to type names, such as { 'leave.start': 'PlainDate' }.");
  }

  /** @type {SchemaNode} */
  const root = { typeName: undefined, children: new Map() };
  for (const [path, typeName] of Object.entries(schema)) {
    const validType = assertOneOf(typeName, ALL_TYPE_NAMES, `Schema path ${JSON.stringify(path)} type`);
    const segments = path.split('.');
    const hasEmptySegment = segments.some((segment) => segment === '');
    if (hasEmptySegment) {
      throw new TemporalKitConfigError(`Schema path ${JSON.stringify(path)} has an empty segment; use paths like 'leave.start'.`);
    }

    let node = root;
    for (const segment of segments) {
      if (node.typeName !== undefined) {
        throw new TemporalKitConfigError(`Schema path ${JSON.stringify(path)} goes inside another path that is already a Temporal value.`);
      }
      let child = node.children.get(segment);
      if (child === undefined) {
        child = { typeName: undefined, children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    }
    if (node.children.size > 0) {
      throw new TemporalKitConfigError(`Schema path ${JSON.stringify(path)} is a Temporal value but other paths go inside it.`);
    }
    node.typeName = validType;
  }
  return root;
}

/**
 * @param {unknown} value
 * @param {SchemaNode} node
 * @param {string[]} path
 * @returns {unknown}
 */
function reviveNode(value, node, path) {
  if (node.typeName !== undefined) {
    return reviveLeaf(value, node.typeName, path);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return reviveArray(value, node, path);
  }
  return reviveObject(/** @type {Record<string, unknown>} */ (value), node, path);
}

/**
 * @param {unknown[]} array
 * @param {SchemaNode} node
 * @param {string[]} path
 * @returns {unknown[]}
 */
function reviveArray(array, node, path) {
  const wildcardNode = node.children.get(WILDCARD);
  return array.map((item, index) => {
    const indexKey = String(index);
    const indexNode = node.children.get(indexKey);
    if (indexNode !== undefined) {
      return reviveNode(item, indexNode, [...path, indexKey]);
    }
    if (wildcardNode !== undefined) {
      return reviveNode(item, wildcardNode, [...path, indexKey]);
    }
    return item;
  });
}

/**
 * @param {Record<string, unknown>} object
 * @param {SchemaNode} node
 * @param {string[]} path
 * @returns {Record<string, unknown>}
 */
function reviveObject(object, node, path) {
  const copy = { ...object };
  for (const [key, child] of node.children) {
    if (!Object.hasOwn(object, key)) {
      continue;
    }
    const revived = reviveNode(object[key], child, [...path, key]);
    // defineProperty, not assignment, so a key such as '__proto__' stays a plain property.
    Object.defineProperty(copy, key, { value: revived, enumerable: true, writable: true, configurable: true });
  }
  return copy;
}

/**
 * @param {unknown} value
 * @param {TypeName} typeName
 * @param {string[]} path
 * @returns {unknown}
 */
function reviveLeaf(value, typeName, path) {
  const Temporal = getTemporal();
  const pathText = path.join('.');
  if (value === null || value === undefined) {
    return value;
  }
  if (typeOf(value) === typeName) {
    return value;
  }
  if (typeof value !== 'string') {
    throw new TemporalKitParseError(
      `Value at ${JSON.stringify(pathText)} should be an ISO string for Temporal.${typeName}, but is ${describeValue(value)}.`,
      { input: value, path: pathText },
    );
  }
  try {
    const fromFunction = /** @type {any} */ (Temporal)[typeName].from;
    return fromFunction(value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TemporalKitParseError(
      `Value at ${JSON.stringify(pathText)} is not a valid Temporal.${typeName}: ${JSON.stringify(value)}. ${reason}`,
      { input: value, path: pathText },
    );
  }
}

// ---------------------------------------------------------------------------
// Legacy Date
// ---------------------------------------------------------------------------

/**
 * Converts a legacy `Date` to a `Temporal.Instant`.
 *
 * @param {Date} date
 * @returns {Temporal.Instant}
 * @throws {TemporalKitTypeError} When the value is not a Date.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for an Invalid Date.
 * @example
 * fromLegacyDate(new Date('2026-11-02T06:30:00Z')); // Temporal.Instant 2026-11-02T06:30:00Z
 */
export function fromLegacyDate(date) {
  const Temporal = getTemporal();
  const isDate = Object.prototype.toString.call(date) === '[object Date]';
  if (!isDate) {
    throw new TemporalKitTypeError('UNSUPPORTED_TYPE', `fromLegacyDate() expects a Date, but received ${describeValue(date)}.`);
  }
  const epochMilliseconds = date.getTime();
  if (Number.isNaN(epochMilliseconds)) {
    throw new TemporalKitRangeError('INVALID_RANGE', 'fromLegacyDate() received an Invalid Date. Check how the Date was created.');
  }
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds);
}

/**
 * Converts an Instant or ZonedDateTime to a legacy `Date`. Precision below
 * milliseconds is dropped.
 *
 * @param {Temporal.Instant | Temporal.ZonedDateTime} value
 * @returns {Date}
 * @throws {TemporalKitTypeError} For other types; a PlainDateTime needs `toZonedDateTime(timeZone)` first.
 * @example
 * toLegacyDate(Temporal.Instant.from('2026-11-02T06:30:00Z')); // Date 2026-11-02T06:30:00.000Z
 */
export function toLegacyDate(value) {
  getTemporal();
  if (typeOf(value) === 'PlainDateTime') {
    throw new TemporalKitTypeError(
      'UNSUPPORTED_TYPE',
      'toLegacyDate() cannot convert a PlainDateTime because it has no time zone. ' +
        "Call toZonedDateTime(timeZone) first, for example value.toZonedDateTime('Asia/Manila').",
    );
  }
  assertType(value, ['Instant', 'ZonedDateTime'], 'toLegacyDate(value)');
  return new Date(value.epochMilliseconds);
}

// ---------------------------------------------------------------------------
// HTML inputs
// ---------------------------------------------------------------------------

/**
 * Reads the value of an HTML `<input>` of type date, time, datetime-local,
 * month, or week. An empty value returns `null`. Pass either the value string
 * and its input type, or an object with `type` and `value` (such as the input
 * element itself).
 *
 * @param {string | { type: string, value: string }} source
 * @param {InputType} [type] Required when `source` is a string; optional when `source` has a `type`.
 * @returns {InputValue | null}
 * @throws {TemporalKitConfigError} When the input type is missing, unknown, or conflicts with `source.type`.
 * @throws {TemporalKitParseError} When the value does not match the input type's format or is not a real date.
 * @example
 * fromInputValue('2026-W45', 'week'); // Temporal.PlainDate 2026-11-02
 * fromInputValue(form.elements.startDate); // reads type and value from the element
 */
export function fromInputValue(source, type) {
  getTemporal();
  const { value, inputType } = readInputSource(source, type);
  if (value === '') {
    return null;
  }
  if (inputType === undefined) {
    throw new TemporalKitConfigError(
      "fromInputValue() needs the input type, such as fromInputValue(text, 'date'), when the source has no type.",
    );
  }
  const validType = assertOneOf(inputType, INPUT_TYPES, 'fromInputValue() type');

  if (validType === 'date') {
    return parseDateInput(value);
  }
  if (validType === 'time') {
    return parseTimeInput(value);
  }
  if (validType === 'datetime-local') {
    return parseDateTimeInput(value);
  }
  if (validType === 'month') {
    return parseMonthInput(value);
  }
  return parseWeekInput(value);
}

/**
 * Formats a Temporal value as the `value` of an HTML `<input>`. Times omit
 * seconds when they are zero, and include milliseconds only when nonzero.
 *
 * @param {InputValue} value
 * @param {InputType} type
 * @returns {string}
 * @throws {TemporalKitConfigError} When the input type is unknown.
 * @throws {TemporalKitTypeError} When the value's type does not match the input type.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001, which inputs cannot show.
 * @example
 * toInputValue(Temporal.PlainDate.from('2026-11-02'), 'week'); // '2026-W45'
 */
export function toInputValue(value, type) {
  getTemporal();
  const validType = assertOneOf(type, INPUT_TYPES, 'toInputValue() type');
  const expectedType = INPUT_VALUE_TYPES[validType];
  assertType(value, [expectedType], `toInputValue(value, '${validType}')`);

  if (validType === 'date') {
    return formatDateInput(/** @type {Temporal.PlainDate} */ (value));
  }
  if (validType === 'time') {
    return formatTimeInput(/** @type {Temporal.PlainTime} */ (value));
  }
  if (validType === 'datetime-local') {
    const dateTime = /** @type {Temporal.PlainDateTime} */ (value).withCalendar('iso8601');
    return `${formatDateInput(dateTime.toPlainDate())}T${formatTimeInput(dateTime.toPlainTime())}`;
  }
  if (validType === 'month') {
    const yearMonth = /** @type {Temporal.PlainYearMonth} */ (value);
    return `${formatInputYear(yearMonth.year)}-${padNumber(yearMonth.month, 2)}`;
  }
  const date = /** @type {Temporal.PlainDate} */ (value).withCalendar('iso8601');
  const weekYear = /** @type {number} */ (date.yearOfWeek);
  const week = /** @type {number} */ (date.weekOfYear);
  return `${formatInputYear(weekYear)}-W${padNumber(week, 2)}`;
}

/**
 * @param {unknown} source
 * @param {unknown} type
 * @returns {{ value: string, inputType: unknown }}
 */
function readInputSource(source, type) {
  if (typeof source === 'string') {
    return { value: source, inputType: type };
  }
  const isObject = source !== null && typeof source === 'object';
  if (!isObject) {
    throw new TemporalKitConfigError(`fromInputValue() expects a string or an object with type and value, but received ${describeValue(source)}.`);
  }
  const sourceObject = /** @type {{ type?: unknown, value?: unknown }} */ (source);
  if (typeof sourceObject.value !== 'string') {
    throw new TemporalKitConfigError('fromInputValue() source object must have a string value property, like an <input> element.');
  }
  const sourceType = sourceObject.type;
  if (type !== undefined && sourceType !== undefined && type !== sourceType) {
    throw new TemporalKitConfigError(
      `fromInputValue() received type ${JSON.stringify(type)}, but the source says ${JSON.stringify(sourceType)}. Pass only one, or make them match.`,
    );
  }
  const inputType = type === undefined ? sourceType : type;
  return { value: sourceObject.value, inputType };
}

/**
 * @param {string} value
 * @param {InputType} inputType
 * @returns {never}
 */
function throwInputMismatch(value, inputType) {
  const expectedFormat = INPUT_FORMAT_DESCRIPTIONS[inputType];
  throw new TemporalKitParseError(
    `fromInputValue() expected a '${inputType}' input value like ${expectedFormat}, but received ${JSON.stringify(value)}.`,
    { input: value, pattern: expectedFormat },
  );
}

/**
 * @template R
 * @param {() => R} build
 * @param {string} value
 * @param {InputType} inputType
 * @returns {R}
 */
function buildInputValue(build, value, inputType) {
  try {
    return build();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TemporalKitParseError(`fromInputValue() read ${JSON.stringify(value)} as '${inputType}', but it is not valid: ${reason}`, {
      input: value,
      pattern: INPUT_FORMAT_DESCRIPTIONS[inputType],
    });
  }
}

/**
 * @param {string} value
 * @returns {Temporal.PlainDate}
 */
function parseDateInput(value) {
  const Temporal = getTemporal();
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return throwInputMismatch(value, 'date');
  }
  const fields = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return buildInputValue(() => Temporal.PlainDate.from(fields, { overflow: 'reject' }), value, 'date');
}

/**
 * @param {string} value
 * @returns {Temporal.PlainTime}
 */
function parseTimeInput(value) {
  const Temporal = getTemporal();
  const match = TIME_PATTERN.exec(value);
  if (match === null) {
    return throwInputMismatch(value, 'time');
  }
  const fields = timeFieldsFromMatch(match[1], match[2], match[3], match[4]);
  return buildInputValue(() => Temporal.PlainTime.from(fields, { overflow: 'reject' }), value, 'time');
}

/**
 * @param {string} value
 * @returns {Temporal.PlainDateTime}
 */
function parseDateTimeInput(value) {
  const Temporal = getTemporal();
  const match = DATE_TIME_PATTERN.exec(value);
  if (match === null) {
    return throwInputMismatch(value, 'datetime-local');
  }
  const fields = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    ...timeFieldsFromMatch(match[4], match[5], match[6], match[7]),
  };
  return buildInputValue(() => Temporal.PlainDateTime.from(fields, { overflow: 'reject' }), value, 'datetime-local');
}

/**
 * @param {string} value
 * @returns {Temporal.PlainYearMonth}
 */
function parseMonthInput(value) {
  const Temporal = getTemporal();
  const match = MONTH_PATTERN.exec(value);
  if (match === null) {
    return throwInputMismatch(value, 'month');
  }
  const fields = { year: Number(match[1]), month: Number(match[2]) };
  return buildInputValue(() => Temporal.PlainYearMonth.from(fields, { overflow: 'reject' }), value, 'month');
}

/**
 * Returns the Monday of an ISO week such as `2026-W45`.
 *
 * @param {string} value
 * @returns {Temporal.PlainDate}
 */
function parseWeekInput(value) {
  const Temporal = getTemporal();
  const match = WEEK_PATTERN.exec(value);
  if (match === null) {
    return throwInputMismatch(value, 'week');
  }
  const weekYear = Number(match[1]);
  const week = Number(match[2]);

  // ISO week 1 is the week that contains January 4.
  const januaryFourth = Temporal.PlainDate.from({ year: weekYear, month: 1, day: 4 });
  const mondayOfWeekOne = januaryFourth.subtract({ days: januaryFourth.dayOfWeek - 1 });
  const monday = mondayOfWeekOne.add({ weeks: week - 1 });

  const isValidWeek = week >= 1 && monday.yearOfWeek === weekYear;
  if (!isValidWeek) {
    throw new TemporalKitParseError(`fromInputValue() read week ${week} of ${weekYear}, but that ISO week does not exist.`, {
      input: value,
      pattern: INPUT_FORMAT_DESCRIPTIONS.week,
    });
  }
  return monday;
}

/**
 * @param {string} hour
 * @param {string} minute
 * @param {string | undefined} second
 * @param {string | undefined} fraction
 * @returns {{ hour: number, minute: number, second: number, millisecond: number }}
 */
function timeFieldsFromMatch(hour, minute, second, fraction) {
  const subSecond = parseFractionDigits(fraction);
  return {
    hour: Number(hour),
    minute: Number(minute),
    second: second === undefined ? 0 : Number(second),
    millisecond: subSecond.millisecond,
  };
}

/**
 * @param {number} year
 * @returns {string}
 */
function formatInputYear(year) {
  if (year < 1) {
    throw new TemporalKitRangeError('INVALID_RANGE', `toInputValue() cannot show year ${year}; HTML inputs only accept years from 0001.`);
  }
  return padNumber(year, 4);
}

/**
 * @param {Temporal.PlainDate} date
 * @returns {string}
 */
function formatDateInput(date) {
  const isoDate = date.withCalendar('iso8601');
  return `${formatInputYear(isoDate.year)}-${padNumber(isoDate.month, 2)}-${padNumber(isoDate.day, 2)}`;
}

/**
 * @param {Temporal.PlainTime} time
 * @returns {string}
 */
function formatTimeInput(time) {
  const hoursAndMinutes = `${padNumber(time.hour, 2)}:${padNumber(time.minute, 2)}`;
  const hasSeconds = time.second !== 0;
  const hasMilliseconds = time.millisecond !== 0;
  if (hasMilliseconds) {
    return `${hoursAndMinutes}:${padNumber(time.second, 2)}.${padNumber(time.millisecond, 3)}`;
  }
  if (hasSeconds) {
    return `${hoursAndMinutes}:${padNumber(time.second, 2)}`;
  }
  return hoursAndMinutes;
}
