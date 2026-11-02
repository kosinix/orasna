import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fromMySQLDate,
  toMySQLDate,
  fromMySQLDateTime,
  toMySQLDateTime,
  fromMySQLTimestamp,
  toMySQLTimestamp,
  fromMySQLTime,
  toMySQLTime,
  fromPgDate,
  fromPgTime,
  fromPgTimestamp,
  fromPgTimestamptz,
  toPgDate,
  toPgTime,
  toPgTimestamp,
  toPgTimestamptz,
  mysql2TypeCast,
  registerPgTypeParsers,
} from '../src/db.js';
import { typeOf } from '../src/internal/temporal.js';
import { assertThrowsCode, date, time, dateTime, instant, duration } from './helpers.js';

test("acceptance: fromMySQLTime('838:59:59', { as: 'Duration' }) is PT838H59M59S", () => {
  assert.equal(fromMySQLTime('838:59:59', { as: 'Duration' }).toString(), 'PT838H59M59S');
});

test("acceptance: fromMySQLTime('838:59:59', { as: 'PlainTime' }) throws PARSE_FAILED", () => {
  assertThrowsCode(() => fromMySQLTime('838:59:59', { as: 'PlainTime' }), 'PARSE_FAILED');
});

test("acceptance: fromMySQLTimestamp('2026-11-02 14:30:00', 'Asia/Manila')", () => {
  assert.equal(fromMySQLTimestamp('2026-11-02 14:30:00', 'Asia/Manila').toString(), '2026-11-02T06:30:00Z');
});

test("acceptance: fromPgTimestamptz('2026-11-02 14:30:00+08')", () => {
  assert.equal(fromPgTimestamptz('2026-11-02 14:30:00+08').toString(), '2026-11-02T06:30:00Z');
});

test('MySQL DATE', () => {
  assert.equal(fromMySQLDate('2026-11-02').toString(), '2026-11-02');
  assert.equal(toMySQLDate(date('2026-11-02')), '2026-11-02');
  assertThrowsCode(() => fromMySQLDate('0000-00-00'), 'PARSE_FAILED');
  assert.equal(fromMySQLDate('0000-00-00', { onSpecialValue: 'null' }), null);
  assert.equal(fromMySQLDate('2026-11-00', { onSpecialValue: 'null' }), null);
  assertThrowsCode(() => fromMySQLDate('2026-02-30'), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLDate('2026/11/02'), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLDate(null), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLDate('2026-11-02', { onSpecialValue: 'zero' }), 'INVALID_CONFIG');
  assertThrowsCode(() => toMySQLDate('2026-11-02'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => toMySQLDate(date('-000001-01-01')), 'INVALID_RANGE');
});

test('MySQL DATETIME', () => {
  assert.equal(fromMySQLDateTime('2026-11-02 14:30:00').toString(), '2026-11-02T14:30:00');
  assert.equal(fromMySQLDateTime('2026-11-02 14:30:00.123456').toString(), '2026-11-02T14:30:00.123456');
  assert.equal(fromMySQLDateTime('0000-00-00 00:00:00', { onSpecialValue: 'null' }), null);
  assertThrowsCode(() => fromMySQLDateTime('0000-00-00 00:00:00'), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLDateTime('2026-11-02 24:00:00'), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLDateTime('2026-11-02 14:30'), 'PARSE_FAILED');

  const value = dateTime('2026-11-02T14:30:05.123456789');
  assert.equal(toMySQLDateTime(value), '2026-11-02 14:30:05');
  assert.equal(toMySQLDateTime(value, { fractionalDigits: 3 }), '2026-11-02 14:30:05.123');
  assert.equal(toMySQLDateTime(value, { fractionalDigits: 6 }), '2026-11-02 14:30:05.123456');
  assertThrowsCode(() => toMySQLDateTime(value, { fractionalDigits: 7 }), 'INVALID_CONFIG');
  assertThrowsCode(() => toMySQLDateTime(value, { fractionalDigits: -1 }), 'INVALID_CONFIG');
  assertThrowsCode(() => toMySQLDateTime(date('2026-11-02')), 'UNSUPPORTED_TYPE');
});

test('MySQL TIMESTAMP', () => {
  assert.equal(fromMySQLTimestamp('0000-00-00 00:00:00', 'UTC', { onSpecialValue: 'null' }), null);
  assertThrowsCode(() => fromMySQLTimestamp('2026-11-02 14:30:00'), 'INVALID_CONFIG');
  assertThrowsCode(() => fromMySQLTimestamp('2026-11-02 14:30:00', 'Nowhere'), 'INVALID_CONFIG');
  assert.equal(toMySQLTimestamp(instant('2026-11-02T06:30:00Z'), 'Asia/Manila'), '2026-11-02 14:30:00');
  assert.equal(
    toMySQLTimestamp(instant('2026-11-02T06:30:00.5Z'), 'UTC', { fractionalDigits: 2 }),
    '2026-11-02 06:30:00.50',
  );
  assertThrowsCode(() => toMySQLTimestamp(instant('2026-11-02T06:30:00Z')), 'INVALID_CONFIG');
  assertThrowsCode(() => toMySQLTimestamp(dateTime('2026-11-02T06:30'), 'UTC'), 'UNSUPPORTED_TYPE');
});

test('MySQL TIME', () => {
  assert.equal(fromMySQLTime('14:30:00', { as: 'PlainTime' }).toString(), '14:30:00');
  assert.equal(fromMySQLTime('-838:59:59', { as: 'Duration' }).toString(), '-PT838H59M59S');
  assert.equal(fromMySQLTime('-00:15:00', { as: 'Duration' }).toString(), '-PT15M');
  assert.equal(fromMySQLTime('27:05:00.5', { as: 'Duration' }).toString(), 'PT27H5M0.5S');
  assertThrowsCode(() => fromMySQLTime('839:00:00', { as: 'Duration' }), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLTime('10:60:00', { as: 'Duration' }), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLTime('-01:00:00', { as: 'PlainTime' }), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLTime('1:00', { as: 'PlainTime' }), 'PARSE_FAILED');
  assertThrowsCode(() => fromMySQLTime('14:30:00'), 'INVALID_CONFIG');
  assertThrowsCode(() => fromMySQLTime('14:30:00', { as: 'Instant' }), 'INVALID_CONFIG');

  assert.equal(toMySQLTime(time('14:30')), '14:30:00');
  assert.equal(toMySQLTime(time('14:30:00.000250')), '14:30:00.00025');
  assert.equal(toMySQLTime(duration('PT27H5M')), '27:05:00');
  assert.equal(toMySQLTime(duration('-PT15M')), '-00:15:00');
  assert.equal(toMySQLTime(duration('P1DT1.5S')), '24:00:01.5');
  assert.equal(toMySQLTime(duration('PT838H59M59S')), '838:59:59');
  assertThrowsCode(() => toMySQLTime(duration('PT839H')), 'INVALID_RANGE');
  assertThrowsCode(() => toMySQLTime(duration('PT838H59M59.5S')), 'INVALID_RANGE');
  assertThrowsCode(() => toMySQLTime(duration('P1M')), 'NEEDS_REFERENCE_DATE');
  assertThrowsCode(() => toMySQLTime(dateTime('2026-11-02T14:30')), 'UNSUPPORTED_TYPE');
});

test('PostgreSQL date and time', () => {
  assert.equal(fromPgDate('2026-11-02').toString(), '2026-11-02');
  assert.equal(fromPgDate('10000-01-01').toString(), '+010000-01-01');
  assert.equal(fromPgDate('infinity', { onSpecialValue: 'null' }), null);
  assertThrowsCode(() => fromPgDate('-infinity'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgDate('0044-03-15 BC'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgDate('2026-02-30'), 'PARSE_FAILED');
  assert.equal(toPgDate(date('2026-11-02')), '2026-11-02');
  assertThrowsCode(() => toPgDate(date('0000-01-01')), 'INVALID_RANGE');
  assertThrowsCode(() => toPgDate(time('10:00')), 'UNSUPPORTED_TYPE');

  assert.equal(fromPgTime('14:30:00.123456').toString(), '14:30:00.123456');
  assertThrowsCode(() => fromPgTime('24:00:00'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgTime('14:30'), 'PARSE_FAILED');
  assert.equal(toPgTime(time('14:30:00.5')), '14:30:00.5');
  assertThrowsCode(() => toPgTime(date('2026-11-02')), 'UNSUPPORTED_TYPE');
});

test('PostgreSQL timestamp and timestamptz', () => {
  assert.equal(fromPgTimestamp('2026-11-02 14:30:00').toString(), '2026-11-02T14:30:00');
  assert.equal(fromPgTimestamp('infinity', { onSpecialValue: 'null' }), null);
  assertThrowsCode(() => fromPgTimestamp('infinity'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgTimestamp('2026-11-02'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgTimestamp('2026-11-31 00:00:00'), 'PARSE_FAILED');
  assert.equal(toPgTimestamp(dateTime('2026-11-02T14:30')), '2026-11-02 14:30:00');

  assert.equal(fromPgTimestamptz('2026-11-02 14:30:00+08:00').toString(), '2026-11-02T06:30:00Z');
  assert.equal(fromPgTimestamptz('2026-11-02 12:00:00.25+05:30').toString(), '2026-11-02T06:30:00.25Z');
  assert.equal(fromPgTimestamptz('1900-01-01 00:00:00+05:53:28').toString(), '1899-12-31T18:06:32Z');
  assert.equal(fromPgTimestamptz('2026-11-02 06:30:00-00').toString(), '2026-11-02T06:30:00Z');
  assert.equal(fromPgTimestamptz('-infinity', { onSpecialValue: 'null' }), null);
  assertThrowsCode(() => fromPgTimestamptz('infinity'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgTimestamptz('2026-11-02 14:30:00'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgTimestamptz('2026-11-02 25:30:00+08'), 'PARSE_FAILED');
  assertThrowsCode(() => fromPgTimestamptz('2026-11-02 14:30:00+25'), 'PARSE_FAILED');
  assert.equal(toPgTimestamptz(instant('2026-11-02T06:30:00.123Z')), '2026-11-02 06:30:00.123+00:00');
  assertThrowsCode(() => toPgTimestamptz(dateTime('2026-11-02T06:30')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => toPgTimestamp(instant('2026-11-02T06:30:00Z')), 'UNSUPPORTED_TYPE');
});

test('mysql2TypeCast converts temporal columns and falls through for others', () => {
  const typeCast = mysql2TypeCast({ timeAs: 'Duration', sessionTimeZone: 'Asia/Manila' });
  const field = (type, text) => ({ type, string: () => text });
  const next = () => 'next';
  assert.equal(typeOf(typeCast(field('DATE', '2026-11-02'), next)), 'PlainDate');
  assert.equal(typeOf(typeCast(field('DATETIME', '2026-11-02 14:30:00'), next)), 'PlainDateTime');
  assert.equal(typeCast(field('TIMESTAMP', '2026-11-02 14:30:00'), next).toString(), '2026-11-02T06:30:00Z');
  assert.equal(typeCast(field('TIME', '27:05:00'), next).toString(), 'PT27H5M');
  assert.equal(typeCast(field('DATE', null), next), null);
  assert.equal(typeCast(field('VARCHAR', 'x'), next), 'next');
  assertThrowsCode(() => typeCast(field('DATE', '0000-00-00'), next), 'PARSE_FAILED');

  const lenient = mysql2TypeCast({ timeAs: 'PlainTime', sessionTimeZone: 'UTC', onSpecialValue: 'null' });
  assert.equal(lenient(field('DATE', '0000-00-00'), next), null);
  assert.equal(typeOf(lenient(field('TIME', '14:30:00'), next)), 'PlainTime');
});

test('mysql2TypeCast option errors', () => {
  assertThrowsCode(() => mysql2TypeCast(), 'INVALID_CONFIG');
  assertThrowsCode(() => mysql2TypeCast({ sessionTimeZone: 'UTC' }), 'INVALID_CONFIG');
  assertThrowsCode(() => mysql2TypeCast({ timeAs: 'String', sessionTimeZone: 'UTC' }), 'INVALID_CONFIG');
  assertThrowsCode(() => mysql2TypeCast({ timeAs: 'Duration' }), 'INVALID_CONFIG');
  assertThrowsCode(() => mysql2TypeCast({ timeAs: 'Duration', sessionTimeZone: 'UTC', onSpecialValue: 'x' }), 'INVALID_CONFIG');
});

test('registerPgTypeParsers registers the four OIDs', () => {
  const parsers = new Map();
  const pgTypes = { setTypeParser: (oid, parser) => parsers.set(oid, parser) };
  registerPgTypeParsers(pgTypes);
  assert.deepEqual([...parsers.keys()].sort(), [1082, 1083, 1114, 1184]);
  assert.equal(typeOf(parsers.get(1082)('2026-11-02')), 'PlainDate');
  assert.equal(typeOf(parsers.get(1083)('14:30:00')), 'PlainTime');
  assert.equal(typeOf(parsers.get(1114)('2026-11-02 14:30:00')), 'PlainDateTime');
  assert.equal(parsers.get(1184)('2026-11-02 14:30:00+08').toString(), '2026-11-02T06:30:00Z');
  assertThrowsCode(() => parsers.get(1082)('infinity'), 'PARSE_FAILED');

  registerPgTypeParsers(pgTypes, { timeAs: 'PlainTime', onSpecialValue: 'null' });
  assert.equal(parsers.get(1082)('infinity'), null);
  assert.equal(parsers.get(1184)('infinity'), null);
  assert.equal(parsers.get(1114)('-infinity'), null);
});

test('registerPgTypeParsers errors', () => {
  assertThrowsCode(() => registerPgTypeParsers({}), 'INVALID_CONFIG');
  assertThrowsCode(() => registerPgTypeParsers(null), 'INVALID_CONFIG');
  const pgTypes = { setTypeParser: () => {} };
  assertThrowsCode(() => registerPgTypeParsers(pgTypes, { timeAs: 'Duration' }), 'INVALID_CONFIG');
});
