/**
 * The single place where orasna reads the Temporal global, plus
 * type detection helpers that work for native and polyfilled Temporal.
 */

import { TemporalKitEnvironmentError, TemporalKitTypeError } from './errors.js';

/**
 * @typedef {'PlainDate' | 'PlainTime' | 'PlainDateTime' | 'PlainYearMonth' | 'PlainMonthDay'
 *   | 'ZonedDateTime' | 'Instant' | 'Duration'} TypeName
 */

/** @type {readonly TypeName[]} */
export const ALL_TYPE_NAMES = Object.freeze([
  'PlainDate',
  'PlainTime',
  'PlainDateTime',
  'PlainYearMonth',
  'PlainMonthDay',
  'ZonedDateTime',
  'Instant',
  'Duration',
]);

const TAG_PREFIX = 'Temporal.';

/**
 * Returns `globalThis.Temporal`, read at call time.
 *
 * @returns {typeof Temporal}
 * @throws {TemporalKitEnvironmentError} When `globalThis.Temporal` is missing.
 */
export function getTemporal() {
  const temporal = /** @type {any} */ (globalThis).Temporal;
  if (temporal === undefined || temporal === null) {
    throw new TemporalKitEnvironmentError(
      'globalThis.Temporal is not available in this runtime. ' +
        "Install 'temporal-polyfill' and import 'temporal-polyfill/global' before importing orasna.",
    );
  }
  return temporal;
}

/**
 * Returns the Temporal type name of a value, such as `'PlainDate'`, or `null`
 * when the value is not a Temporal object. Uses `Symbol.toStringTag` rather
 * than `instanceof` so native and polyfilled objects are both recognized.
 *
 * @param {unknown} value
 * @returns {TypeName | null}
 */
export function typeOf(value) {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const tag = /** @type {any} */ (value)[Symbol.toStringTag];
  if (typeof tag !== 'string') {
    return null;
  }
  if (!tag.startsWith(TAG_PREFIX)) {
    return null;
  }
  const name = /** @type {TypeName} */ (tag.slice(TAG_PREFIX.length));
  if (!ALL_TYPE_NAMES.includes(name)) {
    return null;
  }
  return name;
}

/**
 * Describes a value for error messages: `Temporal.PlainDate 2026-11-02`,
 * `string "abc"`, `null`, and so on.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function describeValue(value) {
  const typeName = typeOf(value);
  if (typeName !== null) {
    return `Temporal.${typeName} ${String(value)}`;
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return `string ${JSON.stringify(value)}`;
  }
  if (typeof value === 'object') {
    const constructorName = value.constructor ? value.constructor.name : 'Object';
    return `object ${constructorName}`;
  }
  return `${typeof value} ${String(value)}`;
}

/**
 * Asserts that a value is a Temporal object of one of the allowed types and
 * returns its type name. Also ensures Temporal is available.
 *
 * @param {unknown} value
 * @param {readonly TypeName[]} allowedTypes
 * @param {string} context Function and parameter name for error messages, e.g. `'startOf(value)'`.
 * @returns {TypeName}
 * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE`.
 */
export function assertType(value, allowedTypes, context) {
  getTemporal();
  const typeName = typeOf(value);
  if (typeName === null) {
    throw new TemporalKitTypeError(
      'UNSUPPORTED_TYPE',
      `${context} expected a Temporal ${formatTypeList(allowedTypes)}, but received ${describeValue(value)}. ` +
        'Convert the value with the matching Temporal.X.from() first.',
    );
  }
  if (!allowedTypes.includes(typeName)) {
    throw new TemporalKitTypeError(
      'UNSUPPORTED_TYPE',
      `${context} does not support Temporal.${typeName}; it accepts ${formatTypeList(allowedTypes)}.`,
    );
  }
  return typeName;
}

/**
 * Asserts that every value is a Temporal object of the same allowed type and
 * returns that type name.
 *
 * @param {readonly unknown[]} values
 * @param {readonly TypeName[]} allowedTypes
 * @param {string} context Function name for error messages, e.g. `'isBefore'`.
 * @returns {TypeName}
 * @throws {TemporalKitTypeError} With code `UNSUPPORTED_TYPE` or `TYPE_MISMATCH`.
 */
export function assertSameType(values, allowedTypes, context) {
  const firstType = assertType(values[0], allowedTypes, `${context}()`);
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    const valueType = assertType(value, allowedTypes, `${context}()`);
    if (valueType !== firstType) {
      throw new TemporalKitTypeError(
        'TYPE_MISMATCH',
        `${context}() requires all arguments to be the same Temporal type, but received ` +
          `Temporal.${firstType} and Temporal.${valueType}. ` +
          'Convert one of them explicitly, for example with toPlainDate(), toPlainDateTime(), or toZonedDateTime().',
      );
    }
  }
  return firstType;
}

/**
 * @param {readonly string[]} typeNames
 * @returns {string}
 */
function formatTypeList(typeNames) {
  return typeNames.join(' | ');
}
