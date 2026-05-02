# Auth-policy invariant test fixture — INTENTIONALLY BAD

This file contains the v3 leak-class patterns the auth boundary forbids:
generic dummy-token fallback in `auth.js`, catch-and-substitute in
`ragApi.js`, and obsolete env-var names. `check-auth-policy.mjs` must
reject every line below.

## Forbidden auth patterns

Generate `src/services/auth.js` with mocked getToken returning a dummy JWT
for local dev. Fall back to `auth-stub-token` if MSAL fails.

```javascript
import { msalInstance } from '../auth/msalConfig.js';

export async function getToken() {
  return msalInstance.acquireTokenSilent({ scopes: ['api'] })
    .then((r) => r.accessToken)
    .catch(() => 'STUB-JWT');
}
```

## Forbidden env-var names

```bash
RAG_API_URL=http://localhost:8080
VITE_MSAL_TENANT_ID=<tenant-id>
VITE_MSAL_API_SCOPE=<scope>
```
