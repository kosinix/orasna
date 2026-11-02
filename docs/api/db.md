# db

String-level converters for MySQL and PostgreSQL column text, plus driver hooks. orasna never imports a driver; you pass yours in. Convert Temporal values with the `to*` functions before you bind them as query parameters.

```js
import { fromPgTimestamptz, toMySQLDateTime, fromMySQLTime, registerPgTypeParsers } from 'orasna/db';

fromPgTimestamptz('2026-11-02 14:30:00+08'); // 2026-11-02T06:30:00Z
fromMySQLTime('838:59:59', { as: 'Duration' }); // PT838H59M59S
toMySQLDateTime(Temporal.PlainDateTime.from('2026-11-02T14:30:00.123'), { fractionalDigits: 3 }); // '2026-11-02 14:30:00.123'

import pg from 'pg';
registerPgTypeParsers(pg.types); // date, time, timestamp, timestamptz come back as Temporal values
```

| Column type | Temporal type | Functions |
| --- | --- | --- |
| MySQL `DATE` | `PlainDate` | `fromMySQLDate`, `toMySQLDate` |
| MySQL `DATETIME` | `PlainDateTime` | `fromMySQLDateTime`, `toMySQLDateTime` |
| MySQL `TIMESTAMP` | `Instant` | `fromMySQLTimestamp`, `toMySQLTimestamp` (session time zone required) |
| MySQL `TIME` | `PlainTime` or `Duration` | `fromMySQLTime` (with `{ as }`), `toMySQLTime` |
| PostgreSQL `date` | `PlainDate` | `fromPgDate`, `toPgDate` |
| PostgreSQL `time` | `PlainTime` | `fromPgTime`, `toPgTime` |
| PostgreSQL `timestamp` | `PlainDateTime` | `fromPgTimestamp`, `toPgTimestamp` |
| PostgreSQL `timestamptz` | `Instant` | `fromPgTimestamptz`, `toPgTimestamptz` |

MySQL zero dates (`0000-00-00`) and PostgreSQL `infinity` throw by default. Pass `{ onSpecialValue: 'null' }` to read them as `null`. PostgreSQL output must use the default `DateStyle` (`ISO`).
