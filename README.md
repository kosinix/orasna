# orasna

Zero-dependency helpers on top of the native JavaScript Temporal API: comparisons, formatting, intervals, spans, working days, clocks, and JSON/HTML/database interop.

## Why This Even Exists?

I asked AI how to make the Temporal API more productive. This is the result.

Written by two AI models, reviewed by a developer, and shipped as code you can use.


## Why Use It?

These are the main reasons, most important first.

### 1. Comparisons read like plain English

With plain Temporal, every comparison is `Temporal.X.compare(a, b)` checked against `0`, and you have to stop and work out which way the sign goes. orasna's `is()` lets you write the check the way you would say it.

```js
// Plain Temporal
if (Temporal.PlainDate.compare(submitted, due) > 0) { /* late */ }
if (Temporal.PlainTime.compare(clockIn, shiftStart) >= 0 && Temporal.PlainTime.compare(clockIn, shiftEnd) < 0) { /* on shift */ }
if (Temporal.ZonedDateTime.compare(manilaTime, utcTime) === 0) { /* same moment */ }

// orasna
if (is(submitted).after(due)) { /* late */ }
if (is(clockIn).between(shiftStart, shiftEnd)) { /* on shift */ }
if (is(manilaTime).sameMomentAs(utcTime)) { /* same moment */ }
```

`is(a)` also has `.before(b)`, `.sameOrBefore(b)`, and `.sameOrAfter(b)`. If you prefer plain functions, `isAfter(submitted, due)` and the others work too. See [compare](#compare).

### 2. It never guesses a time zone or a type

Most date bugs come from a hidden default, such as a server running in UTC while its users are in Manila. orasna has no default time zone and never infers a type. If a function needs a piece of information, it is a required argument, and leaving it out throws an error that tells you what to pass.

```js
systemClock(); // throws INVALID_CONFIG: systemClock() requires a time zone ID such as 'Asia/Manila' or 'UTC'

const clock = systemClock('Asia/Manila');
clock.today(); // today's date in Manila, even on a UTC server

parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'Instant'); // throws: needs an offset or time zone
parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'Instant', { timeZone: 'Asia/Manila' }); // 2026-11-02T06:30:00Z
```

### 3. Ranges that touch never overlap

Every interval is half-open, `[start, end)`: it includes its start and excludes its end. A 08:00–12:00 booking and a 12:00–13:00 booking touch without conflicting, and you never need a "23:59:59.999" end time.

```js
const day = Temporal.PlainDateTime.from('2026-11-02T00:00');
const booked = Interval.of(day.with({ hour: 8 }), day.with({ hour: 12 }));
const request = Interval.of(day.with({ hour: 12 }), day.with({ hour: 13 }));

booked.overlaps(request); // false: no double booking
booked.abuts(request); // true: they touch
booked.union(request).totalDuration(); // PT5H, merged into one 08:00–13:00 range
```

### 4. Mixed types fail loudly

A `PlainDate` (a calendar date) and a `ZonedDateTime` (an exact moment in a zone) mean different things, so comparing them throws instead of converting one silently. You choose the conversion, and the code says which one you chose.

```js
const deadline = Temporal.PlainDate.from('2026-11-02');
const submitted = Temporal.ZonedDateTime.from('2026-11-02T23:30[Asia/Manila]');

is(submitted).after(deadline); // throws TemporalKitTypeError (TYPE_MISMATCH)
is(submitted.toPlainDate()).after(deadline); // false: on time, judged by the Manila date
```

### 5. Nothing changes behind your back

No function mutates its arguments, and every object orasna creates is frozen. To change something, you get a new value, so a shared calendar or interval can't be altered by other code.

```js
const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });
const suspended = calendar.with({ nonWorkingDays: ['2026-11-03'] }); // a new calendar

calendar.isWorkingDay(Temporal.PlainDate.from('2026-11-03')); // true: the original is unchanged
suspended.isWorkingDay(Temporal.PlainDate.from('2026-11-03')); // false
Object.isFrozen(calendar); // true
```

## Contents

- [Why Use It?](#why-use-it)
- [Installation](#installation)
- [Quick start by module](#quick-start-by-module): [compare](#compare), [calendar](#calendar), [span](#span), [format](#format), [interval](#interval), [clock](#clock), [business](#business), [interop](#interop), [db](#db)
- [Recipes](#recipes)
- [Errors](#errors)
- [Already in Temporal](#already-in-temporal)
- [License](#license)

## Installation

Install it from npm:

```sh
npm install orasna
```

orasna needs a global `Temporal`. It does not bundle a polyfill, so the app decides whether to load one.

| Environment | What to do |
| --- | --- |
| Node.js 26+ | Nothing. Temporal is built in. |
| Chrome / Edge 144+, Firefox 139+ | Nothing. Temporal is built in. |
| Node.js 20, 22, 24 | Load a polyfill (below). |
| Safari and older browsers | Load a polyfill (below). |

To load a polyfill, install `temporal-polyfill` and import its global entry **once, before anything imports orasna**. For example, put it at the top of your app's entry file:

```sh
npm install temporal-polyfill
```

```js
// main.js: the first import in the app
import 'temporal-polyfill/global';
import { isBefore } from 'orasna';
```

If Temporal is missing when an orasna function runs, the function throws `TemporalKitEnvironmentError` with code `TEMPORAL_MISSING`.

**Imports.** The root entry exports `compare`, `calendar`, `span`, `format`, `interval`, `clock`, and the error classes. `business`, `interop`, and `db` are subpath-only, so apps that don't need them never load them:

```js
import { isBefore, Interval, fixedClock } from 'orasna';
import { BusinessCalendar } from 'orasna/business';
import { reviveFields } from 'orasna/interop';
import { mysql2TypeCast } from 'orasna/db';
```

Every module is also available on its own path, such as `orasna/compare`.

**TypeScript.** Type declarations ship with the package. They refer to the global `Temporal` namespace, so your project needs Temporal types: TypeScript 6 and later include them in `"lib": ["ESNext"]`, and `temporal-polyfill` ships its own.

### Using it directly in a browser

You don't need npm or a bundler to use orasna in a web page. The source is plain ES modules that import each other by relative path, so a browser can load it from a CDN or from your own server.

Add an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) so that `orasna` resolves to a URL. Your scripts can then use the same imports as Node code. The example below loads a pinned release from jsDelivr, which serves files straight from npm:

```html
<script type="importmap">
{
  "imports": {
    "orasna": "https://cdn.jsdelivr.net/npm/orasna@0.2.0/src/index.js",
    "orasna/business": "https://cdn.jsdelivr.net/npm/orasna@0.2.0/src/business.js",
    "orasna/interop": "https://cdn.jsdelivr.net/npm/orasna@0.2.0/src/interop.js"
  }
}
</script>

<input id="start-date" type="date" value="2026-11-27">
<p id="due"></p>

<script type="module">
  import { format } from 'orasna';
  import { fromInputValue } from 'orasna/interop';
  import { BusinessCalendar } from 'orasna/business';

  // Load the polyfill only in browsers without native Temporal, such as Safari
  if (globalThis.Temporal === undefined) {
    await import('https://cdn.jsdelivr.net/npm/temporal-polyfill@1.0.6/global.min.js');
  }

  const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });
  const input = document.querySelector('#start-date');

  function showDueDate() {
    const start = fromInputValue(input); // reads the input's type and value; null when empty
    if (start === null) {
      return;
    }
    const due = calendar.addWorkingDays(start, 5);
    document.querySelector('#due').textContent = `Due ${format(due, 'EEEE, d MMMM yyyy')}`;
  }

  input.addEventListener('change', showDueDate);
  showDueDate(); // "Due Monday, 7 December 2026"
</script>
```

Things to know:

- **Polyfill order.** Importing orasna before the polyfill loads is fine, because orasna only looks for `Temporal` when one of its functions runs. Do call functions only after the polyfill has loaded. In the example, the `await` ensures that.
- **Pin the version.** Keep `@0.2.0` (or another exact version) in every URL, so a new release can't change your page. Map only the subpaths you use. `orasna/db` is for servers and isn't needed in a browser.
- **Self-hosting.** To serve the files yourself, copy the contents of the repository's `src/` folder (including `internal/`) to your site, for example into `/vendor/orasna/`, and point the import map there: `"orasna": "/vendor/orasna/index.js"`. Do the same with `temporal-polyfill`'s `global.min.js` if you need it.
- **Serve over HTTP.** Browsers don't load ES modules from `file://` pages. Open the page through a web server, even a local one.

## Quick start by module

### compare

Readable comparisons in place of `Temporal.X.compare(a, b) > 0`, written either as functions (`isBefore(a, b)`) or as sentences with [`is(a).before(b)`](#chainable-is). Supported types are `PlainDate`, `PlainTime`, `PlainDateTime`, `PlainYearMonth`, `ZonedDateTime`, and `Instant`. Both arguments must be the same type.

```js
import { isBefore, isBetween, isSameMoment, latest, ascending } from 'orasna';

const due = Temporal.PlainDate.from('2026-11-06');
const submitted = Temporal.PlainDate.from('2026-11-05');

isBefore(submitted, due); // true
isBetween(Temporal.PlainTime.from('12:00'), Temporal.PlainTime.from('08:00'), Temporal.PlainTime.from('12:00')); // false: end excluded
isBetween(submitted, submitted, due, { bounds: '[]' }); // true; bounds: '[)' (default), '[]', '()', '(]'
latest(submitted, due); // 2026-11-06
[due, submitted].sort(ascending); // [2026-11-05, 2026-11-06]

// Two ZonedDateTimes in different zones can be the same moment
isSameMoment(
  Temporal.ZonedDateTime.from('2026-11-02T14:00[Asia/Manila]'),
  Temporal.ZonedDateTime.from('2026-11-02T06:00[UTC]'),
); // true
```

Also available: `isAfter`, `isSameOrBefore`, `isSameOrAfter`, `earliest`, and `descending`. `PlainMonthDay` cannot be compared because it has no order without a year.

#### Chainable `is()`

If you prefer comparisons that read like a sentence, wrap the first value in `is()`. This is an extra way to write the same checks; the functions above still work.

```js
import { is } from 'orasna';

is(submitted).before(due); // true, same as isBefore(submitted, due)

is(Temporal.PlainTime.from('12:00')).between(Temporal.PlainTime.from('08:00'), Temporal.PlainTime.from('12:00')); // false

is(Temporal.ZonedDateTime.from('2026-11-02T14:00[Asia/Manila]'))
  .sameMomentAs(Temporal.ZonedDateTime.from('2026-11-02T06:00[UTC]')); // true
```

| `is(a)` method | Same as |
| --- | --- |
| `.before(b)` | `isBefore(a, b)` |
| `.after(b)` | `isAfter(a, b)` |
| `.sameOrBefore(b)` | `isSameOrBefore(a, b)` |
| `.sameOrAfter(b)` | `isSameOrAfter(a, b)` |
| `.sameMomentAs(b)` | `isSameMoment(a, b)` |
| `.between(start, end, options?)` | `isBetween(a, start, end, options?)` |

Each method returns the same result and throws the same errors as its function. `is()` checks the wrapped value right away, so `is('2026-11-02')` throws `UNSUPPORTED_TYPE` before any method is called.

### calendar

Calendar navigation. There is no `endOf()`, because "23:59:59.999" bounds cause off-by-one bugs. Use `startOfNext()` as an exclusive end instead.

```js
import { Weekday, startOf, startOfNext, lastDayOf, nextWeekday, nthWeekdayOfMonth } from 'orasna';

const today = Temporal.PlainDate.from('2026-11-05');

startOf(today, 'week'); // 2026-11-02 (weeks start on Monday by default)
startOf(today, 'week', { weekStartsOn: Weekday.SUNDAY }); // 2026-11-01
startOfNext(today, 'month'); // 2026-12-01: use it as the exclusive end of November
lastDayOf(Temporal.PlainDate.from('2028-02-10'), 'month'); // 2028-02-29
nextWeekday(today, Weekday.FRIDAY); // 2026-11-06
nthWeekdayOfMonth(Temporal.PlainYearMonth.from('2026-11'), Weekday.MONDAY, -1); // 2026-11-30 (last Monday)
nthWeekdayOfMonth(Temporal.PlainYearMonth.from('2026-02'), Weekday.MONDAY, 5); // null

// For ZonedDateTime, startOf('day') handles days whose midnight is skipped by DST
startOf(Temporal.ZonedDateTime.from('2018-11-04T12:00[America/Sao_Paulo]'), 'day');
// 2018-11-04T01:00:00-02:00[America/Sao_Paulo]
```

Units are `'day'`, `'week'`, `'month'`, `'quarter'`, and `'year'`. `startOf` and `startOfNext` accept `PlainDate`, `PlainDateTime`, and `ZonedDateTime`, and return the same type.

### span

Durations from wall-clock times, including shifts that cross midnight.

```js
import { timeSpan, elapsed, totalHours, sumDurations, formatClockDuration } from 'orasna';

timeSpan(Temporal.PlainTime.from('22:00'), Temporal.PlainTime.from('06:00')); // PT8H (ends the next day)
timeSpan(Temporal.PlainTime.from('22:00'), Temporal.PlainTime.from('06:00'), { overnight: 'never' }); // throws INVALID_RANGE

// Exact elapsed time, counting DST changes
elapsed(
  Temporal.ZonedDateTime.from('2026-11-01T00:00[America/New_York]'),
  Temporal.ZonedDateTime.from('2026-11-01T04:00[America/New_York]'),
); // PT5H

totalHours(Temporal.Duration.from('PT7H45M')); // 7.75
sumDurations([Temporal.Duration.from('PT7H45M'), Temporal.Duration.from('PT8H30M')]); // PT16H15M
formatClockDuration(Temporal.Duration.from('PT27H5M'), 'h:mm'); // '27:05'
formatClockDuration(Temporal.Duration.from('-PT15M'), 'h:mm'); // '-0:15'
```

`totalHours`, `totalMinutes`, and `sumDurations` throw `NEEDS_REFERENCE_DATE` for durations that contain years, months, or weeks, because those units have no fixed length. For locale-aware duration text such as "7 hours, 45 minutes", use [`Intl.DurationFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat).

### format

Fixed-pattern formatting and strict parsing for machine formats, reports, CSV, and filenames. For display text, keep using `value.toLocaleString(locale, options)`.

```js
import { format, parse, compilePattern } from 'orasna';

format(Temporal.PlainDateTime.from('2026-11-02T14:05'), 'yyyy-MM-dd hh:mm a'); // '2026-11-02 02:05 PM'
format(Temporal.PlainDate.from('2026-11-02'), "EEEE, d MMMM yyyy", { locale: 'fr-FR' }); // 'lundi, 2 novembre 2026'
format(Temporal.PlainDateTime.from('2026-11-02T14:05'), "yyyyMMdd'T'HHmm"); // '20261102T1405'

parse('02/11/2026', 'dd/MM/yyyy', 'PlainDate'); // 2026-11-02
parse('2026-02-30', 'yyyy-MM-dd', 'PlainDate'); // throws PARSE_FAILED
parse('2026-11-02 14:30', 'yyyy-MM-dd HH:mm', 'Instant', { timeZone: 'Asia/Manila' }); // 2026-11-02T06:30:00Z

const csvDate = compilePattern('dd/MM/yyyy');
csvDate.format(Temporal.PlainDate.from('2026-11-02')); // '02/11/2026'
csvDate.parse('02/11/2026', 'PlainDate'); // 2026-11-02
```

| Token | Meaning | Example |
| --- | --- | --- |
| `yyyy` / `yy` | Year, 4 or 2 digits | 2026 / 26 |
| `M` / `MM` | Month number | 3 / 03 |
| `MMM` / `MMMM` | Month name, locale-aware | Nov / November |
| `d` / `dd` | Day of month | 2 / 02 |
| `EEE` / `EEEE` | Weekday name, locale-aware | Mon / Monday |
| `H` / `HH` | Hour 0–23 | 9 / 09 |
| `h` / `hh` | Hour 1–12 | 9 / 09 |
| `a` | AM/PM marker, locale-aware | PM |
| `m` / `mm`, `s` / `ss` | Minute, second | 5 / 05 |
| `SSS` | Milliseconds | 042 |
| `XXX` | UTC offset | +08:00 |
| `VV` | Time zone ID | Asia/Manila |
| `'text'` | Literal text; `''` is a single quote | `'T'` |

Rules:

- Numbers always use ASCII digits. Names default to the `'en-US'` locale.
- A token the value cannot supply throws. For example, `HH` on a `PlainDate` has no hour to print.
- An `Instant` is formatted in UTC.
- When parsing, the whole string must match. Names match case-insensitively, but literal text must match exactly. Fields are validated strictly.
- Parsing to `ZonedDateTime` needs `VV` in the pattern or the `timeZone` option. Parsing to `Instant` needs `XXX`, `VV`, or the `timeZone` option.
- `yy` parses as `twoDigitYearBase + yy`; the default base is 2000.

### interval

A half-open `[start, end)` range of `PlainDate`, `PlainDateTime`, `ZonedDateTime`, or `Instant` values, plus `IntervalSet`, a normalized set of ranges.

```js
import { Interval, IntervalSet } from 'orasna';

const day = Temporal.PlainDateTime.from('2026-11-02T00:00');
const morning = Interval.of(day.with({ hour: 8 }), day.with({ hour: 12 }));
const lunch = Interval.of(day.with({ hour: 12 }), day.with({ hour: 13 }));

morning.overlaps(lunch); // false: adjacent intervals do not overlap
morning.abuts(lunch); // true
morning.contains(day.with({ hour: 12 })); // false: end is excluded
morning.union(lunch).intervals.length; // 1 (merged)
morning.duration(); // PT4H

const leave = Interval.fromInclusiveDates(Temporal.PlainDate.from('2026-11-02'), Temporal.PlainDate.from('2026-11-06'));
leave.duration(); // P5D
leave.lastDay(); // 2026-11-06: the inclusive end, for display
String(leave); // '2026-11-02/2026-11-07'
Interval.parse('2026-11-02/2026-11-07', 'PlainDate');
```

`IntervalSet.from()` sorts its intervals and merges any that overlap or touch. It supports `contains`, `union`, `intersection`, `subtract`, `gaps(within)`, `totalDuration()`, and iteration. See the [attendance recipe](#attendance-with-intervalset).

### clock

An injectable clock that carries the app's time zone, so code that needs "now" is testable without mocking globals. No other orasna module reads `Temporal.Now`; functions that need "now" take a `Clock` argument.

Production setup: create one clock for the app and pass it to code that needs the current time.

```js
// clock.js
import { systemClock } from 'orasna';

// The zone is required: servers often run in UTC while users do not.
export const clock = systemClock('Asia/Manila');
```

```js
import { clock } from './clock.js';

export function isOverdue(invoice, currentClock = clock) {
  return Temporal.PlainDate.compare(currentClock.today(), invoice.dueDate) > 0;
}
```

A clock has `timeZoneId`, `instant()`, `now()` (a `ZonedDateTime`), `today()`, `time()`, and `dateTime()`. For tests, use `fixedClock(at, zone)` or `manualClock(start, zone)`, which adds `advance(duration)` and `set(instant)`. `withTimeZone(clock, zone)` reads the same time but reports it in another zone. See the [unit test recipe](#a-unit-test-with-fixedclock).

### business

Working-day arithmetic with rules your organization supplies. The package ships no holiday data.

```js
import { BusinessCalendar } from 'orasna/business';

const calendar = new BusinessCalendar({
  weekend: [6, 7], // ISO weekdays; this is the default (Saturday, Sunday)
  holidays: ['2026-11-30', '2026-12-25'],
  nonWorkingDays: ['2026-11-03'], // suspensions and closures
  extraWorkingDays: ['2026-11-07'], // a make-up Saturday
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
});

calendar.isWorkingDay(Temporal.PlainDate.from('2026-11-07')); // true (extra working day)
calendar.addWorkingDays(Temporal.PlainDate.from('2026-11-27'), 1); // 2026-12-01 (skips the weekend and the holiday)
calendar.workingDaysBetween(Temporal.PlainDate.from('2026-11-09'), Temporal.PlainDate.from('2026-11-16')); // 5, counted over [start, end)
calendar.workingDurationBetween(
  Temporal.PlainDateTime.from('2026-11-09T10:00'),
  Temporal.PlainDateTime.from('2026-11-10T10:00'),
); // PT8H

const withSuspension = calendar.with({ nonWorkingDays: ['2026-11-03', '2026-11-04'] }); // a new calendar
```

When rules conflict, `extraWorkingDays` wins over `holidays` and `nonWorkingDays`, which win over `weekend`. Searches for a working day stop after 3,660 days and throw, so a bad configuration cannot hang a server.

### interop

Conversion to and from JSON, legacy `Date`, and HTML inputs. Nothing here touches the DOM, so it also works in Node.

```js
import { createReviver, reviveFields, fromLegacyDate, toLegacyDate, fromInputValue, toInputValue } from 'orasna/interop';

// JSON: Temporal values already serialize via toJSON(); revival uses a schema
const schema = { createdAt: 'Instant', 'leave.start': 'PlainDate', 'logs.*.timeIn': 'PlainTime' };
const body = JSON.parse(text, createReviver(schema));

// Legacy Date
fromLegacyDate(new Date()); // Temporal.Instant
toLegacyDate(Temporal.Instant.from('2026-11-02T06:30:00Z')); // Date (sub-millisecond precision is dropped)

// HTML inputs
fromInputValue('2026-W45', 'week'); // 2026-11-02 (Monday of the ISO week)
fromInputValue(form.elements.startDate); // reads .type and .value from the element
fromInputValue(''); // null
toInputValue(Temporal.PlainTime.from('14:30'), 'time'); // '14:30'
```

Schema keys are dotted paths, and `'*'` matches every item of an array. Unlisted keys are left alone, and `null` values stay `null`. An invalid string throws `TemporalKitParseError`, and its `path` property names the failing field, such as `logs.1.timeIn`.

| Input type | Temporal type | `toInputValue` output |
| --- | --- | --- |
| `date` | `PlainDate` | `2026-11-02` |
| `time` | `PlainTime` | `14:30`, or `14:30:15` when seconds are nonzero |
| `datetime-local` | `PlainDateTime` | `2026-11-02T14:30` |
| `month` | `PlainYearMonth` | `2026-11` |
| `week` | `PlainDate` (Monday of the ISO week) | `2026-W45` |

`toLegacyDate` rejects `PlainDateTime` because it has no time zone; call `toZonedDateTime(timeZone)` on it first.

### db

String-level converters for MySQL and PostgreSQL column text, plus driver hooks. orasna never imports a driver; you pass yours in. Convert Temporal values with the `to*` functions before you bind them as query parameters.

```js
import { fromPgTimestamptz, toMySQLDateTime, fromMySQLTime, registerPgTypeParsers } from 'orasna/db';

fromPgTimestamptz('2026-11-02 14:30:00+08'); // 2026-11-02T06:30:00Z
fromMySQLTime('838:59:59', { as: 'Duration' }); // PT838H59M59S
toMySQLDateTime(Temporal.PlainDateTime.from('2026-11-02T14:30:00.123'), { fractionalDigits: 3 }); // '2026-11-02 14:30:00.123'

import pg from 'pg';
registerPgTypeParsers(pg.types); // date, time, timestamp, timestamptz come back as Temporal values
```

| Column type | Temporal type | Functions |
| --- | --- | --- |
| MySQL `DATE` | `PlainDate` | `fromMySQLDate`, `toMySQLDate` |
| MySQL `DATETIME` | `PlainDateTime` | `fromMySQLDateTime`, `toMySQLDateTime` |
| MySQL `TIMESTAMP` | `Instant` | `fromMySQLTimestamp`, `toMySQLTimestamp` (session time zone required) |
| MySQL `TIME` | `PlainTime` or `Duration` | `fromMySQLTime` (with `{ as }`), `toMySQLTime` |
| PostgreSQL `date` | `PlainDate` | `fromPgDate`, `toPgDate` |
| PostgreSQL `time` | `PlainTime` | `fromPgTime`, `toPgTime` |
| PostgreSQL `timestamp` | `PlainDateTime` | `fromPgTimestamp`, `toPgTimestamp` |
| PostgreSQL `timestamptz` | `Instant` | `fromPgTimestamptz`, `toPgTimestamptz` |

MySQL zero dates (`0000-00-00`) and PostgreSQL `infinity` throw by default. Pass `{ onSpecialValue: 'null' }` to read them as `null`. PostgreSQL output must use the default `DateStyle` (`ISO`).

## Recipes

### Overnight shift hours

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

### Attendance with `IntervalSet`

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

### A leave request with `fromInclusiveDates` and `BusinessCalendar`

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

### Reviving an Express `req.body`

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

### `mysql2` setup with `mysql2TypeCast`

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

### A unit test with `fixedClock`

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

## Errors

All errors extend `TemporalKitError` and carry a stable `code` string. The classes are exported from the root entry.

| Class | Codes | Thrown when |
| --- | --- | --- |
| `TemporalKitTypeError` | `TYPE_MISMATCH`, `UNSUPPORTED_TYPE` | Temporal types are mixed, or a type is not supported |
| `TemporalKitParseError` | `PARSE_FAILED` | Input does not match the pattern, schema path, or column format; has `input` and `pattern` or `path` |
| `TemporalKitRangeError` | `INVALID_RANGE`, `NEEDS_REFERENCE_DATE` | An interval ends before it starts; calendar units need a reference date |
| `TemporalKitConfigError` | `INVALID_CONFIG` | Options or arguments are invalid, such as a business calendar with no working days |
| `TemporalKitEnvironmentError` | `TEMPORAL_MISSING` | There is no `globalThis.Temporal` |

## Already in Temporal

orasna does not wrap features that Temporal already provides. Use these built-ins directly:

| Task | Built-in |
| --- | --- |
| Locale-aware display text | `value.toLocaleString(locale, options)` |
| Add a time to a date | `plainDate.toPlainDateTime(plainTime)` |
| Attach a time zone to a wall-clock time | `plainDateTime.toZonedDateTime(timeZone)` |
| Get the exact instant of a zoned time | `zonedDateTime.toInstant()` |
| Convert a legacy `Date` | `date.toTemporalInstant()` |
| Locale-aware duration text | `new Intl.DurationFormat(locale).format(duration)` |

## License

[MIT](LICENSE)
