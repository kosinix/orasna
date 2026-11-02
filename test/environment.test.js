import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { assertThrowsCode } from './helpers.js';

// Hide Temporal before importing the package, then restore it afterwards.
// Each test file runs in its own process, so this does not affect other files.
const savedTemporal = globalThis.Temporal;
const samples = {};

before(() => {
  samples.date = Temporal.PlainDate.from('2026-11-02');
  samples.dateTime = Temporal.PlainDateTime.from('2026-11-02T08:00');
  samples.time = Temporal.PlainTime.from('08:00');
  samples.instant = Temporal.Instant.from('2026-11-02T00:00Z');
  samples.duration = Temporal.Duration.from('PT1H');
  delete globalThis.Temporal;
});

after(() => {
  globalThis.Temporal = savedTemporal;
});

test('acceptance: import with no globalThis.Temporal, then any call throws TEMPORAL_MISSING', async () => {
  const root = await import('../src/index.js');
  const business = await import('../src/business.js');
  const interop = await import('../src/interop.js');
  const db = await import('../src/db.js');
  const { date, dateTime, time, instant, duration } = samples;

  const calls = [
    () => root.isBefore(date, date),
    () => root.earliest(),
    () => root.is(date),
    () => root.isBetween(date, date, date),
    () => root.startOf(date, 'day'),
    () => root.nthWeekdayOfMonth(null, 1, 1),
    () => root.timeSpan(time, time),
    () => root.sumDurations([duration]),
    () => root.format(date, 'yyyy'),
    () => root.parse('2026', 'yyyy', 'PlainYearMonth'),
    () => root.compilePattern('yyyy'),
    () => root.Interval.of(dateTime, dateTime),
    () => root.IntervalSet.from([]),
    () => root.systemClock('UTC'),
    () => root.fixedClock(instant, 'UTC'),
    () => root.manualClock(instant, 'UTC'),
    () => root.withTimeZone({ instant: () => instant }, 'UTC'),
    () => new business.BusinessCalendar(),
    () => interop.createReviver({}),
    () => interop.reviveFields({}, {}),
    () => interop.fromLegacyDate(new Date()),
    () => interop.toLegacyDate(instant),
    () => interop.fromInputValue(''),
    () => interop.toInputValue(date, 'date'),
    () => db.fromMySQLDate('2026-11-02'),
    () => db.mysql2TypeCast({ timeAs: 'Duration', sessionTimeZone: 'UTC' }),
    () => db.registerPgTypeParsers({ setTypeParser() {} }),
  ];
  for (const call of calls) {
    assertThrowsCode(call, 'TEMPORAL_MISSING');
  }
});

test('TEMPORAL_MISSING message tells the developer how to load the polyfill', async () => {
  const { format } = await import('../src/format.js');
  assert.throws(() => format(samples.date, 'yyyy'), /temporal-polyfill\/global/);
});
