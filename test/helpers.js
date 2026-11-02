import assert from 'node:assert/strict';

/**
 * Asserts that `fn` throws an orasna error with the given code.
 *
 * @param {() => unknown} fn
 * @param {string} code
 * @param {Function} [errorClass]
 */
export function assertThrowsCode(fn, code, errorClass) {
  assert.throws(fn, (error) => {
    assert.equal(error.code, code, `expected code ${code}, got ${error.code}: ${error.message}`);
    if (errorClass !== undefined) {
      assert.ok(error instanceof errorClass, `expected ${errorClass.name}, got ${error.constructor.name}`);
    }
    return true;
  });
}

export const date = (text) => Temporal.PlainDate.from(text);
export const time = (text) => Temporal.PlainTime.from(text);
export const dateTime = (text) => Temporal.PlainDateTime.from(text);
export const zoned = (text) => Temporal.ZonedDateTime.from(text);
export const instant = (text) => Temporal.Instant.from(text);
export const duration = (text) => Temporal.Duration.from(text);
