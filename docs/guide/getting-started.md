# Getting started

# Installation

Install it from npm:

```sh
npm install orasna
```

orasna needs a global `Temporal`. It does not bundle a polyfill, so the app decides whether to load one.

| Environment | What to do |
| --- | --- |
| Node.js 26+ | Nothing. Temporal is built in. |
| Chrome / Edge 144+, Firefox 139+ | Nothing. Temporal is built in. |
| Node.js 20, 22, 24 | Load a polyfill (below). |
| Safari and older browsers | Load a polyfill (below). |

To load a polyfill, install `temporal-polyfill` and import its global entry **once, before anything imports orasna**. For example, put it at the top of your app's entry file:

```sh
npm install temporal-polyfill
```

```js
// main.js: the first import in the app
import 'temporal-polyfill/global';
import { isBefore } from 'orasna';
```

If Temporal is missing when an orasna function runs, the function throws `TemporalKitEnvironmentError` with code `TEMPORAL_MISSING`.

**Imports.** The root entry exports `compare`, `calendar`, `span`, `format`, `interval`, `clock`, and the error classes. `business`, `interop`, and `db` are subpath-only, so apps that don't need them never load them:

```js
import { isBefore, Interval, fixedClock } from 'orasna';
import { BusinessCalendar } from 'orasna/business';
import { reviveFields } from 'orasna/interop';
import { mysql2TypeCast } from 'orasna/db';
```

Every module is also available on its own path, such as `orasna/compare`.

**TypeScript.** Type declarations ship with the package. They refer to the global `Temporal` namespace, so your project needs Temporal types: TypeScript 6 and later include them in `"lib": ["ESNext"]`, and `temporal-polyfill` ships its own.

## Using it directly in a browser

You don't need npm or a bundler to use orasna in a web page. The source is plain ES modules that import each other by relative path, so a browser can load it from a CDN or from your own server.

Add an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) so that `orasna` resolves to a URL. Your scripts can then use the same imports as Node code. The example below loads a pinned release from jsDelivr, which serves files straight from npm:

```html
<script type="importmap">
{
  "imports": {
    "orasna": "https://cdn.jsdelivr.net/npm/orasna@0.2.0/src/index.js",
    "orasna/business": "https://cdn.jsdelivr.net/npm/orasna@0.2.0/src/business.js",
    "orasna/interop": "https://cdn.jsdelivr.net/npm/orasna@0.2.0/src/interop.js"
  }
}
</script>

<input id="start-date" type="date" value="2026-11-27">
<p id="due"></p>

<script type="module">
  import { format } from 'orasna';
  import { fromInputValue } from 'orasna/interop';
  import { BusinessCalendar } from 'orasna/business';

  // Load the polyfill only in browsers without native Temporal, such as Safari
  if (globalThis.Temporal === undefined) {
    await import('https://cdn.jsdelivr.net/npm/temporal-polyfill@1.0.6/global.min.js');
  }

  const calendar = new BusinessCalendar({ holidays: ['2026-11-30'] });
  const input = document.querySelector('#start-date');

  function showDueDate() {
    const start = fromInputValue(input); // reads the input's type and value; null when empty
    if (start === null) {
      return;
    }
    const due = calendar.addWorkingDays(start, 5);
    document.querySelector('#due').textContent = `Due ${format(due, 'EEEE, d MMMM yyyy')}`;
  }

  input.addEventListener('change', showDueDate);
  showDueDate(); // "Due Monday, 7 December 2026"
</script>
```

Things to know:

- **Polyfill order.** Importing orasna before the polyfill loads is fine, because orasna only looks for `Temporal` when one of its functions runs. Do call functions only after the polyfill has loaded. In the example, the `await` ensures that.
- **Pin the version.** Keep `@0.2.0` (or another exact version) in every URL, so a new release can't change your page. Map only the subpaths you use. `orasna/db` is for servers and isn't needed in a browser.
- **Self-hosting.** To serve the files yourself, copy the contents of the repository's `src/` folder (including `internal/`) to your site, for example into `/vendor/orasna/`, and point the import map there: `"orasna": "/vendor/orasna/index.js"`. Do the same with `temporal-polyfill`'s `global.min.js` if you need it.
- **Serve over HTTP.** Browsers don't load ES modules from `file://` pages. Open the page through a web server, even a local one.
