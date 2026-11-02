# clock

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

A clock has `timeZoneId`, `instant()`, `now()` (a `ZonedDateTime`), `today()`, `time()`, and `dateTime()`. For tests, use `fixedClock(at, zone)` or `manualClock(start, zone)`, which adds `advance(duration)` and `set(instant)`. `withTimeZone(clock, zone)` reads the same time but reports it in another zone. See the [unit test recipe](/guide/recipes#a-unit-test-with-fixedclock).
