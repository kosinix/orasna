/**
 * Fixed-pattern formatting and strict parsing for machine formats, reports,
 * CSV, and filenames.
 *
 * For locale-aware display text, use the built-in
 * `value.toLocaleString(locale, options)` instead.
 *
 * Tokens: `yyyy yy M MM MMM MMMM d dd EEE EEEE H HH h hh a m mm s ss SSS XXX VV`.
 * Quote literal text with single quotes (`'T'`); `''` is a single quote.
 *
 * @module orasna/format
 */
export type TypeName = import('./internal/temporal.js').TypeName;
export type FormattableValue = Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime | Temporal.PlainYearMonth | Temporal.PlainMonthDay | Temporal.ZonedDateTime | Temporal.Instant;
export type FormattableTypeName = 'PlainDate' | 'PlainTime' | 'PlainDateTime' | 'PlainYearMonth' | 'PlainMonthDay' | 'ZonedDateTime' | 'Instant';
export type FormatOptions = {
    locale?: string;
};
export type ParseOptions = {
    locale?: string;
    timeZone?: string;
    twoDigitYearBase?: number;
};
export type PatternPart = {
    kind: 'literal';
    text: string;
} | {
    kind: 'token';
    token: string;
};
export type SuppliedFields = {
    year?: number;
    month?: number;
    day?: number;
    dayOfWeek?: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
    offset?: string;
    timeZoneId?: string;
};
export type ParsedFields = {
    year?: number;
    month?: number;
    day?: number;
    weekday?: number;
    hour24?: number;
    hour12?: number;
    dayPeriod?: 'am' | 'pm';
    minute?: number;
    second?: number;
    millisecond?: number;
    offset?: string;
    timeZoneId?: string;
};
export type LocaleNames = {
    monthsShort: string[];
    monthsLong: string[];
    /**
     * Monday first.
     */
    weekdaysShort: string[];
    /**
     * Monday first.
     */
    weekdaysLong: string[];
    am: string;
    pm: string;
};
/**
 * A pattern that has been tokenized once and can be reused for formatting and
 * parsing. Create it with `compilePattern()`.
 */
declare class CompiledPattern {
    #private;
    /**
     * The original pattern text.
     * @readonly
     * @type {string}
     */
    readonly pattern: string;
    /**
     * The literal and token parts of the pattern, in order.
     * @readonly
     * @type {readonly PatternPart[]}
     */
    readonly parts: readonly PatternPart[];
    /**
     * @param {symbol} key
     * @param {string} pattern
     * @param {readonly PatternPart[]} parts
     */
    constructor(key: symbol, pattern: string, parts: readonly PatternPart[]);
    /**
     * Formats a Temporal value with this pattern. See `format()`.
     *
     * @param {FormattableValue} value
     * @param {FormatOptions} [options]
     * @returns {string}
     */
    format(value: FormattableValue, options?: FormatOptions): string;
    /**
     * Parses text with this pattern. See `parse()`.
     *
     * @param {string} text
     * @param {FormattableTypeName} type
     * @param {ParseOptions} [options]
     * @returns {FormattableValue}
     */
    parse(text: string, type: FormattableTypeName, options?: ParseOptions): FormattableValue;
    /**
     * Returns the parse regex for a locale, building it on first use.
     *
     * @param {string} locale
     * @returns {{ regex: RegExp, groupTokens: string[] }}
     */
    parseRegexFor(locale: string): {
        regex: RegExp;
        groupTokens: string[];
    };
}
/**
 * Tokenizes a pattern once so it can be reused. `format()` and `parse()` also
 * cache up to 100 patterns internally, so this is only needed to hold on to a
 * pattern explicitly.
 *
 * @param {string} pattern
 * @returns {CompiledPattern}
 * @throws {TemporalKitConfigError} For unknown tokens or an unterminated quote.
 * @example
 * const isoDate = compilePattern('yyyy-MM-dd');
 * isoDate.format(Temporal.PlainDate.from('2026-11-02')); // '2026-11-02'
 */
export declare function compilePattern(pattern: string): CompiledPattern;
/**
 * Formats a Temporal value with a fixed pattern. Numbers always use ASCII
 * digits; month names, weekday names, and AM/PM use `options.locale`
 * (default `'en-US'`). An `Instant` is formatted in UTC.
 *
 * @param {FormattableValue} value
 * @param {string | CompiledPattern} pattern
 * @param {FormatOptions} [options]
 * @returns {string}
 * @throws {import('./internal/errors.js').TemporalKitTypeError} When the value is not a supported type,
 *   or cannot supply a token in the pattern (such as `HH` for a PlainDate).
 * @throws {TemporalKitConfigError} For an invalid pattern or locale.
 * @example
 * format(Temporal.PlainDateTime.from('2026-11-02T14:05'), 'yyyy-MM-dd hh:mm a'); // '2026-11-02 02:05 PM'
 */
export declare function format(value: FormattableValue, pattern: string | CompiledPattern, options?: FormatOptions): string;
/**
 * Parses text that must match the whole pattern, and returns a Temporal value
 * of the requested type. Names match case-insensitively; fields are validated
 * strictly, so `2026-02-30` fails.
 *
 * @param {string} text
 * @param {string | CompiledPattern} pattern
 * @param {FormattableTypeName} type
 * @param {ParseOptions} [options] `timeZone` is used for ZonedDateTime without `VV` and Instant without `XXX`;
 *   `yy` maps to `twoDigitYearBase + yy` (default base 2000).
 * @returns {FormattableValue}
 * @throws {TemporalKitParseError} When the text does not match or holds an invalid date or time.
 * @throws {TemporalKitConfigError} When the pattern lacks fields the type needs, or options are invalid.
 * @example
 * parse('02/11/2026', 'dd/MM/yyyy', 'PlainDate'); // Temporal.PlainDate 2026-11-02
 */
export declare function parse(text: string, pattern: string | CompiledPattern, type: FormattableTypeName, options?: ParseOptions): FormattableValue;
export {};
