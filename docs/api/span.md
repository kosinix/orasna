# span

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
