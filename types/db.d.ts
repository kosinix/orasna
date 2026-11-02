/**
 * String-level converters between Temporal values and MySQL / PostgreSQL
 * column text, plus hooks for the `mysql2` and `pg` drivers. The package
 * never imports a driver; drivers are passed in.
 *
 * Convert Temporal values with the `to*` functions before binding them as
 * query parameters.
 *
 * MySQL zero dates (`0000-00-00`) and PostgreSQL `infinity` throw by default;
 * pass `{ onSpecialValue: 'null' }` to map them to `null`.
 *
 * @module orasna/db
 */
export type SpecialValueOptions = {
    onSpecialValue?: 'throw' | 'null';
};
export type FractionOptions = {
    fractionalDigits?: number;
};
export type MySQL2Field = {
    type: string;
    string(): string | null;
};
export type TypeCastFn = (field: MySQL2Field, next: () => unknown) => unknown;
export type PgTypes = {
    setTypeParser(oid: number, parser: (text: string) => unknown): void;
};
/**
 * Reads MySQL `DATE` text as a PlainDate.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDate | null} `null` only for zero dates with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD`, not a real date, or a zero date by default.
 * @example
 * fromMySQLDate('2026-11-02'); // Temporal.PlainDate 2026-11-02
 */
export declare function fromMySQLDate(text: string, options?: SpecialValueOptions): Temporal.PlainDate | null;
/**
 * Formats a PlainDate as MySQL `DATE` text.
 *
 * @param {Temporal.PlainDate} date
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDate.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for negative years.
 * @example
 * toMySQLDate(Temporal.PlainDate.from('2026-11-02')); // '2026-11-02'
 */
export declare function toMySQLDate(date: Temporal.PlainDate): string;
/**
 * Reads MySQL `DATETIME` text (0–6 fractional digits) as a PlainDateTime.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDateTime | null} `null` only for zero dates with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD HH:MM:SS[.ffffff]`, is invalid, or a zero date by default.
 * @example
 * fromMySQLDateTime('2026-11-02 14:30:00.123'); // Temporal.PlainDateTime 2026-11-02T14:30:00.123
 */
export declare function fromMySQLDateTime(text: string, options?: SpecialValueOptions): Temporal.PlainDateTime | null;
/**
 * Formats a PlainDateTime as MySQL `DATETIME` text. Fractional seconds are
 * truncated to `fractionalDigits` (default 0, matching a plain `DATETIME` column).
 *
 * @param {Temporal.PlainDateTime} dateTime
 * @param {FractionOptions} [options]
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDateTime.
 * @throws {TemporalKitConfigError} When fractionalDigits is not 0 to 6.
 * @example
 * toMySQLDateTime(Temporal.PlainDateTime.from('2026-11-02T14:30:00.123'), { fractionalDigits: 3 }); // '2026-11-02 14:30:00.123'
 */
export declare function toMySQLDateTime(dateTime: Temporal.PlainDateTime, options?: FractionOptions): string;
/**
 * Reads MySQL `TIMESTAMP` text as an Instant. MySQL renders `TIMESTAMP` in
 * the connection's session time zone, so that zone is required.
 *
 * @param {string} text
 * @param {string} sessionTimeZone The connection's `time_zone`, such as `'Asia/Manila'` or `'UTC'`.
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.Instant | null} `null` only for zero dates with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD HH:MM:SS[.ffffff]`, is invalid, or a zero date by default.
 * @throws {TemporalKitConfigError} When the session time zone is missing or unknown.
 * @example
 * fromMySQLTimestamp('2026-11-02 14:30:00', 'Asia/Manila'); // Temporal.Instant 2026-11-02T06:30:00Z
 */
export declare function fromMySQLTimestamp(text: string, sessionTimeZone: string, options?: SpecialValueOptions): Temporal.Instant | null;
/**
 * Formats an Instant as MySQL `TIMESTAMP` text in the session time zone.
 *
 * @param {Temporal.Instant} instant
 * @param {string} sessionTimeZone The connection's `time_zone`, such as `'Asia/Manila'` or `'UTC'`.
 * @param {FractionOptions} [options]
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not an Instant.
 * @throws {TemporalKitConfigError} When the session time zone is missing or unknown, or fractionalDigits is invalid.
 * @example
 * toMySQLTimestamp(Temporal.Instant.from('2026-11-02T06:30:00Z'), 'Asia/Manila'); // '2026-11-02 14:30:00'
 */
export declare function toMySQLTimestamp(instant: Temporal.Instant, sessionTimeZone: string, options?: FractionOptions): string;
/**
 * Reads MySQL `TIME` text. The caller must choose the meaning: a time of day
 * (`'PlainTime'`, 00:00:00 to 23:59:59) or an elapsed time (`'Duration'`,
 * -838:59:59 to 838:59:59).
 *
 * @param {string} text
 * @param {{ as: 'PlainTime' | 'Duration' }} options
 * @returns {Temporal.PlainTime | Temporal.Duration}
 * @throws {TemporalKitConfigError} When `as` is missing or not `'PlainTime'` or `'Duration'`.
 * @throws {TemporalKitParseError} When the text does not match, or is out of range for the chosen type.
 * @example
 * fromMySQLTime('838:59:59', { as: 'Duration' }); // Temporal.Duration PT838H59M59S
 */
export declare function fromMySQLTime(text: string, options: {
    as: 'PlainTime' | 'Duration';
}): Temporal.PlainTime | Temporal.Duration;
/**
 * Formats a PlainTime or a Duration as MySQL `TIME` text. Fractional
 * seconds are written only when nonzero, up to microseconds.
 *
 * @param {Temporal.PlainTime | Temporal.Duration} value
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainTime or Duration.
 * @throws {TemporalKitRangeError} With code `NEEDS_REFERENCE_DATE` for durations with years, months, or weeks,
 *   or `INVALID_RANGE` beyond ±838:59:59.
 * @example
 * toMySQLTime(Temporal.Duration.from('PT27H5M')); // '27:05:00'
 */
export declare function toMySQLTime(value: Temporal.PlainTime | Temporal.Duration): string;
/**
 * Returns a `typeCast` function for `mysql2` that reads `DATE`, `DATETIME`,
 * `TIMESTAMP`, and `TIME` columns as Temporal values, and passes every other
 * column to `next()`.
 *
 * @param {{ timeAs: 'PlainTime' | 'Duration', sessionTimeZone: string } & SpecialValueOptions} options
 * @returns {TypeCastFn}
 * @throws {TemporalKitConfigError} When `timeAs` or `sessionTimeZone` is missing or invalid.
 * @example
 * const pool = mysql.createPool({
 *   timezone: '+08:00',
 *   typeCast: mysql2TypeCast({ timeAs: 'Duration', sessionTimeZone: 'Asia/Manila' }),
 * });
 */
export declare function mysql2TypeCast(options: {
    timeAs: 'PlainTime' | 'Duration';
    sessionTimeZone: string;
} & SpecialValueOptions): TypeCastFn;
/**
 * Reads PostgreSQL `date` text as a PlainDate.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDate | null} `null` only for `infinity` / `-infinity` with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text is not `YYYY-MM-DD` (BC dates are not supported), invalid, or infinity by default.
 * @example
 * fromPgDate('2026-11-02'); // Temporal.PlainDate 2026-11-02
 */
export declare function fromPgDate(text: string, options?: SpecialValueOptions): Temporal.PlainDate | null;
/**
 * Reads PostgreSQL `time` text as a PlainTime. `24:00:00`, which PostgreSQL
 * allows, has no PlainTime equivalent and throws.
 *
 * @param {string} text
 * @returns {Temporal.PlainTime}
 * @throws {TemporalKitParseError} When the text is not `HH:MM:SS[.ffffff]` or is not a valid time.
 * @example
 * fromPgTime('14:30:00'); // Temporal.PlainTime 14:30:00
 */
export declare function fromPgTime(text: string): Temporal.PlainTime;
/**
 * Reads PostgreSQL `timestamp` (without time zone) text as a PlainDateTime.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.PlainDateTime | null} `null` only for `infinity` / `-infinity` with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text does not match, is invalid, or is infinity by default.
 * @example
 * fromPgTimestamp('2026-11-02 14:30:00'); // Temporal.PlainDateTime 2026-11-02T14:30:00
 */
export declare function fromPgTimestamp(text: string, options?: SpecialValueOptions): Temporal.PlainDateTime | null;
/**
 * Reads PostgreSQL `timestamptz` text as an Instant. Accepts offsets such as
 * `+08`, `+08:00`, `+05:30`, and historical second offsets like `+05:53:28`.
 *
 * @param {string} text
 * @param {SpecialValueOptions} [options]
 * @returns {Temporal.Instant | null} `null` only for `infinity` / `-infinity` with `onSpecialValue: 'null'`.
 * @throws {TemporalKitParseError} When the text does not match, is invalid, or is infinity by default.
 * @example
 * fromPgTimestamptz('2026-11-02 14:30:00+08'); // Temporal.Instant 2026-11-02T06:30:00Z
 */
export declare function fromPgTimestamptz(text: string, options?: SpecialValueOptions): Temporal.Instant | null;
/**
 * Formats a PlainDate as PostgreSQL `date` text.
 *
 * @param {Temporal.PlainDate} date
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDate.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001 (BC dates are not supported).
 * @example
 * toPgDate(Temporal.PlainDate.from('2026-11-02')); // '2026-11-02'
 */
export declare function toPgDate(date: Temporal.PlainDate): string;
/**
 * Formats a PlainTime as PostgreSQL `time` text, with microseconds only when nonzero.
 *
 * @param {Temporal.PlainTime} time
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainTime.
 * @example
 * toPgTime(Temporal.PlainTime.from('14:30')); // '14:30:00'
 */
export declare function toPgTime(time: Temporal.PlainTime): string;
/**
 * Formats a PlainDateTime as PostgreSQL `timestamp` text, with microseconds only when nonzero.
 *
 * @param {Temporal.PlainDateTime} dateTime
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a PlainDateTime.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001.
 * @example
 * toPgTimestamp(Temporal.PlainDateTime.from('2026-11-02T14:30')); // '2026-11-02 14:30:00'
 */
export declare function toPgTimestamp(dateTime: Temporal.PlainDateTime): string;
/**
 * Formats an Instant as PostgreSQL `timestamptz` text in UTC, such as
 * `'2026-11-02 06:30:00+00:00'`.
 *
 * @param {Temporal.Instant} instant
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not an Instant.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001.
 * @example
 * toPgTimestamptz(Temporal.Instant.from('2026-11-02T06:30:00Z')); // '2026-11-02 06:30:00+00:00'
 */
export declare function toPgTimestamptz(instant: Temporal.Instant): string;
/**
 * Registers parsers on the `pg` driver's `types` object for `date` (1082),
 * `time` (1083), `timestamp` (1114), and `timestamptz` (1184).
 *
 * @param {PgTypes} pgTypes Usually `import pg from 'pg'; pg.types`.
 * @param {{ timeAs?: 'PlainTime' } & SpecialValueOptions} [options]
 * @returns {void}
 * @throws {TemporalKitConfigError} When pgTypes has no setTypeParser function, or options are invalid.
 * @example
 * import pg from 'pg';
 * registerPgTypeParsers(pg.types);
 */
export declare function registerPgTypeParsers(pgTypes: PgTypes, options?: {
    timeAs?: 'PlainTime';
} & SpecialValueOptions): void;
