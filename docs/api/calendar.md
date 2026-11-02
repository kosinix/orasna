# calendar

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
