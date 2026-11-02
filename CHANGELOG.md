# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `compare`: chainable `is(value)` with `before`, `after`, `sameOrBefore`, `sameOrAfter`, `sameMomentAs`, and `between`, as another way to write the existing comparison functions. Exported from the root entry.

## [0.1.0] - 2026-11-02

### Added

- `compare`: `isBefore`, `isAfter`, `isSameOrBefore`, `isSameOrAfter`, `isSameMoment`, `isBetween` (with `bounds`), `earliest`, `latest`, `ascending`, and `descending`.
- `calendar`: `Weekday`, `startOf`, `startOfNext`, `lastDayOf`, `nextWeekday`, `previousWeekday`, and `nthWeekdayOfMonth`, with DST-safe starts of day for `ZonedDateTime`.
- `span`: `timeSpan` (overnight-aware), `elapsed`, `totalHours`, `totalMinutes`, `sumDurations`, and `formatClockDuration`.
- `format`: fixed-pattern `format`, strict `parse`, and reusable `compilePattern`, with locale-aware month, weekday, and AM/PM names and an internal cache of 100 patterns.
- `interval`: half-open `Interval` and normalized `IntervalSet` for `PlainDate`, `PlainDateTime`, `ZonedDateTime`, and `Instant`.
- `clock`: `systemClock`, `fixedClock`, `manualClock`, and `withTimeZone`.
- `business` (subpath only): `BusinessCalendar` with weekends, holidays, non-working days, extra working days, and working hours.
- `interop` (subpath only): schema-based JSON revival (`createReviver`, `reviveFields`), legacy `Date` conversion, and HTML input values.
- `db` (subpath only): MySQL and PostgreSQL column converters, `mysql2TypeCast`, and `registerPgTypeParsers`.
- Error classes `TemporalKitError`, `TemporalKitTypeError`, `TemporalKitParseError`, `TemporalKitRangeError`, `TemporalKitConfigError`, and `TemporalKitEnvironmentError`, each with a stable `code`.
- TypeScript declarations generated from JSDoc.
