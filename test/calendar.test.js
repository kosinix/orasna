import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Weekday,
  startOf,
  startOfNext,
  lastDayOf,
  nextWeekday,
  previousWeekday,
  nthWeekdayOfMonth,
} from '../src/calendar.js';
import { assertThrowsCode, date, dateTime, zoned, time } from './helpers.js';

const yearMonth = (text) => Temporal.PlainYearMonth.from(text);

test('acceptance: startOf day skips a DST midnight in America/Sao_Paulo', () => {
  const result = startOf(zoned('2018-11-04T12:00[America/Sao_Paulo]'), 'day');
  assert.equal(result.toString(), '2018-11-04T01:00:00-02:00[America/Sao_Paulo]');
});

test('acceptance: nthWeekdayOfMonth', () => {
  assert.equal(nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.MONDAY, 5).toString(), '2026-11-30');
  assert.equal(nthWeekdayOfMonth(yearMonth('2026-02'), Weekday.MONDAY, 5), null);
});

test('acceptance: lastDayOf(2028-02-10, month) is 2028-02-29', () => {
  assert.equal(lastDayOf(date('2028-02-10'), 'month').toString(), '2028-02-29');
});

test('Weekday is frozen ISO numbering', () => {
  assert.equal(Weekday.MONDAY, 1);
  assert.equal(Weekday.SUNDAY, 7);
  assert.ok(Object.isFrozen(Weekday));
});

test('startOf for each unit and type', () => {
  const thursday = date('2026-11-05');
  assert.equal(startOf(thursday, 'day').toString(), '2026-11-05');
  assert.equal(startOf(thursday, 'week').toString(), '2026-11-02');
  assert.equal(startOf(thursday, 'week', { weekStartsOn: Weekday.SUNDAY }).toString(), '2026-11-01');
  assert.equal(startOf(thursday, 'month').toString(), '2026-11-01');
  assert.equal(startOf(thursday, 'quarter').toString(), '2026-10-01');
  assert.equal(startOf(date('2026-03-31'), 'quarter').toString(), '2026-01-01');
  assert.equal(startOf(thursday, 'year').toString(), '2026-01-01');
  assert.equal(startOf(dateTime('2026-11-05T14:30'), 'month').toString(), '2026-11-01T00:00:00');
  assert.equal(
    startOf(zoned('2026-11-05T14:30[Asia/Manila]'), 'week').toString(),
    '2026-11-02T00:00:00+08:00[Asia/Manila]',
  );
  assert.equal(
    startOf(zoned('2018-11-20T12:00[America/Sao_Paulo]'), 'month').toString(),
    '2018-11-01T00:00:00-03:00[America/Sao_Paulo]',
  );
});

test('startOf errors', () => {
  assertThrowsCode(() => startOf(time('10:00'), 'day'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => startOf(date('2026-11-05'), 'decade'), 'INVALID_CONFIG');
  assertThrowsCode(() => startOf(date('2026-11-05'), 'week', { weekStartsOn: 0 }), 'INVALID_CONFIG');
  assertThrowsCode(() => startOf(date('2026-11-05'), 'week', 'monday'), 'INVALID_CONFIG');
});

test('startOfNext for each unit, including DST days', () => {
  const thursday = date('2026-11-05');
  assert.equal(startOfNext(thursday, 'day').toString(), '2026-11-06');
  assert.equal(startOfNext(thursday, 'week').toString(), '2026-11-09');
  assert.equal(startOfNext(thursday, 'month').toString(), '2026-12-01');
  assert.equal(startOfNext(thursday, 'quarter').toString(), '2027-01-01');
  assert.equal(startOfNext(thursday, 'year').toString(), '2027-01-01');
  assert.equal(
    startOfNext(zoned('2018-11-03T12:00[America/Sao_Paulo]'), 'day').toString(),
    '2018-11-04T01:00:00-02:00[America/Sao_Paulo]',
  );
  assertThrowsCode(() => startOfNext(Temporal.Instant.from('2026-11-05T00:00Z'), 'day'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => startOfNext(thursday, 'hour'), 'INVALID_CONFIG');
});

test('lastDayOf other units and errors', () => {
  assert.equal(lastDayOf(date('2026-11-05'), 'week').toString(), '2026-11-08');
  assert.equal(lastDayOf(date('2026-11-05'), 'quarter').toString(), '2026-12-31');
  assert.equal(lastDayOf(date('2026-11-05'), 'year').toString(), '2026-12-31');
  assertThrowsCode(() => lastDayOf(date('2026-11-05'), 'day'), 'INVALID_CONFIG');
  assertThrowsCode(() => lastDayOf(dateTime('2026-11-05T10:00'), 'month'), 'UNSUPPORTED_TYPE');
});

test('nextWeekday and previousWeekday', () => {
  const monday = date('2026-11-02');
  assert.equal(nextWeekday(monday, Weekday.FRIDAY).toString(), '2026-11-06');
  assert.equal(nextWeekday(monday, Weekday.MONDAY).toString(), '2026-11-09');
  assert.equal(nextWeekday(monday, Weekday.MONDAY, { includeToday: true }).toString(), '2026-11-02');
  assert.equal(previousWeekday(monday, Weekday.FRIDAY).toString(), '2026-10-30');
  assert.equal(previousWeekday(monday, Weekday.MONDAY).toString(), '2026-10-26');
  assert.equal(previousWeekday(monday, Weekday.MONDAY, { includeToday: true }).toString(), '2026-11-02');
  assertThrowsCode(() => nextWeekday(monday, 9), 'INVALID_CONFIG');
  assertThrowsCode(() => nextWeekday(monday, 1, { includeToday: 'yes' }), 'INVALID_CONFIG');
  assertThrowsCode(() => previousWeekday('2026-11-02', 1), 'UNSUPPORTED_TYPE');
});

test('nthWeekdayOfMonth first, last, and errors', () => {
  assert.equal(nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.THURSDAY, 4).toString(), '2026-11-26');
  assert.equal(nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.SUNDAY, 1).toString(), '2026-11-01');
  assert.equal(nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.FRIDAY, -1).toString(), '2026-11-27');
  assert.equal(nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.MONDAY, -1).toString(), '2026-11-30');
  assertThrowsCode(() => nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.MONDAY, 6), 'INVALID_CONFIG');
  assertThrowsCode(() => nthWeekdayOfMonth(yearMonth('2026-11'), Weekday.MONDAY, 0), 'INVALID_CONFIG');
  assertThrowsCode(() => nthWeekdayOfMonth(date('2026-11-01'), Weekday.MONDAY, 1), 'UNSUPPORTED_TYPE');
});
