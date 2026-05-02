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
```

## Forbidden env-var names

```bash
RAG_API_URL=http://localhost:8080
VITE_MSAL_TENANT_ID=<tenant-id>
VITE_MSAL_API_SCOPE=<scope>
```
