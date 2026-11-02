/**
 * Error classes used by every orasna module.
 *
 * Every error extends `TemporalKitError` and carries a stable `code` string,
 * so callers can branch on `error.code` without parsing messages.
 */
export type TemporalKitErrorCode = 'TYPE_MISMATCH' | 'UNSUPPORTED_TYPE' | 'PARSE_FAILED' | 'INVALID_RANGE' | 'NEEDS_REFERENCE_DATE' | 'INVALID_CONFIG' | 'TEMPORAL_MISSING';
/**
 * @typedef {'TYPE_MISMATCH' | 'UNSUPPORTED_TYPE' | 'PARSE_FAILED' | 'INVALID_RANGE'
 *   | 'NEEDS_REFERENCE_DATE' | 'INVALID_CONFIG' | 'TEMPORAL_MISSING'} TemporalKitErrorCode
 */
/**
 * Base class of every error thrown by orasna.
 */
export declare class TemporalKitError extends Error {
    /** @type {TemporalKitErrorCode} */
    code: TemporalKitErrorCode;
    /**
     * @param {TemporalKitErrorCode} code Stable machine-readable error code.
     * @param {string} message Human-readable explanation of what was received and what to do instead.
     */
    constructor(code: TemporalKitErrorCode, message: string);
}
/**
 * Thrown when Temporal types are mixed or a type is not supported by the function.
 */
export declare class TemporalKitTypeError extends TemporalKitError {
    /**
     * @param {'TYPE_MISMATCH' | 'UNSUPPORTED_TYPE'} code
     * @param {string} message
     */
    constructor(code: 'TYPE_MISMATCH' | 'UNSUPPORTED_TYPE', message: string);
}
/**
 * Thrown when text does not match a pattern, schema path, or column format.
 */
export declare class TemporalKitParseError extends TemporalKitError {
    /** The input that failed to parse. */
    input: unknown;
    /** The pattern or format the input was expected to match. */
    pattern: string | undefined;
    /** The schema path of the value that failed to parse. */
    path: string | undefined;
    /**
     * @param {string} message
     * @param {{ input: unknown, pattern?: string, path?: string }} details
     */
    constructor(message: string, details: {
        input: unknown;
        pattern?: string;
        path?: string;
    });
}
/**
 * Thrown for an interval whose end is before its start, or for calendar units
 * (years, months, weeks) that cannot be converted without a reference date.
 */
export declare class TemporalKitRangeError extends TemporalKitError {
    /**
     * @param {'INVALID_RANGE' | 'NEEDS_REFERENCE_DATE'} code
     * @param {string} message
     */
    constructor(code: 'INVALID_RANGE' | 'NEEDS_REFERENCE_DATE', message: string);
}
/**
 * Thrown for bad options or arguments, such as an unknown unit or a business
 * calendar with no working days.
 */
export declare class TemporalKitConfigError extends TemporalKitError {
    /**
     * @param {string} message
     */
    constructor(message: string);
}
/**
 * Thrown when `globalThis.Temporal` is not available.
 */
export declare class TemporalKitEnvironmentError extends TemporalKitError {
    /**
     * @param {string} message
     */
    constructor(message: string);
}
