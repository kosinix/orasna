import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeOf, describeValue, assertType, assertSameType } from '../src/internal/temporal.js';
import {
  readOptions,
  assertOneOf,
  assertInteger,
  assertWeekday,
  assertTimeZoneId,
  parseFractionDigits,
} from '../src/internal/validate.js';
import { TemporalKitError, TemporalKitParseError, TemporalKitTypeError } from '../src/internal/errors.js';
import { assertThrowsCode, date } from './helpers.js';

test('typeOf recognizes Temporal objects by toStringTag', () => {
  assert.equal(typeOf(date('2026-11-02')), 'PlainDate');
  assert.equal(typeOf(Temporal.Duration.from('PT1H')), 'Duration');
  assert.equal(typeOf({ [Symbol.toStringTag]: 'Temporal.PlainDate' }), 'PlainDate');
  assert.equal(typeOf({ [Symbol.toStringTag]: 'Temporal.Unknown' }), null);
  assert.equal(typeOf({ [Symbol.toStringTag]: 'Other' }), null);
  assert.equal(typeOf({}), null);
  assert.equal(typeOf('2026-11-02'), null);
  assert.equal(typeOf(null), null);
});

test('describeValue covers each kind of value', () => {
  assert.equal(describeValue(date('2026-11-02')), 'Temporal.PlainDate 2026-11-02');
  assert.equal(describeValue(null), 'null');
  assert.equal(describeValue(undefined), 'undefined');
  assert.equal(describeValue('x'), 'string "x"');
  assert.equal(describeValue(new Date(0)), 'object Date');
  assert.equal(describeValue(Object.create(null)), 'object Object');
  assert.equal(describeValue(5), 'number 5');
});

test('assertType and assertSameType', () => {
  assert.equal(assertType(date('2026-11-02'), ['PlainDate'], 'f()'), 'PlainDate');
  assertThrowsCode(() => assertType('2026-11-02', ['PlainDate'], 'f()'), 'UNSUPPORTED_TYPE', TemporalKitTypeError);
  assertThrowsCode(() => assertType(date('2026-11-02'), ['Instant'], 'f()'), 'UNSUPPORTED_TYPE');
  const mixed = [date('2026-11-02'), Temporal.PlainDateTime.from('2026-11-02T00:00')];
  assertThrowsCode(() => assertSameType(mixed, ['PlainDate', 'PlainDateTime'], 'f'), 'TYPE_MISMATCH');
});

test('validation helpers', () => {
  assert.deepEqual(readOptions(undefined, 'f()'), {});
  assertThrowsCode(() => readOptions(null, 'f()'), 'INVALID_CONFIG');
  assertThrowsCode(() => readOptions('x', 'f()'), 'INVALID_CONFIG');
  assert.equal(assertOneOf('a', ['a', 'b'], 'x'), 'a');
  assertThrowsCode(() => assertOneOf('c', ['a', 'b'], 'x'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertInteger('1', 'n'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertInteger(1.5, 'n'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertWeekday(0, 'w'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertWeekday(8, 'w'), 'INVALID_CONFIG');
  assert.equal(assertWeekday(7, 'w'), 7);
  assert.equal(assertTimeZoneId('asia/manila', 'f()'), 'Asia/Manila');
  assertThrowsCode(() => assertTimeZoneId(undefined, 'f()'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertTimeZoneId(8, 'f()'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertTimeZoneId('', 'f()'), 'INVALID_CONFIG');
  assertThrowsCode(() => assertTimeZoneId('Mars/Base', 'f()'), 'INVALID_CONFIG');
  assert.deepEqual(parseFractionDigits('5'), { millisecond: 500, microsecond: 0, nanosecond: 0 });
  assert.deepEqual(parseFractionDigits('000123'), { millisecond: 0, microsecond: 123, nanosecond: 0 });
  assert.deepEqual(parseFractionDigits(undefined), { millisecond: 0, microsecond: 0, nanosecond: 0 });
});

test('errors carry code, name, and details', () => {
  const error = new TemporalKitParseError('bad', { input: 'x', pattern: 'yyyy', path: 'a.b' });
  assert.ok(error instanceof TemporalKitError);
  assert.ok(error instanceof Error);
  assert.equal(error.code, 'PARSE_FAILED');
  assert.equal(error.name, 'TemporalKitParseError');
  assert.equal(error.input, 'x');
  assert.equal(error.pattern, 'yyyy');
  assert.equal(error.path, 'a.b');
});
