/**
 * Conversion to and from JSON, legacy `Date`, and HTML form inputs. Nothing
 * here touches the DOM, so it also works in Node for server-rendered forms.
 *
 * Temporal objects already serialize through `toJSON()`, so only revival is
 * needed for JSON. Revival is schema-based: you list which paths hold which type.
 *
 * @module orasna/interop
 */
export type TypeName = import('./internal/temporal.js').TypeName;
export type Schema = Record<string, TypeName>;
export type InputType = 'date' | 'time' | 'datetime-local' | 'month' | 'week';
export type InputValue = Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime | Temporal.PlainYearMonth;
export type SchemaNode = {
    /**
     * Set when this path holds a Temporal value.
     */
    typeName: TypeName | undefined;
    children: Map<string, SchemaNode>;
};
/**
 * Returns a reviver for `JSON.parse` that turns the strings at the schema's
 * paths into Temporal values. Unlisted keys are left alone; `null` and
 * missing values are kept as they are.
 *
 * @param {Schema} schema
 * @returns {(this: unknown, key: string, value: unknown) => unknown}
 * @throws {TemporalKitConfigError} When the schema is invalid.
 * @example
 * const body = JSON.parse(text, createReviver({ createdAt: 'Instant', 'logs.*.timeIn': 'PlainTime' }));
 */
export declare function createReviver(schema: Schema): (this: unknown, key: string, value: unknown) => unknown;
/**
 * Returns a copy of an already-parsed object (such as `req.body` or the result
 * of `response.json()`) with the strings at the schema's paths turned into
 * Temporal values. The input is not mutated; untouched branches are shared.
 *
 * @template O
 * @param {O} object
 * @param {Schema} schema
 * @returns {O}
 * @throws {TemporalKitConfigError} When the schema is invalid.
 * @throws {TemporalKitParseError} When a listed value is not a valid string for its type; `path` names it.
 * @example
 * const body = reviveFields(req.body, { 'leave.start': 'PlainDate', 'leave.end': 'PlainDate' });
 */
export declare function reviveFields<O>(object: O, schema: Schema): O;
/**
 * Converts a legacy `Date` to a `Temporal.Instant`.
 *
 * @param {Date} date
 * @returns {Temporal.Instant}
 * @throws {TemporalKitTypeError} When the value is not a Date.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for an Invalid Date.
 * @example
 * fromLegacyDate(new Date('2026-11-02T06:30:00Z')); // Temporal.Instant 2026-11-02T06:30:00Z
 */
export declare function fromLegacyDate(date: Date): Temporal.Instant;
/**
 * Converts an Instant or ZonedDateTime to a legacy `Date`. Precision below
 * milliseconds is dropped.
 *
 * @param {Temporal.Instant | Temporal.ZonedDateTime} value
 * @returns {Date}
 * @throws {TemporalKitTypeError} For other types; a PlainDateTime needs `toZonedDateTime(timeZone)` first.
 * @example
 * toLegacyDate(Temporal.Instant.from('2026-11-02T06:30:00Z')); // Date 2026-11-02T06:30:00.000Z
 */
export declare function toLegacyDate(value: Temporal.Instant | Temporal.ZonedDateTime): Date;
/**
 * Reads the value of an HTML `<input>` of type date, time, datetime-local,
 * month, or week. An empty value returns `null`. Pass either the value string
 * and its input type, or an object with `type` and `value` (such as the input
 * element itself).
 *
 * @param {string | { type: string, value: string }} source
 * @param {InputType} [type] Required when `source` is a string; optional when `source` has a `type`.
 * @returns {InputValue | null}
 * @throws {TemporalKitConfigError} When the input type is missing, unknown, or conflicts with `source.type`.
 * @throws {TemporalKitParseError} When the value does not match the input type's format or is not a real date.
 * @example
 * fromInputValue('2026-W45', 'week'); // Temporal.PlainDate 2026-11-02
 * fromInputValue(form.elements.startDate); // reads type and value from the element
 */
export declare function fromInputValue(source: string | {
    type: string;
    value: string;
}, type?: InputType): InputValue | null;
/**
 * Formats a Temporal value as the `value` of an HTML `<input>`. Times omit
 * seconds when they are zero, and include milliseconds only when nonzero.
 *
 * @param {InputValue} value
 * @param {InputType} type
 * @returns {string}
 * @throws {TemporalKitConfigError} When the input type is unknown.
 * @throws {TemporalKitTypeError} When the value's type does not match the input type.
 * @throws {TemporalKitRangeError} With code `INVALID_RANGE` for years before 0001, which inputs cannot show.
 * @example
 * toInputValue(Temporal.PlainDate.from('2026-11-02'), 'week'); // '2026-W45'
 */
export declare function toInputValue(value: InputValue, type: InputType): string;
