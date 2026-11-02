# business

Working-day arithmetic with rules your organization supplies. The package ships no holiday data.

```js
import { BusinessCalendar } from 'orasna/business';

const calendar = new BusinessCalendar({
  weekend: [6, 7], // ISO weekdays; this is the default (Saturday, Sunday)
  holidays: ['2026-11-30', '2026-12-25'],
  nonWorkingDays: ['2026-11-03'], // suspensions and closures
  extraWorkingDays: ['2026-11-07'], // a make-up Saturday
  workingHours: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
});

calendar.isWorkingDay(Temporal.PlainDate.from('2026-11-07')); // true (extra working day)
calendar.addWorkingDays(Temporal.PlainDate.from('2026-11-27'), 1); // 2026-12-01 (skips the weekend and the holiday)
calendar.workingDaysBetween(Temporal.PlainDate.from('2026-11-09'), Temporal.PlainDate.from('2026-11-16')); // 5, counted over [start, end)
calendar.workingDurationBetween(
  Temporal.PlainDateTime.from('2026-11-09T10:00'),
  Temporal.PlainDateTime.from('2026-11-10T10:00'),
); // PT8H

const withSuspension = calendar.with({ nonWorkingDays: ['2026-11-03', '2026-11-04'] }); // a new calendar
```

When rules conflict, `extraWorkingDays` wins over `holidays` and `nonWorkingDays`, which win over `weekend`. Searches for a working day stop after 3,660 days and throw, so a bad configuration cannot hang a server.
