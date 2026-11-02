import { test } from 'node:test';
import assert from 'node:assert/strict';
import { systemClock, fixedClock, manualClock, withTimeZone } from '../src/clock.js';
import { assertThrowsCode, instant } from './helpers.js';

test('acceptance: manualClock advance({ hours: 1 }) moves instant() exactly one hour', () => {
  const clock = manualClock('2026-11-02T00:00:00Z', 'Asia/Manila');
  const before = clock.instant();
  clock.advance({ hours: 1 });
  const after = clock.instant();
  assert.equal(before.until(after, { largestUnit: 'hour' }).toString(), 'PT1H');
});

test('systemClock reads the real time in the given zone', () => {
  const clock = systemClock('asia/manila');
  assert.equal(clock.timeZoneId, 'Asia/Manila');
  const before = Temporal.Now.instant();
  const reading = clock.instant();
  assert.ok(Temporal.Instant.compare(reading, before) >= 0);
  assert.equal(clock.now().timeZoneId, 'Asia/Manila');
  assert.ok(Object.isFrozen(clock));
  assertThrowsCode(() => systemClock(), 'INVALID_CONFIG');
  assertThrowsCode(() => systemClock('Mars/Base'), 'INVALID_CONFIG');
});

test('fixedClock returns the same values every time', () => {
  const clock = fixedClock('2026-11-01T16:30:00Z', 'Asia/Manila');
  assert.equal(clock.instant().toString(), '2026-11-01T16:30:00Z');
  assert.equal(clock.now().toString(), '2026-11-02T00:30:00+08:00[Asia/Manila]');
  assert.equal(clock.today().toString(), '2026-11-02');
  assert.equal(clock.time().toString(), '00:30:00');
  assert.equal(clock.dateTime().toString(), '2026-11-02T00:30:00');
  assert.equal(fixedClock(instant('2026-11-02T00:00Z'), 'UTC').today().toString(), '2026-11-02');
  assertThrowsCode(() => fixedClock('2026-11-02T00:30', 'UTC'), 'PARSE_FAILED');
  assertThrowsCode(() => fixedClock(Date.now(), 'UTC'), 'INVALID_CONFIG');
  assertThrowsCode(() => fixedClock('2026-11-02T00:00Z'), 'INVALID_CONFIG');
});

test('manualClock advance in zone, set, and errors', () => {
  const clock = manualClock(instant('2026-03-07T12:00:00-05:00'), 'America/New_York');
  clock.advance({ days: 1 });
  assert.equal(clock.now().toString(), '2026-03-08T12:00:00-04:00[America/New_York]');
  clock.advance('PT30M');
  assert.equal(clock.time().toString(), '12:30:00');
  clock.set('2026-11-02T00:00:00Z');
  assert.equal(clock.instant().toString(), '2026-11-02T00:00:00Z');
  assert.ok(Object.isFrozen(clock));
  assertThrowsCode(() => clock.advance('one hour'), 'INVALID_CONFIG');
  assertThrowsCode(() => clock.set('yesterday'), 'PARSE_FAILED');
  assertThrowsCode(() => manualClock('2026-11-02T00:00Z', ''), 'INVALID_CONFIG');
});

test('withTimeZone follows the source clock', () => {
  const source = manualClock('2026-11-02T00:00:00Z', 'Asia/Manila');
  const tokyo = withTimeZone(source, 'Asia/Tokyo');
  assert.equal(tokyo.timeZoneId, 'Asia/Tokyo');
  assert.equal(tokyo.time().toString(), '09:00:00');
  source.advance({ hours: 2 });
  assert.equal(tokyo.time().toString(), '11:00:00');
  assertThrowsCode(() => withTimeZone({}, 'UTC'), 'INVALID_CONFIG');
  assertThrowsCode(() => withTimeZone(null, 'UTC'), 'INVALID_CONFIG');
  assertThrowsCode(() => withTimeZone(source, 'Nowhere'), 'INVALID_CONFIG');
});
