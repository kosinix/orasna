import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BusinessCalendar } from '../src/business.js';
import { Interval } from '../src/interval.js';
import { assertThrowsCode, date, dateTime, time } from './helpers.js';

const officeHours = [
  { start: '08:00', end: '12:00' },
  { start: '13:00', end: '17:00' },
];

test('acceptance: holiday 2026-11-30; addWorkingDays(2026-11-27, 1) is 2026-12-01', () => {
  const calendar = new BusinessCalendar({ weekend: [6, 7], holidays: ['2026-11-30'] });
  assert.equal(calendar.addWorkingDays(date('2026-11-27'), 1).toString(), '2026-12-01');
});

test('acceptance: workingDaysBetween(2026-11-02, 2026-11-09) is 5', () => {
  const calendar = new BusinessCalendar();
  assert.equal(calendar.workingDaysBetween(date('2026-11-02'), date('2026-11-09')), 5);
});

test("acceptance: extraWorkingDays ['2026-11-07'] makes that Saturday a working day", () => {
  const calendar = new BusinessCalendar({ extraWorkingDays: ['2026-11-07'] });
  assert.equal(calendar.isWorkingDay(date('2026-11-07')), true);
});

test('precedence: extra beats holidays and nonWorkingDays, which beat weekend', () => {
  const calendar = new BusinessCalendar({
    holidays: [date('2026-11-30'), '2026-12-01'],
    nonWorkingDays: ['2026-11-03'],
    extraWorkingDays: ['2026-12-01'],
  });
  assert.equal(calendar.isWorkingDay(date('2026-11-30')), false);
  assert.equal(calendar.isWorkingDay(date('2026-12-01')), true);
  assert.equal(calendar.isWorkingDay(date('2026-11-03')), false);
  assert.equal(calendar.isWorkingDay(date('2026-11-08')), false);
  assert.equal(calendar.isWorkingDay(date('2026-11-04')), true);
  assertThrowsCode(() => calendar.isWorkingDay('2026-11-04'), 'UNSUPPORTED_TYPE');
});

test('custom weekend', () => {
  const calendar = new BusinessCalendar({ weekend: [5, 6] });
  assert.equal(calendar.isWorkingDay(date('2026-11-06')), false);
  assert.equal(calendar.isWorkingDay(date('2026-11-08')), true);
});

test('constructor validation', () => {
  assert.ok(Object.isFrozen(new BusinessCalendar()));
  assertThrowsCode(() => new BusinessCalendar({ weekend: [1, 2, 3, 4, 5, 6, 7] }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ weekend: 6 }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ weekend: [0] }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ holidays: '2026-11-30' }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ holidays: [20261130] }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ holidays: ['11/30/2026'] }), 'PARSE_FAILED');
  assertThrowsCode(() => new BusinessCalendar({ holidays: ['2026-02-30'] }), 'PARSE_FAILED');
  assertThrowsCode(() => new BusinessCalendar({ workingHours: { start: '08:00' } }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ workingHours: ['08:00-17:00'] }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ workingHours: [{ start: '17:00', end: '08:00' }] }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ workingHours: [{ start: 8, end: '12:00' }] }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar({ workingHours: [{ start: '8am', end: '12:00' }] }), 'PARSE_FAILED');
  const overlapping = [
    { start: '08:00', end: '12:30' },
    { start: '12:00', end: '17:00' },
  ];
  assertThrowsCode(() => new BusinessCalendar({ workingHours: overlapping }), 'INVALID_CONFIG');
  assertThrowsCode(() => new BusinessCalendar('weekdays'), 'INVALID_CONFIG');
});

test('nextWorkingDay and previousWorkingDay', () => {
  const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });
  assert.equal(calendar.nextWorkingDay(date('2026-11-27')).toString(), '2026-12-01');
  assert.equal(calendar.nextWorkingDay(date('2026-11-27'), { includeToday: true }).toString(), '2026-11-27');
  assert.equal(calendar.nextWorkingDay(date('2026-11-28'), { includeToday: true }).toString(), '2026-12-01');
  assert.equal(calendar.previousWorkingDay(date('2026-12-01')).toString(), '2026-11-27');
  assert.equal(calendar.previousWorkingDay(date('2026-12-01'), { includeToday: true }).toString(), '2026-12-01');
  assertThrowsCode(() => calendar.nextWorkingDay(date('2026-11-27'), { includeToday: 1 }), 'INVALID_CONFIG');
  assertThrowsCode(() => calendar.previousWorkingDay(dateTime('2026-11-27T00:00')), 'UNSUPPORTED_TYPE');
});

test('search stops after 3,660 days instead of hanging', () => {
  const holidays = [];
  let current = date('2026-11-02');
  for (let index = 0; index < 3700; index += 1) {
    holidays.push(current);
    current = current.add({ days: 1 });
  }
  const calendar = new BusinessCalendar({ holidays });
  assertThrowsCode(() => calendar.nextWorkingDay(date('2026-11-01')), 'INVALID_CONFIG');
});

test('addWorkingDays forwards, backwards, and zero', () => {
  const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });
  const saturday = date('2026-11-28');
  assert.equal(calendar.addWorkingDays(saturday, 0).toString(), '2026-11-28');
  assert.equal(calendar.addWorkingDays(date('2026-11-27'), 3).toString(), '2026-12-03');
  assert.equal(calendar.addWorkingDays(date('2026-12-01'), -1).toString(), '2026-11-27');
  assert.equal(calendar.addWorkingDays(date('2026-12-01'), -2).toString(), '2026-11-26');
  assertThrowsCode(() => calendar.addWorkingDays(saturday, 1.5), 'INVALID_CONFIG');
  assertThrowsCode(() => calendar.addWorkingDays('2026-11-28', 1), 'UNSUPPORTED_TYPE');
});

test('workingDaysBetween reversed and errors', () => {
  const calendar = new BusinessCalendar();
  assert.equal(calendar.workingDaysBetween(date('2026-11-09'), date('2026-11-02')), -5);
  assert.equal(calendar.workingDaysBetween(date('2026-11-02'), date('2026-11-02')), 0);
  assertThrowsCode(() => calendar.workingDaysBetween(date('2026-11-02'), dateTime('2026-11-09T00:00')), 'UNSUPPORTED_TYPE');
});

test('workingDays over a leave request', () => {
  const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });
  const leave = Interval.fromInclusiveDates(date('2026-11-26'), date('2026-12-02'));
  const days = [...calendar.workingDays(leave)].map(String);
  assert.deepEqual(days, ['2026-11-26', '2026-11-27', '2026-12-01', '2026-12-02']);
  assertThrowsCode(() => calendar.workingDays([date('2026-11-26')]), 'UNSUPPORTED_TYPE');
  const timeRange = Interval.of(dateTime('2026-11-26T00:00'), dateTime('2026-11-27T00:00'));
  assertThrowsCode(() => calendar.workingDays(timeRange), 'UNSUPPORTED_TYPE');
});

test('workingDurationBetween counts only working windows on working days', () => {
  const calendar = new BusinessCalendar({ workingHours: officeHours, holidays: ['2026-11-30'] });
  const fridayMorning = dateTime('2026-11-27T10:00');
  assert.equal(calendar.workingDurationBetween(fridayMorning, dateTime('2026-11-27T15:30')).toString(), 'PT4H30M');
  assert.equal(calendar.workingDurationBetween(fridayMorning, dateTime('2026-12-01T10:00')).toString(), 'PT8H');
  assert.equal(calendar.workingDurationBetween(dateTime('2026-12-01T10:00'), fridayMorning).toString(), '-PT8H');
  assert.equal(calendar.workingDurationBetween(dateTime('2026-11-28T09:00'), dateTime('2026-11-28T17:00')).toString(), 'PT0S');
  assertThrowsCode(() => new BusinessCalendar().workingDurationBetween(fridayMorning, fridayMorning), 'INVALID_CONFIG');
  assertThrowsCode(() => calendar.workingDurationBetween(fridayMorning, date('2026-11-28')), 'UNSUPPORTED_TYPE');
});

test('workingHours accepts PlainTime values and is sorted', () => {
  const calendar = new BusinessCalendar({
    workingHours: [
      { start: time('13:00'), end: time('17:00') },
      { start: '08:00', end: '12:00' },
    ],
  });
  const total = calendar.workingDurationBetween(dateTime('2026-11-02T00:00'), dateTime('2026-11-03T00:00'));
  assert.equal(total.toString(), 'PT8H');
});

test('with() returns a new calendar and leaves the original unchanged', () => {
  const calendar = new BusinessCalendar({ holidays: ['2026-11-30'], workingHours: officeHours });
  const suspended = calendar.with({ nonWorkingDays: ['2026-11-03'] });
  assert.notEqual(suspended, calendar);
  assert.equal(suspended.isWorkingDay(date('2026-11-03')), false);
  assert.equal(suspended.isWorkingDay(date('2026-11-30')), false);
  assert.equal(calendar.isWorkingDay(date('2026-11-03')), true);
  const total = suspended.workingDurationBetween(dateTime('2026-11-02T00:00'), dateTime('2026-11-03T00:00'));
  assert.equal(total.toString(), 'PT8H');
  assertThrowsCode(() => calendar.with(null), 'INVALID_CONFIG');
  assertThrowsCode(() => calendar.with({ weekend: [1, 2, 3, 4, 5, 6, 7] }), 'INVALID_CONFIG');
});
