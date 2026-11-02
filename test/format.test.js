import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format, parse, compilePattern } from '../src/format.js';
import { assertThrowsCode, date, time, dateTime, zoned, instant } from './helpers.js';

test("acceptance: format(2026-11-02T14:05, 'yyyy-MM-dd hh:mm a')", () => {
  assert.equal(format(dateTime('2026-11-02T14:05'), 'yyyy-MM-dd hh:mm a'), '2026-11-02 02:05 PM');
});

test("acceptance: parse('2026-02-30', 'yyyy-MM-dd', 'PlainDate') throws PARSE_FAILED", () => {
  assertThrowsCode(() => parse('2026-02-30', 'yyyy-MM-dd', 'PlainDate'), 'PARSE_FAILED');
});

test('format every token', () => {
  const value = zoned('2026-03-05T09:07:04.042+08:00[Asia/Manila]');
  assert.equal(format(value, 'yyyy yy M MM MMM MMMM d dd'), '2026 26 3 03 Mar March 5 05');
  assert.equal(format(value, 'EEE EEEE H HH h hh a'), 'Thu Thursday 9 09 9 09 AM');
  assert.equal(format(value, 'm mm s ss SSS XXX VV'), '7 07 4 04 042 +08:00 Asia/Manila');
  assert.equal(format(time('00:30'), 'h:mm a'), '12:30 AM');
  assert.equal(format(time('12:30'), 'h:mm a'), '12:30 PM');
});

test('format literals and quotes', () => {
  const value = dateTime('2026-11-02T14:05');
  assert.equal(format(value, "yyyy-MM-dd'T'HH:mm"), '2026-11-02T14:05');
  assert.equal(format(value, "HH 'o''clock'"), "14 o'clock");
  assert.equal(format(value, "''yy"), "'26");
  assert.equal(format(value, 'yyyyMMdd_HHmm'), '20261102_1405');
});

test('format each supported type', () => {
  assert.equal(format(date('2026-11-02'), 'dd/MM/yyyy'), '02/11/2026');
  assert.equal(format(Temporal.PlainYearMonth.from('2026-11'), 'MMMM yyyy'), 'November 2026');
  assert.equal(format(Temporal.PlainMonthDay.from('02-29'), 'MMM d'), 'Feb 29');
  assert.equal(format(instant('2026-11-02T06:30:00Z'), 'yyyy-MM-dd HH:mm XXX'), '2026-11-02 06:30 +00:00');
  assert.equal(format(date('-000005-01-01'), 'yyyy'), '-0005');
});

test('format with a locale; digits stay ASCII', () => {
  assert.equal(format(date('2026-11-02'), 'EEEE d MMMM yyyy', { locale: 'fr-FR' }), 'lundi 2 novembre 2026');
  assert.equal(format(date('2026-11-02'), 'dd/MM/yyyy', { locale: 'ar-EG' }), '02/11/2026');
});

test('format errors', () => {
  assertThrowsCode(() => format(date('2026-11-02'), 'HH'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => format(dateTime('2026-11-02T10:00'), 'XXX'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => format(instant('2026-11-02T10:00Z'), 'VV'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => format('2026-11-02', 'yyyy'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => format(date('2026-11-02'), 'YYYY-MM-DD'), 'INVALID_CONFIG');
  assertThrowsCode(() => format(date('2026-11-02'), "yyyy 'unterminated"), 'INVALID_CONFIG');
  assertThrowsCode(() => format(date('2026-11-02'), 42), 'INVALID_CONFIG');
  assertThrowsCode(() => format(date('2026-11-02'), 'yyyy', { locale: 'not a locale!' }), 'INVALID_CONFIG');
  assertThrowsCode(() => format(date('2026-11-02'), 'yyyy', { locale: 5 }), 'INVALID_CONFIG');
});

test('compilePattern is reusable and frozen', () => {
  const compiled = compilePattern('dd.MM.yyyy');
  assert.ok(Object.isFrozen(compiled));
  assert.equal(compiled.pattern, 'dd.MM.yyyy');
  assert.equal(compiled.format(date('2026-11-02')), '02.11.2026');
  assert.equal(compiled.parse('02.11.2026', 'PlainDate').toString(), '2026-11-02');
  assert.equal(format(date('2026-11-02'), compiled), '02.11.2026');
  assert.equal(parse('02.11.2026', compiled, 'PlainDate').toString(), '2026-11-02');
  assertThrowsCode(() => compilePattern(null), 'INVALID_CONFIG');
  const CompiledPattern = compiled.constructor;
  assertThrowsCode(() => new CompiledPattern(Symbol('x'), 'yyyy', []), 'INVALID_CONFIG');
});

test('pattern cache evicts beyond 100 patterns without breaking results', () => {
  for (let index = 0; index < 120; index += 1) {
    assert.equal(format(date('2026-11-02'), `yyyy'-${index}'`), `2026-${index}`);
  }
  assert.equal(format(date('2026-11-02'), "yyyy'-0'"), '2026-0');
});

test('parse dates, times, and date-times', () => {
  assert.equal(parse('02/11/2026', 'dd/MM/yyyy', 'PlainDate').toString(), '2026-11-02');
  assert.equal(parse('2/1/26', 'd/M/yy', 'PlainDate').toString(), '2026-01-02');
  assert.equal(parse('2/1/26', 'd/M/yy', 'PlainDate', { twoDigitYearBase: 1900 }).toString(), '1926-01-02');
  assert.equal(parse('14:05', 'HH:mm', 'PlainTime').toString(), '14:05:00');
  assert.equal(parse('09:07:04.042', 'HH:mm:ss.SSS', 'PlainTime').toString(), '09:07:04.042');
  assert.equal(parse('2:05 pm', 'h:mm a', 'PlainTime').toString(), '14:05:00');
  assert.equal(parse('12:05 AM', 'hh:mm a', 'PlainTime').toString(), '00:05:00');
  assert.equal(parse('12:05 PM', 'hh:mm a', 'PlainTime').toString(), '12:05:00');
  assert.equal(parse('14 2 pm', 'HH h a', 'PlainTime').toString(), '14:00:00');
  assert.equal(
    parse('2026-11-02 02:05 PM', 'yyyy-MM-dd hh:mm a', 'PlainDateTime').toString(),
    '2026-11-02T14:05:00',
  );
  assert.equal(parse('November 2026', 'MMMM yyyy', 'PlainYearMonth').toString(), '2026-11');
  assert.equal(parse('feb 29', 'MMM d', 'PlainMonthDay').toString(), '02-29');
  assert.equal(parse('Mon, 02 NOV 2026', 'EEE, dd MMM yyyy', 'PlainDate').toString(), '2026-11-02');
  assert.equal(parse('LUNDI 2 novembre 2026', 'EEEE d MMMM yyyy', 'PlainDate', { locale: 'fr-FR' }).toString(), '2026-11-02');
  assert.equal(parse('2026-11-02 2026', 'yyyy-MM-dd yyyy', 'PlainDate').toString(), '2026-11-02');
});

test('parse zoned date-times and instants', () => {
  assert.equal(
    parse('2026-11-02 14:30 Asia/Manila', 'yyyy-MM-dd HH:mm VV', 'ZonedDateTime').toString(),
    '2026-11-02T14:30:00+08:00[Asia/Manila]',
  );
  assert.equal(
    parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'ZonedDateTime', { timeZone: 'Asia/Manila' }).toString(),
    '2026-11-02T14:30:00+08:00[Asia/Manila]',
  );
  assert.equal(
    parse('2026-11-02 14:30 +08:00 Asia/Manila', 'yyyy-MM-dd HH:mm XXX VV', 'ZonedDateTime').toString(),
    '2026-11-02T14:30:00+08:00[Asia/Manila]',
  );
  assert.equal(parse('2026-11-02 14:30 +08:00', 'yyyy-MM-dd HH:mm XXX', 'Instant').toString(), '2026-11-02T06:30:00Z');
  assert.equal(
    parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'Instant', { timeZone: 'Asia/Manila' }).toString(),
    '2026-11-02T06:30:00Z',
  );
  assert.equal(
    parse('2026-11-02 14:30 Asia/Manila', 'yyyy-MM-dd HH:mm VV', 'Instant').toString(),
    '2026-11-02T06:30:00Z',
  );
});

test('parse failures: PARSE_FAILED', () => {
  assertThrowsCode(() => parse('2026-11-02x', 'yyyy-MM-dd', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('2026-13-01', 'yyyy-MM-dd', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('25:00', 'HH:mm', 'PlainTime'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('13:00 PM', 'h:mm a', 'PlainTime'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('Tue 2026-11-02', 'EEE yyyy-MM-dd', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('2026-11-02 2027', 'yyyy-MM-dd yyyy', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('14 1 pm', 'HH h a', 'PlainTime'), 'PARSE_FAILED');
  assertThrowsCode(() => parse(20261102, 'yyyyMMdd', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(
    () => parse('2026-11-02 14:30 +09:00 Asia/Manila', 'yyyy-MM-dd HH:mm XXX VV', 'ZonedDateTime'),
    'PARSE_FAILED',
  );
  assertThrowsCode(() => parse('2026-11-02 14:30 Mars/Base', 'yyyy-MM-dd HH:mm VV', 'ZonedDateTime'), 'PARSE_FAILED');
  assertThrowsCode(() => parse('2026-02-29', 'yyyy-MM-dd', 'PlainMonthDay'), 'PARSE_FAILED');
  const literalIsCaseSensitive = () => parse('2026-11-02t10:00', "yyyy-MM-dd'T'HH:mm", 'PlainDateTime');
  assertThrowsCode(literalIsCaseSensitive, 'PARSE_FAILED');
});

test('parse failure carries input and pattern', () => {
  try {
    parse('nope', 'yyyy', 'PlainDate');
    assert.fail('expected a throw');
  } catch (error) {
    assert.equal(error.input, 'nope');
    assert.equal(error.pattern, 'yyyy');
  }
});

test('parse configuration errors: INVALID_CONFIG', () => {
  assertThrowsCode(() => parse('2026-11', 'yyyy-MM', 'PlainDate'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('2026', 'yyyy', 'PlainYearMonth'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('11', 'MM', 'PlainMonthDay'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('30', 'mm', 'PlainTime'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('2:05', 'h:mm', 'PlainTime'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'ZonedDateTime'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'Instant'), 'INVALID_CONFIG');
  assertThrowsCode(
    () => parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'Instant', { timeZone: 'Mars/Base' }),
    'INVALID_CONFIG',
  );
  assertThrowsCode(
    () => parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'ZonedDateTime', { timeZone: 'Mars/Base' }),
    'INVALID_CONFIG',
  );
  assertThrowsCode(() => parse('2026', 'yyyy', 'Duration'), 'INVALID_CONFIG');
  assertThrowsCode(() => parse('26', 'yy', 'PlainYearMonth', { twoDigitYearBase: '2000' }), 'INVALID_CONFIG');
});
