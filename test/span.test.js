import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeSpan,
  elapsed,
  totalHours,
  totalMinutes,
  sumDurations,
  formatClockDuration,
} from '../src/span.js';
import { assertThrowsCode, time, date, dateTime, zoned, instant, duration } from './helpers.js';

test('acceptance: timeSpan(22:00, 06:00) is PT8H', () => {
  assert.equal(timeSpan(time('22:00'), time('06:00')).toString(), 'PT8H');
});

test("acceptance: timeSpan(22:00, 06:00, { overnight: 'never' }) throws INVALID_RANGE", () => {
  assertThrowsCode(() => timeSpan(time('22:00'), time('06:00'), { overnight: 'never' }), 'INVALID_RANGE');
});

test('acceptance: elapsed across DST in America/New_York', () => {
  const springStart = zoned('2026-03-08T00:00[America/New_York]');
  const springEnd = zoned('2026-03-08T04:00[America/New_York]');
  assert.equal(elapsed(springStart, springEnd).toString(), 'PT3H');

  const fallStart = zoned('2026-11-01T00:00[America/New_York]');
  const fallEnd = zoned('2026-11-01T04:00[America/New_York]');
  assert.equal(elapsed(fallStart, fallEnd).toString(), 'PT5H');
});

test('timeSpan regular, equal, and error cases', () => {
  assert.equal(timeSpan(time('08:00'), time('17:30')).toString(), 'PT9H30M');
  assert.equal(timeSpan(time('08:00'), time('08:00')).toString(), 'PT0S');
  assert.equal(timeSpan(time('23:30:15'), time('00:15')).toString(), 'PT44M45S');
  assertThrowsCode(() => timeSpan(time('08:00'), dateTime('2026-11-02T09:00')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => timeSpan(time('08:00'), time('09:00'), { overnight: 'always' }), 'INVALID_CONFIG');
});

test('elapsed for PlainDateTime and Instant; errors', () => {
  assert.equal(elapsed(dateTime('2026-11-02T08:00'), dateTime('2026-11-03T09:30')).toString(), 'PT25H30M');
  assert.equal(elapsed(instant('2026-11-02T10:00Z'), instant('2026-11-02T08:00Z')).toString(), '-PT2H');
  assertThrowsCode(() => elapsed(date('2026-11-02'), date('2026-11-03')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => elapsed(instant('2026-11-02T10:00Z'), dateTime('2026-11-02T08:00')), 'TYPE_MISMATCH');
});

test('totalHours and totalMinutes', () => {
  assert.equal(totalHours(duration('PT7H45M')), 7.75);
  assert.equal(totalHours(duration('P1DT2H')), 26);
  assert.equal(totalMinutes(duration('PT1H30M')), 90);
  assertThrowsCode(() => totalHours(duration('P1M')), 'NEEDS_REFERENCE_DATE');
  assertThrowsCode(() => totalMinutes(duration('P1W')), 'NEEDS_REFERENCE_DATE');
  assertThrowsCode(() => totalMinutes(duration('P1Y')), 'NEEDS_REFERENCE_DATE');
  assertThrowsCode(() => totalHours('PT1H'), 'UNSUPPORTED_TYPE');
});

test('sumDurations', () => {
  assert.equal(sumDurations([duration('PT7H45M'), duration('PT8H30M')]).toString(), 'PT16H15M');
  assert.equal(sumDurations([duration('P1D'), duration('PT1H')]).toString(), 'PT25H');
  assert.equal(sumDurations([]).toString(), 'PT0S');
  assertThrowsCode(() => sumDurations('PT1H'), 'INVALID_CONFIG');
  assertThrowsCode(() => sumDurations([duration('PT1H'), 'PT1H']), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => sumDurations([duration('P1M')]), 'NEEDS_REFERENCE_DATE');
});

test('formatClockDuration', () => {
  assert.equal(formatClockDuration(duration('PT8H30M'), 'h:mm'), '8:30');
  assert.equal(formatClockDuration(duration('-PT15M'), 'h:mm'), '-0:15');
  assert.equal(formatClockDuration(duration('PT27H5M'), 'h:mm'), '27:05');
  assert.equal(formatClockDuration(duration('P1DT3H5M'), 'h:mm'), '27:05');
  assert.equal(formatClockDuration(duration('PT1H2M3.9S'), 'h:mm:ss'), '1:02:03');
  assert.equal(formatClockDuration(duration('PT59.9S'), 'h:mm'), '0:00');
  assertThrowsCode(() => formatClockDuration(duration('PT1H'), 'hh:mm'), 'INVALID_CONFIG');
  assertThrowsCode(() => formatClockDuration(duration('P1M'), 'h:mm'), 'NEEDS_REFERENCE_DATE');
  assertThrowsCode(() => formatClockDuration(60, 'h:mm'), 'UNSUPPORTED_TYPE');
});
