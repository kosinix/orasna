# interval

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

`IntervalSet.from()` sorts its intervals and merges any that overlap or touch. It supports `contains`, `union`, `intersection`, `subtract`, `gaps(within)`, `totalDuration()`, and iteration. See the [attendance recipe](/guide/recipes#attendance-with-intervalset).
