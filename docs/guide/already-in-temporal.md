# Already in Temporal

orasna does not wrap features that Temporal already provides. Use these built-ins directly:

| Task | Built-in |
| --- | --- |
| Locale-aware display text | `value.toLocaleString(locale, options)` |
| Add a time to a date | `plainDate.toPlainDateTime(plainTime)` |
| Attach a time zone to a wall-clock time | `plainDateTime.toZonedDateTime(timeZone)` |
| Get the exact instant of a zoned time | `zonedDateTime.toInstant()` |
| Convert a legacy `Date` | `date.toTemporalInstant()` |
| Locale-aware duration text | `new Intl.DurationFormat(locale).format(duration)` |
