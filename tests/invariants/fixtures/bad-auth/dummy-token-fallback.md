# Auth-policy invariant test fixture — INTENTIONALLY BAD

This file contains EVERY pattern the auth boundary forbids. The harness
asserts each forbidden token is surfaced by `check-auth-policy.mjs`, so
every entry in the script's FORBIDDEN + FORBIDDEN_REGEX lists MUST have
a corresponding line below. Removing a rule from the script silently is
caught by the harness because that rule's sentinel disappears from the
output.

## Forbidden auth patterns (substring class)

Generate `src/services/auth.js` with mocked getToken returning a dummy JWT
for local dev. Fall back to `auth-stub-token` if MSAL fails. The dummy-token
fallback is the v3 leak class. Other narrative variants: `mocked getToken`,
mocked `getToken` (backticked), mock getToken (imperative).

```javascript
import { msalInstance } from '../auth/msalConfig.js';

export async function getToken() {
  return msalInstance.acquireTokenSilent({ scopes: ['api'] })
    .then((r) => r.accessToken)
    .catch(() => 'STUB-JWT');
}

// Catch-substitute variants the v4 invariant forbids:
const a = p().catch(() => 'stub-lower');
const b = p().catch(() => "STUB-double");
const c = p().catch(() => 'auth-stub-1');
const d = p().catch(() => "auth-stub-2");

// Non-literal catch-substitute (round-33 closure): any `.catch(... => ...)`
// pattern returning a value, regardless of what the value is.
const e = p().catch(() => makeDevToken());
const f = p().catch(() => cachedToken);
const g = p().catch(() => 'FAKE_JWT');
const h = p().catch((err) => fallbackTokenFor(err));

// Round-34 closures: async arrow head + multi-line catch.
const i = p().catch(async () => makeDevToken());
const j = p().catch(
  () => fallbackToken,
);
const k = p().catch(async (err) =>
  retryWithDev(err),
);

// Round-35 closure: function-expression catch handlers (arrow-only
// regex would miss these).
const l = p().catch(function () { return makeDevToken(); });
const m = p().catch(function (err) { return fallbackTokenFor(err); });
const n = p().catch(async function () { return makeDevToken(); });

// Round-36 closures: parenthesized + comment-decorated function-expression
// handlers (the round-35 regex anchored too tightly on the literal
// `function` keyword being right after the optional `async`).
const o = p().catch((function () { return makeDevToken(); }));
const q = p().catch(/* fallback */ function () { return makeDevToken(); });
const r = p().catch(async /* fallback */ function () { return makeDevToken(); });

// Round-37 closures: comment with `{` inside (defeated the `[^){}]*?` gap
// in iter-36) AND comment-prefixed arrow handler (defeated the arrow
// regex which lacked comment tolerance). Both fixed by stripping JS
// comments before applying the multiline regex pass.
const s = p().catch(/* fallback {tok} */ function () { return makeDevToken(); });
const t = p().catch(/* fallback */ () => makeDevToken());
const u = p().catch(/* {scope} */ async () => makeDevToken());
```

## Forbidden env-var names

```bash
RAG_API_URL=http://localhost:8080
VITE_MSAL_TENANT_ID=<tenant-id>
VITE_MSAL_API_SCOPE=<scope>
```

## Forbidden localStorage-backed JWT phrases (round-44)

The hardened R6a posture forbids any persistent token store. These exact
phrasings are the v3 wording the auth-policy invariant rule list now
matches verbatim:

- Frontend auth fallback (stub JWT in localStorage).
- Auth fallback uses a localStorage-backed JWT when MSAL fails.
- The dev stub stores the JWT in localStorage so reloads keep the user signed in.
- Persist the token in localStorage as a fallback.

## Forbidden localStorage API access (round-45)

Code-level localStorage usage in an auth/api surface — round-45 closure
for the v3 leak class that the iter-44 phrase rules missed:

```javascript
// All of these must be flagged.
localStorage.setItem('jwt', token);
localStorage.setItem('access_token', result.accessToken);
const jwt = localStorage.getItem('jwt');
localStorage.removeItem('access_token');
localStorage['access_token'] = result.accessToken;
const t = localStorage["jwt"];
```

## Forbidden localStorage indirection (round-46)

Bypass shapes that aliasing / destructuring / global-scope bracket
indirection would otherwise hide:

```javascript
// Alias: indirect call site bypasses the direct .setItem regex.
const ls = localStorage;
let storage = localStorage;
var s = localStorage;
// Destructuring: bound names lose the `localStorage` prefix.
const { setItem } = localStorage;
let { getItem, removeItem } = localStorage;
// Bracket-key indirection through global objects.
globalThis['localStorage'].setItem('jwt', token);
window["localStorage"].setItem('access_token', t);
// Dot-qualified globals (round-47 closure).
const wls = window.localStorage;
const gls = globalThis.localStorage;
let sls = self.localStorage;
const { setItem } = window.localStorage;
let { getItem, removeItem } = globalThis.localStorage;

// Optional-chained variants (round-48 closure).
window.localStorage?.setItem('jwt', token);
localStorage?.setItem('access_token', t);
localStorage?.['jwt'] = token;
const wls2 = window?.localStorage;
const gls2 = globalThis?.localStorage;
const { setItem: si2 } = window?.localStorage;

// Dynamic-key + arbitrary dot-property writes (round-50 closure).
localStorage[JWT_KEY] = token;
localStorage.jwt = token;
window.localStorage.access_token = result.accessToken;

// Destructuring localStorage OUT of a global object (round-51 closure).
const { localStorage: storage1 } = window;
const { localStorage } = globalThis;
let { localStorage: ls3 } = self;

// Multi-line global destructure (round-52 closure).
const {
  localStorage: storageMl1,
} = window;

let {
  localStorage: storageMl2,
  navigator,
} = globalThis;

// Multi-line method destructure from localStorage (round-53 closure).
const {
  setItem: siMl1,
  getItem: giMl1,
} = localStorage;

let {
  removeItem: riMl1,
} = window.localStorage;

// Multi-line alias from localStorage (round-53 closure).
const lsMl1 =
  localStorage;
let lsMl2 =
  window.localStorage;

// Identifiers with `$` and `_` (round-54 closure — valid JS identifier
// chars; bare `\w+` missed them).
const $ls = localStorage;
let _privateLs = window.localStorage;
const cache$store = globalThis.localStorage;

// Object-literal + property-assign aliasing (round-55 closure).
const holder = { ls: localStorage };
const wrapper = { storage: window.localStorage };
holder.ls = localStorage;
this.storage = localStorage;
state.localCache = globalThis.localStorage;

// Quoted / computed / bracket alias forms (round-56 closure).
const qHolder = { 'ls': localStorage };
const dqHolder = { "ls": localStorage };
const cHolder = { [keyName]: localStorage };
holder['ls'] = localStorage;
this['storage'] = localStorage;
state["cache"] = window.localStorage;

// Computed-bracket LHS (round-57 closure).
holder[keyName] = localStorage;
this[storageKey] = window.localStorage;
state[`prefix-${suffix}`] = globalThis.localStorage;

// Nested bracket LHS — one level of nesting (round-58 closure).
holder[keys[0]] = localStorage;
state[getKey(parts[0])] = window.localStorage;
this[`prefix-${parts[0]}`] = globalThis.localStorage;

// Two-level nested bracket LHS (round-59 closure).
holder[keys[parts[0]]] = localStorage;
state[getKey(parts[idx[0]])] = window.localStorage;
this[`prefix-${parts[idx[0]]}`] = globalThis.localStorage;

// Arbitrary-depth nested LHS (round-60 — balanced-bracket scanner).
holder[keys[parts[indexes[0]]]] = localStorage;
state[getKey(getOther(parts[idx[lookup[0]]]))] = window.localStorage;
this[deeply.nested.path[a[b[c[d[0]]]]]] = globalThis.localStorage;

// Parenthesized RHS (round-61 closure).
holder.tokenStore = (localStorage);
holder.tokenStore = (window.localStorage);
this.cache = ((globalThis.localStorage));

// Whitespace + multi-line nested parens (round-62 closure).
holder.tokenStore = ( (localStorage) );
holder.tokenStore = (
  (window.localStorage)
);
```
