# interop

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
