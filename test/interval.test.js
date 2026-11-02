import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interval, IntervalSet } from '../src/interval.js';
import { assertThrowsCode, date, time, dateTime, zoned, instant } from './helpers.js';

const day = dateTime('2026-11-02T00:00');
const at = (hour, minute = 0) => day.with({ hour, minute });
const span = (startHour, endHour) => Interval.of(at(startHour), at(endHour));
const strings = (set) => set.intervals.map(String);

test('acceptance: [08:00, 12:00) and [12:00, 13:00) abut but do not overlap', () => {
  const morning = span(8, 12);
  const lunch = span(12, 13);
  assert.equal(morning.overlaps(lunch), false);
  assert.equal(morning.abuts(lunch), true);
  assert.equal(lunch.abuts(morning), true);
});

test('acceptance: fromInclusiveDates(2026-11-02, 2026-11-06).duration() is P5D', () => {
  const leave = Interval.fromInclusiveDates(date('2026-11-02'), date('2026-11-06'));
  assert.equal(leave.duration().toString(), 'P5D');
  assert.equal(leave.lastDay().toString(), '2026-11-06');
});

test('acceptance: attendance example, in 08:15, out 17:00', () => {
  const schedule = IntervalSet.from([
    Interval.of(day.with({ hour: 8 }), day.with({ hour: 12 })),
    Interval.of(day.with({ hour: 13 }), day.with({ hour: 17 })),
  ]);
  const timeIn = day.with({ hour: 8, minute: 15 });
  const timeOut = day.with({ hour: 17 });
  const actual = Interval.of(timeIn, timeOut);

  const rendered = schedule.intersection(actual).totalDuration();
  const undertime = schedule.subtract(actual).totalDuration();
  assert.equal(rendered.toString(), 'PT7H45M');
  assert.equal(undertime.toString(), 'PT15M');
});

test('Interval.of validation and frozen instances', () => {
  const interval = span(8, 12);
  assert.ok(Object.isFrozen(interval));
  assert.equal(interval.isEmpty, false);
  assert.equal(span(8, 8).isEmpty, true);
  assertThrowsCode(() => span(12, 8), 'INVALID_RANGE');
  assertThrowsCode(() => Interval.of(date('2026-11-02'), at(8)), 'TYPE_MISMATCH');
  assertThrowsCode(() => Interval.of(time('08:00'), time('09:00')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => new Interval(Symbol('x'), at(8), at(9), 'PlainDateTime'), 'INVALID_CONFIG');
});

test('fromInclusiveDates errors', () => {
  assertThrowsCode(() => Interval.fromInclusiveDates(date('2026-11-06'), date('2026-11-02')), 'INVALID_RANGE');
  assertThrowsCode(() => Interval.fromInclusiveDates(at(8), at(9)), 'UNSUPPORTED_TYPE');
});

test('Interval.parse for each type, including zone brackets', () => {
  assert.equal(Interval.parse('2026-11-02/2026-11-07', 'PlainDate').duration().toString(), 'P5D');
  assert.equal(
    Interval.parse('2026-11-02T08:00/2026-11-02T12:00', 'PlainDateTime').duration().toString(),
    'PT4H',
  );
  const zonedInterval = Interval.parse(
    '2026-11-01T00:00-04:00[America/New_York]/2026-11-01T04:00-05:00[America/New_York]',
    'ZonedDateTime',
  );
  assert.equal(zonedInterval.duration().toString(), 'PT5H');
  assert.equal(Interval.parse('2026-11-02T00:00Z/2026-11-02T01:30Z', 'Instant').duration().toString(), 'PT1H30M');
});

test('Interval.parse errors', () => {
  assertThrowsCode(() => Interval.parse('2026-11-02', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => Interval.parse('2026-11-02/2026-11-03/2026-11-04', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => Interval.parse('2026-11-02/PT8H', 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => Interval.parse(5, 'PlainDate'), 'PARSE_FAILED');
  assertThrowsCode(() => Interval.parse('2026-11-07/2026-11-02', 'PlainDate'), 'INVALID_RANGE');
  assertThrowsCode(() => Interval.parse('08:00/09:00', 'PlainTime'), 'INVALID_CONFIG');
});

test('contains and encloses', () => {
  const interval = span(8, 12);
  assert.equal(interval.contains(at(8)), true);
  assert.equal(interval.contains(at(11, 59)), true);
  assert.equal(interval.contains(at(12)), false);
  assert.equal(span(8, 8).contains(at(8)), false);
  assert.equal(interval.encloses(span(9, 10)), true);
  assert.equal(interval.encloses(span(8, 12)), true);
  assert.equal(interval.encloses(span(7, 10)), false);
  assertThrowsCode(() => interval.contains(date('2026-11-02')), 'TYPE_MISMATCH');
  assertThrowsCode(() => interval.encloses('08:00/09:00'), 'UNSUPPORTED_TYPE');
});

test('overlaps, abuts, and empty intervals', () => {
  assert.equal(span(8, 12).overlaps(span(11, 13)), true);
  assert.equal(span(8, 12).overlaps(span(9, 9)), false);
  assert.equal(span(9, 9).overlaps(span(8, 12)), false);
  assert.equal(span(8, 10).abuts(span(11, 12)), false);
  const dateInterval = Interval.fromInclusiveDates(date('2026-11-02'), date('2026-11-02'));
  assertThrowsCode(() => span(8, 12).overlaps(dateInterval), 'TYPE_MISMATCH');
});

test('intersection, union, subtract, and cover', () => {
  assert.equal(String(span(8, 12).intersection(span(10, 14))), String(span(10, 12)));
  assert.equal(span(8, 12).intersection(span(12, 14)), null);
  assert.deepEqual(strings(span(8, 12).union(span(12, 14))), [String(span(8, 14))]);
  assert.deepEqual(strings(span(8, 10).union(span(12, 14))), [String(span(8, 10)), String(span(12, 14))]);
  assert.deepEqual(strings(span(8, 17).subtract(span(12, 13))), [String(span(8, 12)), String(span(13, 17))]);
  assert.deepEqual(strings(span(8, 12).subtract(span(13, 14))), [String(span(8, 12))]);
  assert.equal(span(8, 12).subtract(span(7, 13)).isEmpty, true);
  assert.equal(String(span(8, 10).cover(span(12, 14))), String(span(8, 14)));
  assert.equal(String(span(12, 14).cover(span(8, 10))), String(span(8, 14)));
  assertThrowsCode(() => span(8, 12).union(null), 'UNSUPPORTED_TYPE');
});

test('duration for other types, lastDay and days', () => {
  const zonedInterval = Interval.of(zoned('2026-03-08T00:00[America/New_York]'), zoned('2026-03-09T00:00[America/New_York]'));
  assert.equal(zonedInterval.duration().toString(), 'PT23H');
  const leave = Interval.fromInclusiveDates(date('2026-11-02'), date('2026-11-04'));
  assert.deepEqual([...leave.days()].map(String), ['2026-11-02', '2026-11-03', '2026-11-04']);
  const emptyDates = Interval.of(date('2026-11-02'), date('2026-11-02'));
  assert.deepEqual([...emptyDates.days()], []);
  assertThrowsCode(() => emptyDates.lastDay(), 'INVALID_RANGE');
  assertThrowsCode(() => span(8, 12).lastDay(), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => span(8, 12).days(), 'UNSUPPORTED_TYPE');
});

test('toString and toJSON', () => {
  const leave = Interval.of(date('2026-11-02'), date('2026-11-07'));
  assert.equal(leave.toString(), '2026-11-02/2026-11-07');
  assert.equal(JSON.stringify({ leave }), '{"leave":"2026-11-02/2026-11-07"}');
  const set = IntervalSet.from([leave]);
  assert.equal(JSON.stringify(set), '["2026-11-02/2026-11-07"]');
});

test('IntervalSet.from normalizes, drops empties, and validates', () => {
  const set = IntervalSet.from([span(13, 17), span(8, 12), span(9, 10), span(12, 12), span(16, 18)]);
  assert.deepEqual(strings(set), [String(span(8, 12)), String(span(13, 18))]);
  assert.ok(Object.isFrozen(set));
  assert.ok(Object.isFrozen(set.intervals));
  assert.equal(IntervalSet.from([]).isEmpty, true);
  assert.equal(IntervalSet.from([span(8, 8)]).isEmpty, true);
  assertThrowsCode(() => IntervalSet.from('x'), 'INVALID_CONFIG');
  assertThrowsCode(() => IntervalSet.from([span(8, 9), 'x']), 'UNSUPPORTED_TYPE');
  const dateInterval = Interval.of(date('2026-11-02'), date('2026-11-03'));
  assertThrowsCode(() => IntervalSet.from([span(8, 9), dateInterval]), 'TYPE_MISMATCH');
  assertThrowsCode(() => new IntervalSet(Symbol('x'), []), 'INVALID_CONFIG');
});

test('IntervalSet contains, union, intersection, subtract, gaps, iterator', () => {
  const schedule = IntervalSet.from([span(8, 12), span(13, 17)]);
  assert.equal(schedule.contains(at(9)), true);
  assert.equal(schedule.contains(at(12, 30)), false);
  assert.deepEqual(strings(schedule.union(span(12, 13))), [String(span(8, 17))]);
  assert.deepEqual(strings(schedule.union(IntervalSet.from([span(18, 19)]))), [
    String(span(8, 12)),
    String(span(13, 17)),
    String(span(18, 19)),
  ]);
  assert.deepEqual(strings(schedule.intersection(IntervalSet.from([span(11, 14)]))), [String(span(11, 12)), String(span(13, 14))]);
  assert.deepEqual(strings(schedule.subtract(IntervalSet.from([span(9, 10), span(14, 15)]))), [
    String(span(8, 9)),
    String(span(10, 12)),
    String(span(13, 14)),
    String(span(15, 17)),
  ]);
  assert.deepEqual(strings(schedule.gaps(span(7, 18))), [String(span(7, 8)), String(span(12, 13)), String(span(17, 18))]);
  assert.deepEqual([...schedule].map(String), strings(schedule));
  assert.equal(IntervalSet.from([]).union(span(8, 9)).intervals.length, 1);
  assert.equal(IntervalSet.from([]).totalDuration().toString(), 'PT0S');
  const dateSet = IntervalSet.from([Interval.fromInclusiveDates(date('2026-11-02'), date('2026-11-03'))]);
  assert.equal(dateSet.totalDuration().toString(), 'P2D');
});

test('IntervalSet errors', () => {
  const schedule = IntervalSet.from([span(8, 12)]);
  assertThrowsCode(() => schedule.contains('09:00'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => schedule.union([span(8, 9)]), 'UNSUPPORTED_TYPE');
  const dateInterval = Interval.of(date('2026-11-02'), date('2026-11-03'));
  assertThrowsCode(() => schedule.intersection(dateInterval), 'TYPE_MISMATCH');
  assertThrowsCode(() => schedule.subtract(IntervalSet.from([dateInterval])), 'TYPE_MISMATCH');
  assertThrowsCode(() => schedule.gaps(schedule), 'UNSUPPORTED_TYPE');
  const instantInterval = Interval.of(instant('2026-11-02T00:00Z'), instant('2026-11-02T01:00Z'));
  assertThrowsCode(() => schedule.gaps(instantInterval), 'TYPE_MISMATCH');
});
