# Why orasna

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

`is(a)` also has `.before(b)`, `.sameOrBefore(b)`, and `.sameOrAfter(b)`. If you prefer plain functions, `isAfter(submitted, due)` and the others work too. See [compare](/api/compare).

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
