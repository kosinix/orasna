import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBefore,
  isAfter,
  isSameOrBefore,
  isSameOrAfter,
  isSameMoment,
  isBetween,
  earliest,
  latest,
  ascending,
  descending,
  is,
} from '../src/compare.js';
import { assertThrowsCode, date, time, dateTime, zoned, instant } from './helpers.js';

const d1 = date('2026-11-02');
const d2 = date('2026-11-03');

test('acceptance: isBefore(PlainDate, PlainDateTime) throws TYPE_MISMATCH', () => {
  assertThrowsCode(() => isBefore(d1, dateTime('2026-11-03T00:00')), 'TYPE_MISMATCH');
});

test('acceptance: isBetween(12:00, 08:00, 12:00) with default bounds is false', () => {
  assert.equal(isBetween(time('12:00'), time('08:00'), time('12:00')), false);
});

test('isBefore / isAfter / isSameOrBefore / isSameOrAfter', () => {
  assert.equal(isBefore(d1, d2), true);
  assert.equal(isBefore(d2, d1), false);
  assert.equal(isAfter(d2, d1), true);
  assert.equal(isAfter(d1, d1), false);
  assert.equal(isSameOrBefore(d1, d1), true);
  assert.equal(isSameOrBefore(d2, d1), false);
  assert.equal(isSameOrAfter(d1, d1), true);
  assert.equal(isSameOrAfter(d1, d2), false);
  assert.equal(isBefore(Temporal.PlainYearMonth.from('2026-10'), Temporal.PlainYearMonth.from('2026-11')), true);
  assert.equal(isBefore(instant('2026-11-02T00:00Z'), instant('2026-11-02T00:00:01Z')), true);
});

test('comparison errors', () => {
  assertThrowsCode(() => isAfter(d1, '2026-11-02'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => isSameOrBefore(d1, time('10:00')), 'TYPE_MISMATCH');
  const hour = Temporal.Duration.from('PT1H');
  assertThrowsCode(() => isSameOrAfter(hour, hour), 'UNSUPPORTED_TYPE');
  const monthDay = Temporal.PlainMonthDay.from('11-02');
  assertThrowsCode(() => isBefore(monthDay, monthDay), 'UNSUPPORTED_TYPE');
});

test('isSameMoment treats different zones as the same instant', () => {
  assert.equal(isSameMoment(zoned('2026-11-02T14:00[Asia/Manila]'), zoned('2026-11-02T06:00[UTC]')), true);
  assert.equal(isSameMoment(d1, d2), false);
  const manila = zoned('2026-11-02T14:00[Asia/Manila]');
  assertThrowsCode(() => isSameMoment(manila, instant('2026-11-02T06:00Z')), 'TYPE_MISMATCH');
});

test('isBetween bounds', () => {
  const start = time('08:00');
  const end = time('12:00');
  assert.equal(isBetween(start, start, end), true);
  assert.equal(isBetween(end, start, end, { bounds: '[]' }), true);
  assert.equal(isBetween(start, start, end, { bounds: '()' }), false);
  assert.equal(isBetween(time('10:00'), start, end, { bounds: '()' }), true);
  assert.equal(isBetween(end, start, end, { bounds: '(]' }), true);
  assert.equal(isBetween(start, start, end, { bounds: '(]' }), false);
  assertThrowsCode(() => isBetween(start, start, end, { bounds: '[[' }), 'INVALID_CONFIG');
  assertThrowsCode(() => isBetween(start, d1, end), 'TYPE_MISMATCH');
  assertThrowsCode(() => isBetween(Temporal.PlainMonthDay.from('11-02'), start, end), 'UNSUPPORTED_TYPE');
});

test('earliest and latest', () => {
  const d3 = date('2026-11-05');
  assert.equal(earliest(d3, d1, d2).toString(), '2026-11-02');
  assert.equal(latest(d1, d3, d2).toString(), '2026-11-05');
  assert.equal(earliest(d1).toString(), '2026-11-02');
  assertThrowsCode(() => earliest(), 'INVALID_CONFIG');
  assertThrowsCode(() => latest(), 'INVALID_CONFIG');
  assertThrowsCode(() => latest(d1, time('10:00')), 'TYPE_MISMATCH');
});

test('ascending and descending work with Array.prototype.sort', () => {
  const list = [date('2026-11-05'), d1, d2];
  assert.deepEqual([...list].sort(ascending).map(String), ['2026-11-02', '2026-11-03', '2026-11-05']);
  assert.deepEqual([...list].sort(descending).map(String), ['2026-11-05', '2026-11-03', '2026-11-02']);
  assertThrowsCode(() => ascending(d1, time('10:00')), 'TYPE_MISMATCH');
  assertThrowsCode(() => descending(d1, 'x'), 'UNSUPPORTED_TYPE');
});

test('is(value) reads like a sentence', () => {
  assert.equal(is(d1).before(d2), true);
  assert.equal(is(d2).after(d1), true);
  assert.equal(is(d1).sameOrBefore(d1), true);
  assert.equal(is(d1).sameOrAfter(d2), false);
  assert.equal(is(time('12:00')).between(time('08:00'), time('12:00')), false);
  assert.equal(is(time('12:00')).between(time('08:00'), time('12:00'), { bounds: '[]' }), true);
  const manila = zoned('2026-11-02T14:00[Asia/Manila]');
  assert.equal(is(manila).sameMomentAs(zoned('2026-11-02T06:00[UTC]')), true);
});

test('is(value) gives the same answers as the matching functions', () => {
  const values = [d1, d2, date('2026-11-04')];
  for (const a of values) {
    for (const b of values) {
      assert.equal(is(a).before(b), isBefore(a, b));
      assert.equal(is(a).after(b), isAfter(a, b));
      assert.equal(is(a).sameOrBefore(b), isSameOrBefore(a, b));
      assert.equal(is(a).sameOrAfter(b), isSameOrAfter(a, b));
      assert.equal(is(a).sameMomentAs(b), isSameMoment(a, b));
      assert.equal(is(a).between(d1, b), isBetween(a, d1, b));
    }
  }
});

test('is(value) is frozen and exposes the wrapped value', () => {
  const comparison = is(d1);
  assert.ok(Object.isFrozen(comparison));
  assert.equal(comparison.value, d1);
});

test('is(value) errors', () => {
  assertThrowsCode(() => is('2026-11-02'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => is(Temporal.Duration.from('PT1H')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => is(Temporal.PlainMonthDay.from('11-02')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => is(d1).before(dateTime('2026-11-03T00:00')), 'TYPE_MISMATCH');
  assertThrowsCode(() => is(d1).after('2026-11-02'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => is(d1).sameOrBefore(time('10:00')), 'TYPE_MISMATCH');
  assertThrowsCode(() => is(d1).sameOrAfter(time('10:00')), 'TYPE_MISMATCH');
  assertThrowsCode(() => is(d1).sameMomentAs(instant('2026-11-02T00:00Z')), 'TYPE_MISMATCH');
  assertThrowsCode(() => is(d1).between(d1, time('10:00')), 'TYPE_MISMATCH');
  assertThrowsCode(() => is(d1).between(d1, d2, { bounds: '[[' }), 'INVALID_CONFIG');
});

test('is(value) error messages name the method', () => {
  assert.throws(() => is(d1).before(time('10:00')), /is\(value\)\.before\(\)/);
});
