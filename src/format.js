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

import {
  TemporalKitConfigError,
  TemporalKitParseError,
  TemporalKitTypeError,
} from './internal/errors.js';
import { assertType, getTemporal } from './internal/temporal.js';
import { assertInteger, assertOneOf, assertTimeZoneId, padNumber, readOptions } from './internal/validate.js';

/**
 * @typedef {import('./internal/temporal.js').TypeName} TypeName
 * @typedef {Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime | Temporal.PlainYearMonth
 *   | Temporal.PlainMonthDay | Temporal.ZonedDateTime | Temporal.Instant} FormattableValue
 * @typedef {'PlainDate' | 'PlainTime' | 'PlainDateTime' | 'PlainYearMonth' | 'PlainMonthDay'
 *   | 'ZonedDateTime' | 'Instant'} FormattableTypeName
 * @typedef {{ locale?: string }} FormatOptions
 * @typedef {{ locale?: string, timeZone?: string, twoDigitYearBase?: number }} ParseOptions
 */

/**
 * One piece of a compiled pattern: either literal text or a field token.
 *
 * @typedef {{ kind: 'literal', text: string } | { kind: 'token', token: string }} PatternPart
 */

/**
 * Values a Temporal object can supply to the formatter. A missing key means
 * the value cannot supply that field.
 *
 * @typedef {object} SuppliedFields
 * @property {number} [year]
 * @property {number} [month]
 * @property {number} [day]
 * @property {number} [dayOfWeek]
 * @property {number} [hour]
 * @property {number} [minute]
 * @property {number} [second]
 * @property {number} [millisecond]
 * @property {string} [offset]
 * @property {string} [timeZoneId]
 */

/**
 * Fields collected while parsing text.
 *
 * @typedef {object} ParsedFields
 * @property {number} [year]
 * @property {number} [month]
 * @property {number} [day]
 * @property {number} [weekday]
 * @property {number} [hour24]
 * @property {number} [hour12]
 * @property {'am' | 'pm'} [dayPeriod]
 * @property {number} [minute]
 * @property {number} [second]
 * @property {number} [millisecond]
 * @property {string} [offset]
 * @property {string} [timeZoneId]
 */

/**
 * @typedef {object} LocaleNames
 * @property {string[]} monthsShort
 * @property {string[]} monthsLong
 * @property {string[]} weekdaysShort Monday first.
 * @property {string[]} weekdaysLong Monday first.
 * @property {string} am
 * @property {string} pm
 */

/** @type {readonly FormattableTypeName[]} */
const FORMATTABLE_TYPES = Object.freeze([
  'PlainDate',
  'PlainTime',
  'PlainDateTime',
  'PlainYearMonth',
  'PlainMonthDay',
  'ZonedDateTime',
  'Instant',
]);

/**
 * Every supported token and the field it reads.
 *
 * @type {Readonly<Record<string, keyof SuppliedFields>>}
 */
const TOKEN_FIELDS = Object.freeze({
  yyyy: 'year',
  yy: 'year',
  M: 'month',
  MM: 'month',
  MMM: 'month',
  MMMM: 'month',
  d: 'day',
  dd: 'day',
  EEE: 'dayOfWeek',
  EEEE: 'dayOfWeek',
  H: 'hour',
  HH: 'hour',
  h: 'hour',
  hh: 'hour',
  a: 'hour',
  m: 'minute',
  mm: 'minute',
  s: 'second',
  ss: 'second',
  SSS: 'millisecond',
  XXX: 'offset',
  VV: 'timeZoneId',
});

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_TWO_DIGIT_YEAR_BASE = 2000;
const PATTERN_CACHE_LIMIT = 100;
const QUOTE = "'";

/** @type {Map<string, CompiledPattern>} */
const patternCache = new Map();

/** @type {Map<string, LocaleNames>} */
const localeNamesCache = new Map();

/** Guards the CompiledPattern constructor so instances come only from compilePattern(). */
const CONSTRUCTOR_KEY = Symbol('CompiledPattern');

/**
 * A pattern that has been tokenized once and can be reused for formatting and
 * parsing. Create it with `compilePattern()`.
 */
class CompiledPattern {
  /** @type {Map<string, { regex: RegExp, groupTokens: string[] }>} */
  #parseRegexByLocale = new Map();

  /**
   * The original pattern text.
   * @readonly
   * @type {string}
   */
  pattern;

  /**
   * The literal and token parts of the pattern, in order.
   * @readonly
   * @type {readonly PatternPart[]}
   */
  parts;

  /**
   * @param {symbol} key
   * @param {string} pattern
   * @param {readonly PatternPart[]} parts
   */
  constructor(key, pattern, parts) {
    if (key !== CONSTRUCTOR_KEY) {
      throw new TemporalKitConfigError('CompiledPattern cannot be constructed directly; use compilePattern(pattern).');
    }
    this.pattern = pattern;
    this.parts = parts;
    Object.freeze(this);
  }

  /**
   * Formats a Temporal value with this pattern. See `format()`.
   *
   * @param {FormattableValue} value
   * @param {FormatOptions} [options]
   * @returns {string}
   */
  format(value, options) {
    return formatWithCompiled(this, value, options);
  }

  /**
   * Parses text with this pattern. See `parse()`.
   *
   * @param {string} text
   * @param {FormattableTypeName} type
   * @param {ParseOptions} [options]
   * @returns {FormattableValue}
   */
  parse(text, type, options) {
    return parseWithCompiled(this, text, type, options);
  }

  /**
   * Returns the parse regex for a locale, building it on first use.
   *
   * @param {string} locale
   * @returns {{ regex: RegExp, groupTokens: string[] }}
   */
  parseRegexFor(locale) {
    const cached = this.#parseRegexByLocale.get(locale);
    if (cached !== undefined) {
      return cached;
    }
    const built = buildParseRegex(this.parts, getLocaleNames(locale));
    this.#parseRegexByLocale.set(locale, built);
    return built;
  }
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
export function compilePattern(pattern) {
  getTemporal();
  if (typeof pattern !== 'string') {
    throw new TemporalKitConfigError(`compilePattern() expects a pattern string, but received ${typeof pattern}.`);
  }
  const parts = tokenize(pattern);
  return new CompiledPattern(CONSTRUCTOR_KEY, pattern, parts);
}

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
export function format(value, pattern, options) {
  getTemporal();
  const compiled = resolvePattern(pattern);
  return formatWithCompiled(compiled, value, options);
}

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
export function parse(text, pattern, type, options) {
  getTemporal();
  const compiled = resolvePattern(pattern);
  return parseWithCompiled(compiled, text, type, options);
}

/**
 * @param {string | CompiledPattern} pattern
 * @returns {CompiledPattern}
 */
function resolvePattern(pattern) {
  if (pattern instanceof CompiledPattern) {
    return pattern;
  }
  if (typeof pattern !== 'string') {
    throw new TemporalKitConfigError(`Expected a pattern string or a compiled pattern, but received ${typeof pattern}.`);
  }

  const cached = patternCache.get(pattern);
  if (cached !== undefined) {
    return cached;
  }

  const compiled = compilePattern(pattern);
  if (patternCache.size >= PATTERN_CACHE_LIMIT) {
    const oldestPattern = patternCache.keys().next().value;
    if (oldestPattern !== undefined) {
      patternCache.delete(oldestPattern);
    }
  }
  patternCache.set(pattern, compiled);
  return compiled;
}

// ---------------------------------------------------------------------------
// Tokenizing
// ---------------------------------------------------------------------------

/**
 * Splits a pattern into literal and token parts.
 *
 * @param {string} pattern
 * @returns {readonly PatternPart[]}
 */
function tokenize(pattern) {
  /** @type {PatternPart[]} */
  const parts = [];
  let literalBuffer = '';
  let index = 0;

  while (index < pattern.length) {
    const character = pattern[index];

    if (character === QUOTE) {
      const quoted = readQuoted(pattern, index);
      literalBuffer += quoted.text;
      index = quoted.nextIndex;
      continue;
    }

    if (isAsciiLetter(character)) {
      let runEnd = index;
      while (runEnd < pattern.length && pattern[runEnd] === character) {
        runEnd += 1;
      }
      const token = pattern.slice(index, runEnd);
      if (!Object.hasOwn(TOKEN_FIELDS, token)) {
        throw new TemporalKitConfigError(
          `Unknown token '${token}' in pattern ${JSON.stringify(pattern)}. ` +
            `Supported tokens: ${Object.keys(TOKEN_FIELDS).join(' ')}. Quote literal text, for example 'T'.`,
        );
      }
      if (literalBuffer !== '') {
        parts.push(Object.freeze({ kind: 'literal', text: literalBuffer }));
        literalBuffer = '';
      }
      parts.push(Object.freeze({ kind: 'token', token }));
      index = runEnd;
      continue;
    }

    literalBuffer += character;
    index += 1;
  }

  if (literalBuffer !== '') {
    parts.push(Object.freeze({ kind: 'literal', text: literalBuffer }));
  }
  return Object.freeze(parts);
}

/**
 * Reads quoted literal text starting at a quote character.
 *
 * @param {string} pattern
 * @param {number} quoteIndex Index of the opening quote.
 * @returns {{ text: string, nextIndex: number }}
 */
function readQuoted(pattern, quoteIndex) {
  const isEscapedQuote = pattern[quoteIndex + 1] === QUOTE;
  if (isEscapedQuote) {
    return { text: QUOTE, nextIndex: quoteIndex + 2 };
  }

  let text = '';
  let index = quoteIndex + 1;
  while (index < pattern.length) {
    const character = pattern[index];
    if (character === QUOTE) {
      const isDoubledQuote = pattern[index + 1] === QUOTE;
      if (isDoubledQuote) {
        text += QUOTE;
        index += 2;
        continue;
      }
      return { text, nextIndex: index + 1 };
    }
    text += character;
    index += 1;
  }

  throw new TemporalKitConfigError(
    `Unterminated quote in pattern ${JSON.stringify(pattern)} at position ${quoteIndex}. Close literal text with a single quote.`,
  );
}

/**
 * @param {string} character
 * @returns {boolean}
 */
function isAsciiLetter(character) {
  return /^[A-Za-z]$/.test(character);
}

// ---------------------------------------------------------------------------
// Locale names
// ---------------------------------------------------------------------------

/**
 * @param {unknown} locale
 * @param {string} context
 * @returns {string}
 */
function readLocale(locale, context) {
  if (locale === undefined) {
    return DEFAULT_LOCALE;
  }
  if (typeof locale !== 'string') {
    throw new TemporalKitConfigError(`${context} locale option must be a string such as 'en-US', but received ${typeof locale}.`);
  }
  try {
    const canonical = Intl.getCanonicalLocales(locale);
    return canonical[0];
  } catch {
    throw new TemporalKitConfigError(`${context} received an invalid locale ${JSON.stringify(locale)}. Use a BCP 47 tag such as 'en-US'.`);
  }
}

/**
 * Returns month names, weekday names, and AM/PM markers for a locale.
 * Names come from the ISO 8601 calendar.
 *
 * @param {string} locale
 * @returns {LocaleNames}
 */
function getLocaleNames(locale) {
  const cached = localeNamesCache.get(locale);
  if (cached !== undefined) {
    return cached;
  }

  const shortMonthFormatter = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const longMonthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  const shortWeekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const longWeekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });

  const monthsShort = [];
  const monthsLong = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const sampleDate = new Date(Date.UTC(2000, monthIndex, 1));
    monthsShort.push(shortMonthFormatter.format(sampleDate));
    monthsLong.push(longMonthFormatter.format(sampleDate));
  }

  const weekdaysShort = [];
  const weekdaysLong = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    // 2024-01-01 was a Monday, so day 1 + dayIndex walks Monday to Sunday.
    const sampleDate = new Date(Date.UTC(2024, 0, 1 + dayIndex));
    weekdaysShort.push(shortWeekdayFormatter.format(sampleDate));
    weekdaysLong.push(longWeekdayFormatter.format(sampleDate));
  }

  const names = Object.freeze({
    monthsShort,
    monthsLong,
    weekdaysShort,
    weekdaysLong,
    am: readDayPeriod(locale, 9, 'AM'),
    pm: readDayPeriod(locale, 21, 'PM'),
  });
  localeNamesCache.set(locale, names);
  return names;
}

/**
 * @param {string} locale
 * @param {number} hour
 * @param {string} fallback
 * @returns {string}
 */
function readDayPeriod(locale, hour, fallback) {
  const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const parts = formatter.formatToParts(new Date(Date.UTC(2000, 0, 1, hour)));
  const dayPeriodPart = parts.find((part) => part.type === 'dayPeriod');
  if (dayPeriodPart === undefined) {
    return fallback;
  }
  return dayPeriodPart.value;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * @param {CompiledPattern} compiled
 * @param {FormattableValue} value
 * @param {FormatOptions | undefined} options
 * @returns {string}
 */
function formatWithCompiled(compiled, value, options) {
  const typeName = /** @type {FormattableTypeName} */ (assertType(value, FORMATTABLE_TYPES, 'format(value)'));
  const readValue = readOptions(options, 'format()');
  const locale = readLocale(readValue.locale, 'format()');
  const fields = supplyFields(value, typeName);

  let output = '';
  for (const part of compiled.parts) {
    if (part.kind === 'literal') {
      output += part.text;
      continue;
    }
    output += formatToken(part.token, fields, typeName, locale, compiled.pattern);
  }
  return output;
}

/**
 * Reads the fields a Temporal value can supply.
 *
 * @param {FormattableValue} value
 * @param {FormattableTypeName} typeName
 * @returns {SuppliedFields}
 */
function supplyFields(value, typeName) {
  if (typeName === 'PlainDate') {
    const date = /** @type {Temporal.PlainDate} */ (value);
    return dateFields(date);
  }
  if (typeName === 'PlainTime') {
    const time = /** @type {Temporal.PlainTime} */ (value);
    return timeFields(time);
  }
  if (typeName === 'PlainDateTime') {
    const dateTime = /** @type {Temporal.PlainDateTime} */ (value);
    return { ...dateFields(dateTime), ...timeFields(dateTime) };
  }
  if (typeName === 'PlainYearMonth') {
    const yearMonth = /** @type {Temporal.PlainYearMonth} */ (value);
    return { year: yearMonth.year, month: yearMonth.month };
  }
  if (typeName === 'PlainMonthDay') {
    const monthDay = /** @type {Temporal.PlainMonthDay} */ (value);
    // A leap reference year keeps --02-29 valid while reading the month number.
    const referenceDate = monthDay.toPlainDate({ year: 2000 });
    return { month: referenceDate.month, day: referenceDate.day };
  }
  if (typeName === 'ZonedDateTime') {
    const zoned = /** @type {Temporal.ZonedDateTime} */ (value);
    return {
      ...dateFields(zoned),
      ...timeFields(zoned),
      offset: zoned.offset,
      timeZoneId: zoned.timeZoneId,
    };
  }
  const instant = /** @type {Temporal.Instant} */ (value);
  const inUtc = instant.toZonedDateTimeISO('UTC');
  return { ...dateFields(inUtc), ...timeFields(inUtc), offset: '+00:00' };
}

/**
 * @param {Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime} value
 * @returns {SuppliedFields}
 */
function dateFields(value) {
  return { year: value.year, month: value.month, day: value.day, dayOfWeek: value.dayOfWeek };
}

/**
 * @param {Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime} value
 * @returns {SuppliedFields}
 */
function timeFields(value) {
  return { hour: value.hour, minute: value.minute, second: value.second, millisecond: value.millisecond };
}

/**
 * @param {string} token
 * @param {SuppliedFields} fields
 * @param {FormattableTypeName} typeName
 * @param {string} locale
 * @param {string} pattern
 * @returns {string}
 */
function formatToken(token, fields, typeName, locale, pattern) {
  const fieldName = TOKEN_FIELDS[token];
  const fieldValue = fields[fieldName];
  if (fieldValue === undefined) {
    throw new TemporalKitTypeError(
      'UNSUPPORTED_TYPE',
      `format() cannot use token '${token}' in pattern ${JSON.stringify(pattern)} because Temporal.${typeName} has no ${fieldName}. ` +
        'Remove the token or convert the value to a type that has this field.',
    );
  }

  if (fieldName === 'offset' || fieldName === 'timeZoneId') {
    return String(fieldValue);
  }

  const number = /** @type {number} */ (fieldValue);
  const names = getLocaleNames(locale);

  switch (token) {
    case 'yyyy':
      return formatFourDigitYear(number);
    case 'yy':
      return padNumber(((number % 100) + 100) % 100, 2);
    case 'M':
    case 'd':
    case 'H':
    case 'm':
    case 's':
      return String(number);
    case 'MM':
    case 'dd':
    case 'HH':
    case 'mm':
    case 'ss':
      return padNumber(number, 2);
    case 'MMM':
      return names.monthsShort[number - 1];
    case 'MMMM':
      return names.monthsLong[number - 1];
    case 'EEE':
      return names.weekdaysShort[number - 1];
    case 'EEEE':
      return names.weekdaysLong[number - 1];
    case 'h':
      return String(toTwelveHour(number));
    case 'hh':
      return padNumber(toTwelveHour(number), 2);
    case 'a':
      return number < 12 ? names.am : names.pm;
    default:
      // Only 'SSS' remains.
      return padNumber(number, 3);
  }
}

/**
 * @param {number} year
 * @returns {string}
 */
function formatFourDigitYear(year) {
  if (year < 0) {
    return `-${padNumber(-year, 4)}`;
  }
  return padNumber(year, 4);
}

/**
 * @param {number} hour 0 to 23.
 * @returns {number} 1 to 12.
 */
function toTwelveHour(hour) {
  const remainder = hour % 12;
  if (remainder === 0) {
    return 12;
  }
  return remainder;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Builds one regex for the whole pattern. Literal text matches exactly; names
 * match case-insensitively through per-letter character classes.
 *
 * @param {readonly PatternPart[]} parts
 * @param {LocaleNames} names
 * @returns {{ regex: RegExp, groupTokens: string[] }}
 */
function buildParseRegex(parts, names) {
  let source = '^';
  /** @type {string[]} */
  const groupTokens = [];

  for (const part of parts) {
    if (part.kind === 'literal') {
      source += escapeRegex(part.text);
      continue;
    }
    source += `(${tokenRegexSource(part.token, names)})`;
    groupTokens.push(part.token);
  }
  source += '$';
  return { regex: new RegExp(source, 'u'), groupTokens };
}

/**
 * @param {string} token
 * @param {LocaleNames} names
 * @returns {string}
 */
function tokenRegexSource(token, names) {
  switch (token) {
    case 'yyyy':
      return '\\d{4}';
    case 'SSS':
      return '\\d{3}';
    case 'yy':
    case 'MM':
    case 'dd':
    case 'HH':
    case 'hh':
    case 'mm':
    case 'ss':
      return '\\d{2}';
    case 'M':
    case 'd':
    case 'H':
    case 'h':
    case 'm':
    case 's':
      return '\\d{1,2}';
    case 'MMM':
      return namesRegexSource(names.monthsShort);
    case 'MMMM':
      return namesRegexSource(names.monthsLong);
    case 'EEE':
      return namesRegexSource(names.weekdaysShort);
    case 'EEEE':
      return namesRegexSource(names.weekdaysLong);
    case 'a':
      return namesRegexSource([names.am, names.pm]);
    case 'XXX':
      return '[+-]\\d{2}:\\d{2}(?::\\d{2})?';
    default:
      // Only 'VV' remains: an IANA ID such as America/Argentina/Buenos_Aires, or an offset zone.
      return '[A-Za-z][A-Za-z0-9_+\\-]*(?:/[A-Za-z0-9_+\\-]+)*|[+-]\\d{2}:\\d{2}';
  }
}

/**
 * @param {string[]} nameList
 * @returns {string}
 */
function namesRegexSource(nameList) {
  const longestFirst = [...nameList].sort((first, second) => second.length - first.length);
  const alternatives = longestFirst.map((name) => caseInsensitiveSource(name));
  return alternatives.join('|');
}

/**
 * @param {string} text
 * @returns {string}
 */
function caseInsensitiveSource(text) {
  let source = '';
  for (const character of text) {
    const lower = character.toLowerCase();
    const upper = character.toUpperCase();
    const hasSingleCharacterCases = lower.length === 1 && upper.length === 1;
    if (lower !== upper && hasSingleCharacterCases) {
      source += `[${lower}${upper}]`;
      continue;
    }
    source += escapeRegex(character);
  }
  return source;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * @param {CompiledPattern} compiled
 * @param {unknown} text
 * @param {unknown} type
 * @param {ParseOptions | undefined} options
 * @returns {FormattableValue}
 */
function parseWithCompiled(compiled, text, type, options) {
  const typeName = assertOneOf(type, FORMATTABLE_TYPES, 'parse() type');
  const readValue = readOptions(options, 'parse()');
  const locale = readLocale(readValue.locale, 'parse()');
  const twoDigitYearBase = readTwoDigitYearBase(readValue.twoDigitYearBase);
  const pattern = compiled.pattern;

  if (typeof text !== 'string') {
    throw new TemporalKitParseError(`parse() expects a string, but received ${typeof text}.`, { input: text, pattern });
  }

  const { regex, groupTokens } = compiled.parseRegexFor(locale);
  const match = regex.exec(text);
  if (match === null) {
    throw new TemporalKitParseError(
      `parse() could not match ${JSON.stringify(text)} against pattern ${JSON.stringify(pattern)}. The whole string must match.`,
      { input: text, pattern },
    );
  }

  const names = getLocaleNames(locale);
  /** @type {ParsedFields} */
  const fields = {};
  groupTokens.forEach((token, groupIndex) => {
    const matchedText = match[groupIndex + 1];
    readTokenValue(token, matchedText, fields, names, twoDigitYearBase, { text, pattern });
  });

  return buildParsedValue(typeName, fields, readValue.timeZone, { text, pattern });
}

/**
 * @param {unknown} base
 * @returns {number}
 */
function readTwoDigitYearBase(base) {
  if (base === undefined) {
    return DEFAULT_TWO_DIGIT_YEAR_BASE;
  }
  return assertInteger(base, 'parse() twoDigitYearBase option');
}

/**
 * Stores one parsed token value into `fields`.
 *
 * @param {string} token
 * @param {string} matchedText
 * @param {ParsedFields} fields
 * @param {LocaleNames} names
 * @param {number} twoDigitYearBase
 * @param {{ text: string, pattern: string }} context
 */
function readTokenValue(token, matchedText, fields, names, twoDigitYearBase, context) {
  switch (token) {
    case 'yyyy':
      setField(fields, 'year', Number(matchedText), context);
      return;
    case 'yy':
      setField(fields, 'year', twoDigitYearBase + Number(matchedText), context);
      return;
    case 'M':
    case 'MM':
      setField(fields, 'month', Number(matchedText), context);
      return;
    case 'MMM':
      setField(fields, 'month', findNameIndex(names.monthsShort, matchedText) + 1, context);
      return;
    case 'MMMM':
      setField(fields, 'month', findNameIndex(names.monthsLong, matchedText) + 1, context);
      return;
    case 'd':
    case 'dd':
      setField(fields, 'day', Number(matchedText), context);
      return;
    case 'EEE':
      setField(fields, 'weekday', findNameIndex(names.weekdaysShort, matchedText) + 1, context);
      return;
    case 'EEEE':
      setField(fields, 'weekday', findNameIndex(names.weekdaysLong, matchedText) + 1, context);
      return;
    case 'H':
    case 'HH':
      setField(fields, 'hour24', Number(matchedText), context);
      return;
    case 'h':
    case 'hh':
      setField(fields, 'hour12', Number(matchedText), context);
      return;
    case 'a': {
      const isAm = matchedText.toLowerCase() === names.am.toLowerCase();
      setField(fields, 'dayPeriod', isAm ? 'am' : 'pm', context);
      return;
    }
    case 'm':
    case 'mm':
      setField(fields, 'minute', Number(matchedText), context);
      return;
    case 's':
    case 'ss':
      setField(fields, 'second', Number(matchedText), context);
      return;
    case 'SSS':
      setField(fields, 'millisecond', Number(matchedText), context);
      return;
    case 'XXX':
      setField(fields, 'offset', matchedText, context);
      return;
    default:
      // Only 'VV' remains.
      setField(fields, 'timeZoneId', matchedText, context);
  }
}

/**
 * @param {string[]} nameList
 * @param {string} matchedText
 * @returns {number}
 */
function findNameIndex(nameList, matchedText) {
  const wanted = matchedText.toLowerCase();
  return nameList.findIndex((name) => name.toLowerCase() === wanted);
}

/**
 * Sets a parsed field, rejecting conflicting values from repeated tokens.
 *
 * @template {keyof ParsedFields} K
 * @param {ParsedFields} fields
 * @param {K} name
 * @param {ParsedFields[K]} value
 * @param {{ text: string, pattern: string }} context
 */
function setField(fields, name, value, context) {
  const existing = fields[name];
  if (existing !== undefined && existing !== value) {
    throw new TemporalKitParseError(
      `parse() found conflicting values for ${name} in ${JSON.stringify(context.text)} (pattern ${JSON.stringify(context.pattern)}).`,
      { input: context.text, pattern: context.pattern },
    );
  }
  fields[name] = value;
}

/**
 * @param {FormattableTypeName} typeName
 * @param {ParsedFields} fields
 * @param {unknown} timeZoneOption
 * @param {{ text: string, pattern: string }} context
 * @returns {FormattableValue}
 */
function buildParsedValue(typeName, fields, timeZoneOption, context) {
  const Temporal = getTemporal();

  if (typeName === 'PlainYearMonth') {
    requireFields(fields, ['year', 'month'], typeName, context);
    return runTemporal(
      () => Temporal.PlainYearMonth.from({ year: fields.year, month: fields.month }, { overflow: 'reject' }),
      context,
    );
  }

  if (typeName === 'PlainMonthDay') {
    requireFields(fields, ['month', 'day'], typeName, context);
    const monthDayFields = {
      month: /** @type {number} */ (fields.month),
      day: /** @type {number} */ (fields.day),
      year: fields.year,
    };
    return runTemporal(() => Temporal.PlainMonthDay.from(monthDayFields, { overflow: 'reject' }), context);
  }

  if (typeName === 'PlainTime') {
    const time = buildTime(fields, context);
    return time;
  }

  requireFields(fields, ['year', 'month', 'day'], typeName, context);
  const dateFieldsToUse = {
    year: /** @type {number} */ (fields.year),
    month: /** @type {number} */ (fields.month),
    day: /** @type {number} */ (fields.day),
  };
  const date = runTemporal(() => Temporal.PlainDate.from(dateFieldsToUse, { overflow: 'reject' }), context);
  checkWeekday(date, fields, context);

  if (typeName === 'PlainDate') {
    return date;
  }

  const time = buildTime(fields, context);
  const dateTime = date.toPlainDateTime(time);

  if (typeName === 'PlainDateTime') {
    return dateTime;
  }
  if (typeName === 'ZonedDateTime') {
    return buildZoned(dateTime, fields, timeZoneOption, context);
  }
  return buildInstant(dateTime, fields, timeZoneOption, context);
}

/**
 * @param {ParsedFields} fields
 * @param {{ text: string, pattern: string }} context
 * @returns {Temporal.PlainTime}
 */
function buildTime(fields, context) {
  const Temporal = getTemporal();
  const hour = resolveHour(fields, context);
  const timeFieldsToUse = {
    hour,
    minute: fields.minute === undefined ? 0 : fields.minute,
    second: fields.second === undefined ? 0 : fields.second,
    millisecond: fields.millisecond === undefined ? 0 : fields.millisecond,
  };
  return runTemporal(() => Temporal.PlainTime.from(timeFieldsToUse, { overflow: 'reject' }), context);
}

/**
 * Works out the 24-hour value from `H`, or from `h` plus `a`.
 *
 * @param {ParsedFields} fields
 * @param {{ text: string, pattern: string }} context
 * @returns {number}
 */
function resolveHour(fields, context) {
  const hasHour24 = fields.hour24 !== undefined;
  const hasHour12 = fields.hour12 !== undefined;

  if (!hasHour24 && !hasHour12) {
    throw new TemporalKitConfigError(
      `parse() pattern ${JSON.stringify(context.pattern)} has no hour token (H, HH, or h with a), which this type needs.`,
    );
  }

  /** @type {number | undefined} */
  let hourFromTwelve;
  if (hasHour12) {
    hourFromTwelve = hourFromTwelveHourClock(fields, context);
  }

  if (!hasHour24) {
    return /** @type {number} */ (hourFromTwelve);
  }
  const hour24 = /** @type {number} */ (fields.hour24);
  if (hourFromTwelve !== undefined && hourFromTwelve !== hour24) {
    throw new TemporalKitParseError(
      `parse() found conflicting 24-hour and 12-hour values in ${JSON.stringify(context.text)}.`,
      { input: context.text, pattern: context.pattern },
    );
  }
  return hour24;
}

/**
 * @param {ParsedFields} fields
 * @param {{ text: string, pattern: string }} context
 * @returns {number}
 */
function hourFromTwelveHourClock(fields, context) {
  if (fields.dayPeriod === undefined) {
    throw new TemporalKitConfigError(
      `parse() pattern ${JSON.stringify(context.pattern)} uses a 12-hour token (h or hh) without 'a', so AM and PM cannot be told apart.`,
    );
  }
  const hour12 = /** @type {number} */ (fields.hour12);
  if (hour12 < 1 || hour12 > 12) {
    throw new TemporalKitParseError(
      `parse() read 12-hour value ${hour12} from ${JSON.stringify(context.text)}; it must be 1 to 12.`,
      { input: context.text, pattern: context.pattern },
    );
  }
  const hourWithinPeriod = hour12 % 12;
  if (fields.dayPeriod === 'pm') {
    return hourWithinPeriod + 12;
  }
  return hourWithinPeriod;
}

/**
 * @param {Temporal.PlainDate} date
 * @param {ParsedFields} fields
 * @param {{ text: string, pattern: string }} context
 */
function checkWeekday(date, fields, context) {
  if (fields.weekday === undefined) {
    return;
  }
  if (fields.weekday !== date.dayOfWeek) {
    throw new TemporalKitParseError(
      `parse() read a weekday name that does not match ${date} in ${JSON.stringify(context.text)}.`,
      { input: context.text, pattern: context.pattern },
    );
  }
}

/**
 * @param {Temporal.PlainDateTime} dateTime
 * @param {ParsedFields} fields
 * @param {unknown} timeZoneOption
 * @param {{ text: string, pattern: string }} context
 * @returns {Temporal.ZonedDateTime}
 */
function buildZoned(dateTime, fields, timeZoneOption, context) {
  const Temporal = getTemporal();
  let timeZone = fields.timeZoneId;
  if (timeZone === undefined) {
    if (timeZoneOption === undefined) {
      throw new TemporalKitConfigError(
        `parse() to ZonedDateTime needs a time zone: add 'VV' to pattern ${JSON.stringify(context.pattern)} or pass the timeZone option.`,
      );
    }
    timeZone = assertTimeZoneId(timeZoneOption, 'parse()');
  }

  const zonedFields = {
    year: dateTime.year,
    month: dateTime.month,
    day: dateTime.day,
    hour: dateTime.hour,
    minute: dateTime.minute,
    second: dateTime.second,
    millisecond: dateTime.millisecond,
    timeZone,
    offset: fields.offset,
  };
  return runTemporal(() => Temporal.ZonedDateTime.from(zonedFields, { offset: 'reject', overflow: 'reject' }), context);
}

/**
 * @param {Temporal.PlainDateTime} dateTime
 * @param {ParsedFields} fields
 * @param {unknown} timeZoneOption
 * @param {{ text: string, pattern: string }} context
 * @returns {Temporal.Instant}
 */
function buildInstant(dateTime, fields, timeZoneOption, context) {
  const Temporal = getTemporal();
  if (fields.offset !== undefined) {
    const isoText = `${dateTime.toString({ calendarName: 'never' })}${fields.offset}`;
    return runTemporal(() => Temporal.Instant.from(isoText), context);
  }
  if (fields.timeZoneId !== undefined) {
    const timeZoneId = fields.timeZoneId;
    return runTemporal(() => dateTime.toZonedDateTime(timeZoneId).toInstant(), context);
  }
  if (timeZoneOption === undefined) {
    throw new TemporalKitConfigError(
      `parse() to Instant needs an offset or time zone: add 'XXX' to pattern ${JSON.stringify(context.pattern)} or pass the timeZone option.`,
    );
  }
  const timeZone = assertTimeZoneId(timeZoneOption, 'parse()');
  return dateTime.toZonedDateTime(timeZone).toInstant();
}

/**
 * @param {ParsedFields} fields
 * @param {(keyof ParsedFields)[]} required
 * @param {string} typeName
 * @param {{ text: string, pattern: string }} context
 */
function requireFields(fields, required, typeName, context) {
  for (const name of required) {
    if (fields[name] === undefined) {
      throw new TemporalKitConfigError(
        `parse() pattern ${JSON.stringify(context.pattern)} has no ${name} token, which Temporal.${typeName} needs.`,
      );
    }
  }
}

/**
 * Runs a Temporal construction and turns its RangeError into a parse error.
 *
 * @template R
 * @param {() => R} build
 * @param {{ text: string, pattern: string }} context
 * @returns {R}
 */
function runTemporal(build, context) {
  try {
    return build();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TemporalKitParseError(
      `parse() read ${JSON.stringify(context.text)} with pattern ${JSON.stringify(context.pattern)}, but it is not a valid value: ${reason}`,
      { input: context.text, pattern: context.pattern },
    );
  }
}
