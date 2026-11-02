# compare

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

## Chainable `is()`

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
