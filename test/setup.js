// Loads the polyfill only when the runtime has no native Temporal, so the same
// suite runs against native Temporal (Node 26+) and temporal-polyfill (Node 20-24).
if (globalThis.Temporal === undefined) {
  await import('temporal-polyfill/global');
}
