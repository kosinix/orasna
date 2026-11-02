# format

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
