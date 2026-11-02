# Recipes

## Overnight shift hours

```js
import { timeSpan, totalHours, sumDurations, formatClockDuration } from 'orasna';

const shifts = [
  { start: '22:00', end: '06:00' }, // crosses midnight
  { start: '14:00', end: '22:00' },
];
const durations = shifts.map((shift) =>
  timeSpan(Temporal.PlainTime.from(shift.start), Temporal.PlainTime.from(shift.end)),
);
const total = sumDurations(durations); // PT16H

totalHours(total); // 16
formatClockDuration(total, 'h:mm'); // '16:00'
```

## Attendance with `IntervalSet`

```js
import { Interval, IntervalSet } from 'orasna';

const day = Temporal.PlainDateTime.from('2026-11-02T00:00');
const timeIn = day.with({ hour: 8, minute: 15 });
const timeOut = day.with({ hour: 17 });

const schedule = IntervalSet.from([
  Interval.of(day.with({ hour: 8 }),  day.with({ hour: 12 })),
  Interval.of(day.with({ hour: 13 }), day.with({ hour: 17 })),
]);
const actual = Interval.of(timeIn, timeOut);

const rendered = schedule.intersection(actual).totalDuration();   // hours counted: PT7H45M
const undertime = schedule.subtract(actual).totalDuration();      // late + early-out: PT15M
```

## A leave request with `fromInclusiveDates` and `BusinessCalendar`

Leave forms ask for the first and last day. `fromInclusiveDates` turns those into a half-open interval, and the business calendar counts the days that are actually charged.

```js
import { Interval } from 'orasna';
import { BusinessCalendar } from 'orasna/business';

const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });

const leave = Interval.fromInclusiveDates(
  Temporal.PlainDate.from('2026-11-26'), // first day off (Thursday)
  Temporal.PlainDate.from('2026-12-02'), // last day off (Wednesday)
);

const chargedDays = [...calendar.workingDays(leave)]; // 2026-11-26, 11-27, 12-01, 12-02
const daysCharged = chargedDays.length; // 4: the weekend and the holiday are not charged
const backAtWork = calendar.nextWorkingDay(leave.lastDay()); // 2026-12-03
```

## Reviving an Express `req.body`

```js
import express from 'express';
import { reviveFields } from 'orasna/interop';
import { TemporalKitError } from 'orasna';

const leaveSchema = {
  'leave.first': 'PlainDate',
  'leave.last': 'PlainDate',
  'logs.*.timeIn': 'PlainTime',
  submittedAt: 'Instant',
};

const app = express();
app.use(express.json());

app.post('/leave', (req, res) => {
  let body;
  try {
    body = reviveFields(req.body, leaveSchema);
  } catch (error) {
    if (error instanceof TemporalKitError && error.code === 'PARSE_FAILED') {
      res.status(400).json({ error: `Invalid value at ${error.path}` });
      return;
    }
    throw error;
  }
  // body.leave.first is a Temporal.PlainDate; req.body is unchanged
  res.json({ first: body.leave.first, last: body.leave.last }); // serialized back via toJSON()
});
```

For `fetch`, use `JSON.parse(await response.text(), createReviver(schema))` or `reviveFields(await response.json(), schema)`.

## `mysql2` setup with `mysql2TypeCast`

MySQL renders `TIMESTAMP` columns in the connection's session time zone, so set that zone explicitly and pass the same zone to `mysql2TypeCast`.

```js
import mysql from 'mysql2/promise';
import { mysql2TypeCast, toMySQLDate, toMySQLTimestamp } from 'orasna/db';

const sessionTimeZone = '+08:00';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'app',
  database: 'hr',
  timezone: sessionTimeZone,
  typeCast: mysql2TypeCast({ timeAs: 'Duration', sessionTimeZone }),
});
pool.pool.on('connection', (connection) => {
  connection.query(`SET time_zone = '${sessionTimeZone}'`);
});

// Reading: DATE → PlainDate, DATETIME → PlainDateTime, TIMESTAMP → Instant, TIME → Duration
const [rows] = await pool.query('SELECT id, leave_date, created_at FROM leaves');

// Writing: convert Temporal values to column text before binding them
await pool.execute('INSERT INTO leaves (leave_date, created_at) VALUES (?, ?)', [
  toMySQLDate(Temporal.PlainDate.from('2026-11-02')),
  toMySQLTimestamp(Temporal.Now.instant(), sessionTimeZone),
]);
```

Pass `timeAs: 'PlainTime'` if your `TIME` columns hold times of day rather than elapsed time. Add `onSpecialValue: 'null'` if the database still contains zero dates.

## A unit test with `fixedClock`

```js
// invoice.js
export function isOverdue(invoice, clock) {
  return Temporal.PlainDate.compare(clock.today(), invoice.dueDate) > 0;
}
```

```js
// invoice.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedClock } from 'orasna';
import { isOverdue } from './invoice.js';

test('an invoice is overdue the day after its due date, in Manila time', () => {
  // 16:30 UTC on Nov 2 is already 00:30 on Nov 3 in Manila
  const clock = fixedClock('2026-11-02T16:30:00Z', 'Asia/Manila');
  const invoice = { dueDate: Temporal.PlainDate.from('2026-11-02') };

  assert.equal(isOverdue(invoice, clock), true);
});
```
