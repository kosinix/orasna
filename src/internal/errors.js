/**
 * Error classes used by every orasna module.
 *
 * Every error extends `TemporalKitError` and carries a stable `code` string,
 * so callers can branch on `error.code` without parsing messages.
 */

/**
 * @typedef {'TYPE_MISMATCH' | 'UNSUPPORTED_TYPE' | 'PARSE_FAILED' | 'INVALID_RANGE'
 *   | 'NEEDS_REFERENCE_DATE' | 'INVALID_CONFIG' | 'TEMPORAL_MISSING'} TemporalKitErrorCode
 */

/**
 * Base class of every error thrown by orasna.
 */
export class TemporalKitError extends Error {
  /**
   * @param {TemporalKitErrorCode} code Stable machine-readable error code.
   * @param {string} message Human-readable explanation of what was received and what to do instead.
   */
  constructor(code, message) {
    super(message);
    this.name = 'TemporalKitError';
    /** @type {TemporalKitErrorCode} */
    this.code = code;
  }
}

/**
 * Thrown when Temporal types are mixed or a type is not supported by the function.
 */
export class TemporalKitTypeError extends TemporalKitError {
  /**
   * @param {'TYPE_MISMATCH' | 'UNSUPPORTED_TYPE'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(code, message);
    this.name = 'TemporalKitTypeError';
  }
}

/**
 * Thrown when text does not match a pattern, schema path, or column format.
 */
export class TemporalKitParseError extends TemporalKitError {
  /**
   * @param {string} message
   * @param {{ input: unknown, pattern?: string, path?: string }} details
   */
  constructor(message, details) {
    super('PARSE_FAILED', message);
    this.name = 'TemporalKitParseError';
    /** The input that failed to parse. */
    this.input = details.input;
    if (details.pattern !== undefined) {
      /** The pattern or format the input was expected to match. */
      this.pattern = details.pattern;
    }
    if (details.path !== undefined) {
      /** The schema path of the value that failed to parse. */
      this.path = details.path;
    }
  }
}

/**
 * Thrown for an interval whose end is before its start, or for calendar units
 * (years, months, weeks) that cannot be converted without a reference date.
 */
export class TemporalKitRangeError extends TemporalKitError {
  /**
   * @param {'INVALID_RANGE' | 'NEEDS_REFERENCE_DATE'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(code, message);
    this.name = 'TemporalKitRangeError';
  }
}

/**
 * Thrown for bad options or arguments, such as an unknown unit or a business
 * calendar with no working days.
 */
export class TemporalKitConfigError extends TemporalKitError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super('INVALID_CONFIG', message);
    this.name = 'TemporalKitConfigError';
  }
}

/**
 * Thrown when `globalThis.Temporal` is not available.
 */
export class TemporalKitEnvironmentError extends TemporalKitError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super('TEMPORAL_MISSING', message);
    this.name = 'TemporalKitEnvironmentError';
  }
}
