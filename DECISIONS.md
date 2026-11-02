# Decisions

This file records each choice made where `SPEC.md` was silent or could not be followed literally. Each entry gives the choice and the reason for it.

## Project and tooling

1. **The package is named `orasna` and distributed from GitHub, not npm.** The spec's working name, `temporal-kit`, belongs to an unrelated npm package (version 0.3.3 as of 2026-11-02), so the owner renamed the package to `orasna` and hosts it at `github.com/kosinix/orasna`. Apps install with `npm install github:kosinix/orasna#v0.1.0` and import `orasna`. `package.json` sets `"private": true` so the package cannot be published to npm by accident. The error classes keep their spec names (`TemporalKitError` and the rest).
   - `prepublishOnly` became a plain `check` script (`npm run types && npm test`). It has no lifecycle hook on purpose: npm runs `prepare` and `prepack` when a consumer installs from GitHub, which would make every install fetch TypeScript and the polyfill and run the tests. The package has no lifecycle scripts, so consumers get the committed `src/` and `types/` as they are. Run `npm run check` and commit `types/` before tagging a release.
2. **The test script uses a glob instead of a directory.** The spec's `node --test --import ./test/setup.js test/` fails on Node 22 with `ERR_UNSUPPORTED_DIR_IMPORT`. The script is `node --test --import ./test/setup.js "test/**/*.test.js"`. Node expands the quoted glob itself, so the script also works on Windows shells. `test/helpers.js` and `test/setup.js` do not match the glob, so they are not run as tests.
3. **There is an extra internal file, `src/internal/validate.js`.** It holds the option and argument checks shared by every module, such as weekday, integer, time zone, and options-object checks. `temporal.js` keeps to the Temporal accessor and type detection.
4. **Pinned dev dependencies:** `typescript@7.0.2` and `temporal-polyfill@1.0.6`. TypeScript 7's `ESNext` lib already declares the global `Temporal` namespace, so `tsconfig.json` uses `"lib": ["ESNext"]` and does not need the polyfill's types. The generated `.d.ts` files reference the global `Temporal` namespace, so consumers need Temporal types from TypeScript 6+ `ESNext` or from `temporal-polyfill`.
5. **There is a `test:coverage` script.** It runs `node --test --experimental-test-coverage` and excludes `test/**`. Line coverage was 99.89% under the polyfill.
6. **CI** is defined in `.github/workflows/ci.yml`. The Node 26 job asserts that Temporal is native, regenerates the types and fails if they differ from the committed ones, then runs the tests with coverage. The Node 22 job asserts that Temporal is not native, runs the tests with the polyfill, and runs `npm pack --dry-run`. Only the polyfill run could be done locally, on Node 22.18.
7. **The package is MIT-licensed.** The spec's `package.json` has no `license` field; the owner chose MIT, so `package.json` has `"license": "MIT"` and the root has a `LICENSE` file. npm always includes `LICENSE` in the package, so `npm pack` lists it in addition to the files in section 5 of the spec.
8. **Validation helpers call `getTemporal()` first.** Every public function and constructor reaches `getTemporal()` before any other check. Without Temporal, the result is always `TEMPORAL_MISSING`, never a misleading type or option error. `test/environment.test.js` checks one function from each module.

## Errors

9. **Invalid non-Temporal arguments throw `TemporalKitConfigError` (`INVALID_CONFIG`).** Examples are an unknown unit, a bad option value, a non-integer `n`, calling `earliest()` with no values, an unknown time zone ID, or a schema type that does not exist. The spec lists `INVALID_CONFIG` for "bad options", and this extends it to every bad non-Temporal argument.
10. **`UNSUPPORTED_TYPE` versus `TYPE_MISMATCH`.** When a value is not a Temporal object, or is a Temporal type the function does not accept, the error is `UNSUPPORTED_TYPE`. `TYPE_MISMATCH` is used only when every argument is an accepted type but the types differ, as in `isBefore(PlainDate, PlainDateTime)`. For example, `timeSpan(PlainTime, PlainDateTime)` throws `UNSUPPORTED_TYPE`, because `timeSpan` never accepts `PlainDateTime`.
11. **Error classes are exported from the root entry only.** Subpath modules (`business`, `interop`, `db`) throw the same classes. Code that only loads a subpath can branch on `error.code` without importing the root.
12. **A pattern that cannot produce the requested type throws `INVALID_CONFIG`, not `PARSE_FAILED`.** Examples are `parse(text, 'yyyy-MM', 'PlainDate')`, which has no day, and `'h:mm'` without `'a'`. The problem is in the code, not the input. `PARSE_FAILED` is kept for input that does not match a valid pattern.
13. **Special database values throw `PARSE_FAILED`.** MySQL zero dates and PostgreSQL `infinity` are column text that has no Temporal equivalent, so they are treated as parse failures. The message suggests `{ onSpecialValue: 'null' }`.

## compare

14. **Ties.** `earliest` and `latest` return the first of several equal values.
14a. **Chainable `is(value)`.** Added after the spec, at the owner's request, as an addition to the comparison functions rather than a replacement.
    - The methods are `before`, `after`, `sameOrBefore`, `sameOrAfter`, `sameMomentAs`, and `between`. They share their implementation with the matching `is*` functions, so results and error codes are identical. The `sameMomentAs` name reads as a sentence where `sameMoment` would not.
    - `is()` validates the wrapped value immediately, so an unsupported value fails at `is(x)` rather than at the method call.
    - The returned object is frozen and also exposes the wrapped value as `value`, which helps when debugging.
    - Error messages name the method, such as `is(value).before()`, so a stack trace points to the right call.
    - It does not chain further: each method returns a boolean. Combine checks with `&&`.

## calendar

15. **Quarters and names follow the ISO calendar.** Quarters are months 1–3, 4–6, 7–9, and 10–12, read from the value's `month` field. The package assumes ISO 8601 calendar values throughout. `business` and `db` convert values with `withCalendar('iso8601')`.
16. **Every `ZonedDateTime` start goes through `startOfDay()`.** For `startOf(zdt, 'day')`, the result is `zdt.startOfDay()`, as the spec requires. For the other units, and for `startOfNext`, the start date is computed on the `PlainDate` first, then converted with `date.toZonedDateTime(zone).startOfDay()`. A week or month that starts on a day without a midnight therefore starts at that day's first valid instant.
17. **`startOfNext` is calculated on dates, not by adding to a `ZonedDateTime`.** This keeps results DST-safe.

## span

18. **`elapsed` may be negative.** When `end` is before `start`, the result is a negative duration rather than an error, matching `until()`.
19. **Days count as 24 hours.** `totalHours`, `totalMinutes`, `sumDurations`, and `formatClockDuration` treat days as 24 hours, as Temporal does without `relativeTo`. Years, months, and weeks still throw `NEEDS_REFERENCE_DATE`.
20. **`formatClockDuration` truncates toward zero.** Units smaller than the pattern shows are truncated, the way a stopwatch displays time. For example, `PT59.9S` with `'h:mm'` is `'0:00'`.
21. **`sumDurations` validates its input.** A non-array throws `INVALID_CONFIG`, and an empty list returns `PT0S`.

## format

22. **The default locale is `'en-US'`, not the runtime default.** The module is for machine formats, filenames, and CSV, where output must not change with the server's locale. The spec's acceptance case, `'PM'` with no locale, matches this choice.
23. **An `Instant` is formatted in UTC.** `XXX` prints `+00:00`. `VV` throws because an `Instant` has no time zone ID. This matches `Instant.prototype.toString()`, so no zone is guessed.
24. **`PlainMonthDay` is supported** by `format` and `parse` with the month and day tokens.
25. **Locale names come from `Intl.DateTimeFormat`.** Month and weekday names are the stand-alone forms that `Intl.DateTimeFormat` gives for `{ month }` or `{ weekday }`. AM/PM markers are the `dayPeriod` parts of a 12-hour format. If a locale gives no `dayPeriod`, the markers fall back to `AM` and `PM`.
26. **Parsing defaults and requirements.**
    - A missing minute, second, or millisecond defaults to 0.
    - A missing hour, or a missing year, month, or day, throws `INVALID_CONFIG` when the target type needs it.
    - A repeated field must hold the same value every time. For example, `yyyy` twice with different years throws `PARSE_FAILED`. So do `H` and `h a` with different hours.
    - A weekday name (`EEE`, `EEEE`) is checked against the parsed date.
27. **Case sensitivity.** Names match case-insensitively, but literal text matches exactly, so `'T'` does not match `t`.
28. **Numeric widths.** `yyyy` matches exactly 4 digits; `MM`, `dd`, `HH`, `hh`, `mm`, `ss`, and `yy` match exactly 2; `M`, `d`, `H`, `h`, `m`, and `s` match 1 or 2; `SSS` matches 3.
29. **Offsets and time zones in `parse`.**
    - `XXX` parses `±HH:MM` and `±HH:MM:SS`. It does not parse `Z`, because `format` never prints `Z`.
    - For `ZonedDateTime`, a `VV` in the text takes precedence over the `timeZone` option. If `XXX` is also present, it must agree with the zone (`offset: 'reject'`).
    - For `Instant`, the order of precedence is `XXX`, then `VV`, then the `timeZone` option.
    - A wall-clock time with no offset that is ambiguous or skipped because of DST uses Temporal's default disambiguation, `'compatible'`.
30. **Pattern cache.** The cache holds up to 100 compiled patterns and evicts the oldest-inserted pattern first. `format` and `parse` also accept a `CompiledPattern`, which has its own `format()` and `parse()` methods.
31. **Other checks.** `format` throws `INVALID_CONFIG` for a locale that is not a valid BCP 47 tag. The pattern tokenizer throws `INVALID_CONFIG` for unknown letter runs, such as `YYYY` or `DD`, and for unterminated quotes.

## interval

32. **`PlainTime` intervals are not supported.** The spec limits `Interval<T>` to `PlainDate`, `PlainDateTime`, `ZonedDateTime`, and `Instant`, and times of day cannot express ranges that cross midnight. The acceptance case "`[08:00, 12:00)` vs `[12:00, 13:00)`" is tested with `PlainDateTime` values on one day, as in the attendance example.
33. **Empty intervals.** An empty interval overlaps nothing and contains nothing. `IntervalSet.from()` drops empty intervals. `lastDay()` on an empty `PlainDate` interval throws `INVALID_RANGE`, because the interval has no days.
34. **`Interval.parse` reads only the `start/end` form.** ISO 8601 `start/duration` and `duration/end` forms throw `PARSE_FAILED`. A slash inside a bracketed zone, as in `[America/New_York]`, is not treated as the separator.
35. **`ZonedDateTime` intervals compare by instant**, like `ZonedDateTime.compare`. Results keep the original endpoint objects, including their zones.
36. **`IntervalSet.toJSON()`** returns an array of `'start/end'` strings. The spec gives `toJSON` only for `Interval`; this makes `JSON.stringify` work on sets too.
37. **Private constructors.** The `Interval`, `IntervalSet`, and `CompiledPattern` constructors require a private key and throw `INVALID_CONFIG` when called directly. Use the static factories or `compilePattern()`.

## clock

38. **`manualClock().advance()` adds in the clock's time zone.** `advance({ days: 1 })` keeps the wall-clock time across DST changes, and `{ hours: 24 }` adds exact time. Calendar units are allowed for the same reason. `Instant.prototype.add` would reject days and larger units.
39. **Time zone IDs are canonicalized.** For example, `'asia/manila'` becomes `'Asia/Manila'`. An unknown ID throws `INVALID_CONFIG` when the clock is created, not on first use.
40. **Instant strings must include an offset.** `fixedClock`, `manualClock`, and `set()` accept an `Instant` or an ISO string with an offset. A string without one, such as `'2026-11-02T00:30'`, throws `PARSE_FAILED`, because applying a zone to it would be a guess.

## business

41. **Working hours.** Each window must end after it starts; windows cannot cross midnight. Windows may not overlap, but they may touch. They are sorted when the calendar is built. `PlainTime` values are accepted as well as `'HH:mm'` strings.
42. **Date strings.** Date strings in `holidays`, `nonWorkingDays`, and `extraWorkingDays` must be exactly `YYYY-MM-DD` and must be real dates. Otherwise they throw `PARSE_FAILED`, with a `path` such as `holidays[2]`.
43. **A seven-day weekend always throws.** It throws even when `extraWorkingDays` would make some dates working days, following the spec's rule that some weekday must be able to be a working day.
44. **Reversed ranges.** `workingDaysBetween` and `workingDurationBetween` return negative results when `end` is before `start`, consistent with `elapsed`.
45. **`addWorkingDays` from a non-working day.** From a non-working day, `n = 1` returns the next working day. `n = 0` returns the date unchanged, as the spec says, even when it is not a working day.
46. **The search limit throws `INVALID_CONFIG`.** It triggers when a search exceeds 3,660 days, because the cause is configuration that leaves no working days.
47. **`with()` replaces whole lists.** `calendar.with({ holidays: [...] })` replaces the holidays and does not merge them.
48. **`workingDurationBetween` returns a balanced duration.** It is balanced to `largestUnit: 'hour'`, like `elapsed`.

## interop

49. **How the reviver finds the root.** `createReviver` revives everything on the root call of `JSON.parse`, which comes last with key `''`. It recognizes that call because the holder object's only key is `''`. A nested object whose only key is `''` is the one shape it cannot tell apart from the root.
50. **Schema paths.**
    - `'*'` matches array items only, as the spec says.
    - A numeric segment, such as `'list.0'`, matches one array index.
    - A path may not go inside another path that is already a Temporal value; that throws `INVALID_CONFIG`.
    - Every Temporal type name, including `Duration` and `PlainMonthDay`, is accepted.
51. **What is revived.** `null`, `undefined`, and values that are already the target Temporal type are left as they are. Any other non-string throws `PARSE_FAILED`, naming the path.
52. **`reviveFields` does not mutate its input.** It copies only the objects and arrays along schema paths, and untouched branches are shared. Keys are written with `defineProperty`, so a key named `__proto__` cannot change an object's prototype.
53. **`fromLegacyDate` errors.** An Invalid Date throws `INVALID_RANGE`; a value that is not a `Date` throws `UNSUPPORTED_TYPE`.
54. **`toLegacyDate` uses `epochMilliseconds`.** That rounds toward negative infinity, so pre-1970 instants with sub-millisecond parts move to the earlier millisecond, the same as Temporal does.
55. **`fromInputValue` sources.**
    - `fromInputValue('')` returns `null` even without a type, as the acceptance case requires.
    - Any other string needs a type.
    - A `{ type, value }` source may also be given an explicit `type`; if the two disagree, it throws `INVALID_CONFIG`.
    - A `datetime-local` value may use a space instead of `T`, as HTML parsing allows.
    - A week that does not exist, such as `2027-W53`, throws `PARSE_FAILED`.
56. **`toInputValue` output.**
    - A `time` value includes `.SSS` when milliseconds are nonzero, and drops sub-millisecond precision. HTML inputs accept milliseconds.
    - Years before 0001 throw `INVALID_RANGE`, because HTML inputs cannot represent them.

## db

57. **Zero dates.** A MySQL zero date is any `DATE` or `DATETIME` whose month or day is `00`, including `0000-00-00`, because MySQL can store partial zero dates.
58. **`toMySQLDateTime` precision.** `fractionalDigits` defaults to 0, matching a plain `DATETIME` column, and truncates rather than rounds. `toMySQLTimestamp` accepts the same option as a third argument.
59. **`fromMySQLTimestamp` disambiguation.** Wall-clock times that DST makes ambiguous or skipped use Temporal's `'compatible'` disambiguation. MySQL itself cannot tell those times apart in a session zone.
60. **MySQL `TIME` as `Duration`.** Durations are limited to `-838:59:59` through `838:59:59`, and minutes and seconds must be 59 or less. `toMySQLTime` writes fractional seconds only when nonzero, up to microseconds, and throws `INVALID_RANGE` outside the column's range.
61. **PostgreSQL limits.** BC dates (`... BC`) are not supported and throw `PARSE_FAILED`. `toPgDate` and `toPgTimestamp` reject years before 0001. PostgreSQL's `24:00:00` has no `PlainTime` equivalent and throws `PARSE_FAILED`.
62. **PostgreSQL offsets.** `fromPgTimestamptz` also accepts offsets with seconds, such as `+05:53:28`, which PostgreSQL prints for historical zones. `toPgTimestamptz` writes UTC with an explicit `+00:00`.
63. **Driver hooks.**
    - `mysql2TypeCast` handles the `mysql2` field types `DATE`, `NEWDATE`, `DATETIME`, `DATETIME2`, `TIMESTAMP`, `TIMESTAMP2`, `TIME`, and `TIME2`.
    - `mysql2TypeCast` and `registerPgTypeParsers` both accept `onSpecialValue`, which they pass to the converters.
    - `registerPgTypeParsers` accepts only `timeAs: 'PlainTime'`, because PostgreSQL `time` is always a time of day.
