# Errors

All errors extend `TemporalKitError` and carry a stable `code` string. The classes are exported from the root entry.

| Class | Codes | Thrown when |
| --- | --- | --- |
| `TemporalKitTypeError` | `TYPE_MISMATCH`, `UNSUPPORTED_TYPE` | Temporal types are mixed, or a type is not supported |
| `TemporalKitParseError` | `PARSE_FAILED` | Input does not match the pattern, schema path, or column format; has `input` and `pattern` or `path` |
| `TemporalKitRangeError` | `INVALID_RANGE`, `NEEDS_REFERENCE_DATE` | An interval ends before it starts; calendar units need a reference date |
| `TemporalKitConfigError` | `INVALID_CONFIG` | Options or arguments are invalid, such as a business calendar with no working days |
| `TemporalKitEnvironmentError` | `TEMPORAL_MISSING` | There is no `globalThis.Temporal` |
