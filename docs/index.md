---
layout: home

hero:
  name: orasna
  text: Temporal, made productive
  tagline: Zero-dependency helpers on top of the native JavaScript Temporal API — comparisons, formatting, intervals, spans, working days, clocks, and JSON/HTML/database interop.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Why orasna?
      link: /guide/why
    - theme: alt
      text: View on GitHub
      link: https://github.com/kosinix/orasna

features:
  - title: Comparisons read like plain English
    details: "is(submitted).after(due) instead of checking the sign of Temporal.PlainDate.compare()."
    link: /api/compare
  - title: Never guesses a time zone or a type
    details: No hidden defaults. Missing information is a required argument, and leaving it out throws an error that tells you what to pass.
    link: /api/clock
  - title: Ranges that touch never overlap
    details: Every interval is half-open, [start, end). No more 23:59:59.999 end times.
    link: /api/interval
  - title: Mixed types fail loudly
    details: Comparing a PlainDate with a ZonedDateTime throws instead of converting silently. You choose the conversion.
    link: /guide/errors
  - title: Nothing changes behind your back
    details: No function mutates its arguments, and every object orasna creates is frozen.
    link: /guide/why
  - title: Working days, databases, and HTML inputs
    details: Business calendars with your own holidays, MySQL and PostgreSQL converters, and form input interop.
    link: /api/business
---
