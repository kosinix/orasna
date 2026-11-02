import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createReviver,
  reviveFields,
  fromLegacyDate,
  toLegacyDate,
  fromInputValue,
  toInputValue,
} from '../src/interop.js';
import { typeOf } from '../src/internal/temporal.js';
import { assertThrowsCode, date, time, dateTime, zoned, instant } from './helpers.js';

const schema = { createdAt: 'Instant', 'leave.start': 'PlainDate', 'logs.*.timeIn': 'PlainTime' };
const json = JSON.stringify({
  createdAt: '2026-11-02T06:30:00Z',
  leave: { start: '2026-11-02', reason: 'vacation' },
  logs: [{ timeIn: '08:15' }, { timeIn: '07:58' }, { timeIn: null }],
  note: '2026-11-02',
});

test("acceptance: reviver with 'logs.*.timeIn' makes each item's timeIn a PlainTime", () => {
  const body = JSON.parse(json, createReviver(schema));
  assert.equal(typeOf(body.logs[0].timeIn), 'PlainTime');
  assert.equal(typeOf(body.logs[1].timeIn), 'PlainTime');
  assert.equal(body.logs[0].timeIn.toString(), '08:15:00');
  assert.equal(body.logs[2].timeIn, null);
  assert.equal(typeOf(body.createdAt), 'Instant');
  assert.equal(typeOf(body.leave.start), 'PlainDate');
  assert.equal(body.leave.reason, 'vacation');
  assert.equal(body.note, '2026-11-02');
});

test("acceptance: fromInputValue('') is null", () => {
  assert.equal(fromInputValue(''), null);
  assert.equal(fromInputValue({ type: 'date', value: '' }), null);
});

test("acceptance: fromInputValue('2026-W45', 'week') is 2026-11-02", () => {
  assert.equal(fromInputValue('2026-W45', 'week').toString(), '2026-11-02');
});

test('reviver leaves nested empty-string keys and non-root calls alone', () => {
  const reviver = createReviver({ a: 'PlainDate' });
  assert.equal(reviver.call({ x: 1, '': 'y' }, '', '2026-11-02'), '2026-11-02');
  const parsed = JSON.parse('{"a":"2026-11-02","b":[1,2]}', reviver);
  assert.equal(parsed.a.toString(), '2026-11-02');
  assert.deepEqual(parsed.b, [1, 2]);
  assert.equal(JSON.parse('"2026-11-02"', createReviver({})), '2026-11-02');
});

test('reviveFields copies without mutating and handles arrays, indexes, and nulls', () => {
  const body = JSON.parse(json);
  const revived = reviveFields(body, schema);
  assert.equal(typeof body.createdAt, 'string');
  assert.equal(typeof body.logs[0].timeIn, 'string');
  assert.equal(typeOf(revived.createdAt), 'Instant');
  assert.equal(typeOf(revived.logs[0].timeIn), 'PlainTime');

  const byIndex = reviveFields({ list: ['2026-11-02', '2026-11-03'] }, { 'list.0': 'PlainDate' });
  assert.equal(typeOf(byIndex.list[0]), 'PlainDate');
  assert.equal(byIndex.list[1], '2026-11-03');

  assert.deepEqual(reviveFields({ leave: null }, schema), { leave: null });
  assert.deepEqual(reviveFields({}, schema), {});
  assert.equal(reviveFields('text', schema), 'text');
  const already = { createdAt: instant('2026-11-02T00:00Z') };
  assert.equal(reviveFields(already, schema).createdAt, already.createdAt);
  assert.deepEqual(reviveFields({ logs: { timeIn: '08:00' } }, schema), { logs: { timeIn: '08:00' } });
});

test('reviveFields keeps __proto__ keys as plain properties', () => {
  const body = JSON.parse('{"__proto__":"2026-11-02"}');
  const revived = reviveFields(body, JSON.parse('{"__proto__":"PlainDate"}'));
  assert.equal(Object.getPrototypeOf(revived), Object.prototype);
  assert.equal(typeOf(Object.getOwnPropertyDescriptor(revived, '__proto__').value), 'PlainDate');
});

test('revival of invalid values throws PARSE_FAILED naming the path', () => {
  try {
    reviveFields({ logs: [{ timeIn: '08:15' }, { timeIn: '25:00' }] }, schema);
    assert.fail('expected a throw');
  } catch (error) {
    assert.equal(error.code, 'PARSE_FAILED');
    assert.equal(error.path, 'logs.1.timeIn');
    assert.equal(error.input, '25:00');
  }
  assertThrowsCode(() => reviveFields({ createdAt: 1730000000 }, schema), 'PARSE_FAILED');
  assertThrowsCode(() => JSON.parse('{"createdAt":"yesterday"}', createReviver(schema)), 'PARSE_FAILED');
});

test('schema validation', () => {
  assertThrowsCode(() => createReviver(null), 'INVALID_CONFIG');
  assertThrowsCode(() => createReviver(['a']), 'INVALID_CONFIG');
  assertThrowsCode(() => createReviver({ a: 'Date' }), 'INVALID_CONFIG');
  assertThrowsCode(() => createReviver({ 'a..b': 'PlainDate' }), 'INVALID_CONFIG');
  assertThrowsCode(() => reviveFields({}, { a: 'PlainDate', 'a.b': 'PlainDate' }), 'INVALID_CONFIG');
  assertThrowsCode(() => reviveFields({}, { 'a.b': 'PlainDate', a: 'PlainDate' }), 'INVALID_CONFIG');
});

test('fromLegacyDate and toLegacyDate', () => {
  assert.equal(fromLegacyDate(new Date('2026-11-02T06:30:00Z')).toString(), '2026-11-02T06:30:00Z');
  assert.equal(toLegacyDate(instant('2026-11-02T06:30:00.123456Z')).toISOString(), '2026-11-02T06:30:00.123Z');
  assert.equal(toLegacyDate(zoned('2026-11-02T14:30+08:00[Asia/Manila]')).toISOString(), '2026-11-02T06:30:00.000Z');
  assertThrowsCode(() => fromLegacyDate('2026-11-02'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => fromLegacyDate(new Date('nope')), 'INVALID_RANGE');
  assertThrowsCode(() => toLegacyDate(dateTime('2026-11-02T14:30')), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => toLegacyDate(date('2026-11-02')), 'UNSUPPORTED_TYPE');
});

test('toLegacyDate PlainDateTime message points to toZonedDateTime', () => {
  assert.throws(() => toLegacyDate(dateTime('2026-11-02T14:30')), /toZonedDateTime\(timeZone\)/);
});

test('fromInputValue for each input type', () => {
  assert.equal(fromInputValue('2026-11-02', 'date').toString(), '2026-11-02');
  assert.equal(fromInputValue('14:30', 'time').toString(), '14:30:00');
  assert.equal(fromInputValue('14:30:15.5', 'time').toString(), '14:30:15.5');
  assert.equal(fromInputValue('2026-11-02T14:30', 'datetime-local').toString(), '2026-11-02T14:30:00');
  assert.equal(fromInputValue('2026-11-02 14:30:15', 'datetime-local').toString(), '2026-11-02T14:30:15');
  assert.equal(fromInputValue('2026-11', 'month').toString(), '2026-11');
  assert.equal(fromInputValue('2026-W01', 'week').toString(), '2025-12-29');
  assert.equal(fromInputValue('2026-W53', 'week').toString(), '2026-12-28');
  assert.equal(fromInputValue({ type: 'date', value: '2026-11-02' }).toString(), '2026-11-02');
  assert.equal(fromInputValue({ value: '2026-11-02' }, 'date').toString(), '2026-11-02');
  assert.equal(fromInputValue({ type: 'date', value: '2026-11-02' }, 'date').toString(), '2026-11-02');
});

test('fromInputValue errors', () => {
  assertThrowsCode(() => fromInputValue('2026-11-02'), 'INVALID_CONFIG');
  assertThrowsCode(() => fromInputValue('2026-11-02', 'datetime'), 'INVALID_CONFIG');
  assertThrowsCode(() => fromInputValue({ type: 'text', value: '2026-11-02' }), 'INVALID_CONFIG');
  assertThrowsCode(() => fromInputValue({ type: 'date', value: '2026-11-02' }, 'month'), 'INVALID_CONFIG');
  assertThrowsCode(() => fromInputValue({ type: 'date' }), 'INVALID_CONFIG');
  assertThrowsCode(() => fromInputValue(null, 'date'), 'INVALID_CONFIG');
  assertThrowsCode(() => fromInputValue('11/02/2026', 'date'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026-02-30', 'date'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2pm', 'time'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('24:00', 'time'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026-11-02', 'datetime-local'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026-11-02T25:00', 'datetime-local'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026/11', 'month'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026-13', 'month'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026-45', 'week'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2026-W00', 'week'), 'PARSE_FAILED');
  assertThrowsCode(() => fromInputValue('2027-W53', 'week'), 'PARSE_FAILED');
});

test('toInputValue for each input type', () => {
  assert.equal(toInputValue(date('2026-11-02'), 'date'), '2026-11-02');
  assert.equal(toInputValue(time('14:30'), 'time'), '14:30');
  assert.equal(toInputValue(time('14:30:15'), 'time'), '14:30:15');
  assert.equal(toInputValue(time('14:30:00.250'), 'time'), '14:30:00.250');
  assert.equal(toInputValue(dateTime('2026-11-02T14:30'), 'datetime-local'), '2026-11-02T14:30');
  assert.equal(toInputValue(Temporal.PlainYearMonth.from('2026-11'), 'month'), '2026-11');
  assert.equal(toInputValue(date('2026-11-02'), 'week'), '2026-W45');
  assert.equal(toInputValue(date('2026-11-08'), 'week'), '2026-W45');
  assert.equal(toInputValue(date('2025-12-29'), 'week'), '2026-W01');
});

test('toInputValue errors', () => {
  assertThrowsCode(() => toInputValue(date('2026-11-02'), 'datetime'), 'INVALID_CONFIG');
  assertThrowsCode(() => toInputValue(dateTime('2026-11-02T14:30'), 'date'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => toInputValue('14:30', 'time'), 'UNSUPPORTED_TYPE');
  assertThrowsCode(() => toInputValue(date('0000-06-01'), 'date'), 'INVALID_RANGE');
});

test('round trip between input values and Temporal', () => {
  const cases = [
    ['date', '2026-11-02'],
    ['time', '08:15'],
    ['datetime-local', '2026-11-02T08:15'],
    ['month', '2026-11'],
    ['week', '2026-W45'],
  ];
  for (const [inputType, text] of cases) {
    assert.equal(toInputValue(fromInputValue(text, inputType), inputType), text);
  }
});
