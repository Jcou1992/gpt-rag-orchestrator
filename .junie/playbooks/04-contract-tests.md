# Playbook: 04 — Contract Tests & Communication Fallbacks

**Purpose:** Wire the canonical SSE event contract into the scaffolded target, validate frontend ↔ backend communication against it, gate the auth boundary at build time, document failure scenarios, and harden MSAL config against common production-leak footguns.

**Input:** `SCAFFOLD_DECISIONS.md`, completed `frontend/` + `backend/`, [INTEGRATION_PLAN.md §3](../../INTEGRATION_PLAN.md), the canonical contract files under `.junie/contracts/`.

**Output:** `contract-tests/`, `vite.config.js`, `src/services/{auth,auth-stub}.js`, `msalConfig.js`, `docs/communication-fallbacks.md`, test report, updated `SCAFFOLD_PROGRESS.md`.

**Single source of truth for SSE events:** the canonical schema and example fixture live under `.junie/contracts/sse-events.schema.json` and `.junie/contracts/sse-events.examples.json`. This playbook never restates either body inline — it copies them into the scaffolded target. Restating either is an R5 violation; `scripts/check-r5-invariant.mjs` enforces this at the parser level.

**Precondition (read this before Step 1):** the scaffolded target has `.junie/` at its root after Junie skill activation copies it into the target's working tree. The schema-emission step in this playbook depends on `.junie/contracts/sse-events.schema.json` being readable from the target's working directory; if `.junie/` is not there, the copy step fails fast and the rest of this playbook does not run.

---

## Step 1 — Schema emission (Node-driven copy from canonical)

The canonical SSE schema is **not restated here**. Instead, the scaffolder runs a small Node copy step that emits `contract-tests/schemas/ask-chunk-event.schema.json` from `.junie/contracts/sse-events.schema.json` byte-for-byte. The same mechanism emits the example fixture from `.junie/contracts/sse-events.examples.json` into `contract-tests/fixtures/sse-events.examples.json` so the contract test can validate fixture against schema in the target's working tree.

We use Node's `fs.copyFileSync` instead of POSIX `cp` because the scaffolded target may be running on Windows; `cp` is not available in default cmd.exe / PowerShell environments. Node ships with the JetBrains-bundled runtime that Junie targets, so this works cross-platform.

Run from the scaffolded project root (where `.junie/` lives):

```bash
mkdir -p contract-tests/schemas contract-tests/fixtures
node -e "require('fs').copyFileSync('.junie/contracts/sse-events.schema.json', 'contract-tests/schemas/ask-chunk-event.schema.json')"
node -e "require('fs').copyFileSync('.junie/contracts/sse-events.examples.json', 'contract-tests/fixtures/sse-events.examples.json')"
```

Verify the copy:

```bash
test -s contract-tests/schemas/ask-chunk-event.schema.json && echo "schema copied"
test -s contract-tests/fixtures/sse-events.examples.json && echo "fixture copied"
```

**Why this matters:** when the canonical schema evolves (e.g., a new event type is added under `.junie/contracts/sse-events.schema.json`), only one file changes. The scaffolded test surfaces the change automatically on the next regeneration.

**R5 invariant:** no fenced JSON block in this playbook may contain both `oneOf` and `additionalProperties` keys. That combination only appears in restatements of the canonical schema — and we are not restating the canonical schema. Run `node scripts/check-r5-invariant.mjs` from the skill repo root to enforce this at parser level.

---

## Step 2 — Drift detector (`contract-tests/contract.spec.js`)

The drift test loads the schema and fixture from the locations Step 1 wrote, validates each fixture entry against the schema's `oneOf`, and additionally enforces R4a — that `INTEGRATION_PLAN.md` (when present in the working tree) does not re-introduce inline `data: {"type":...` SSE event examples in prose. The R4a check is the documented "this-repo-only enforcement" pattern: it runs against the skill repo's `INTEGRATION_PLAN.md` when checking the skill itself. In a freshly scaffolded target tree where `INTEGRATION_PLAN.md` is absent, the check logs an informational warning and skips — that is intentional, not a failure.

**`contract-tests/contract.spec.js`:**

```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema + fixture are emitted by Step 1 from the canonical files under
// `.junie/contracts/`. Reading via fs (not import attributes) keeps this
// portable across the matrix of Node versions Junie may target.
const schemaPath = resolve(__dirname, 'schemas/ask-chunk-event.schema.json');
const fixturePath = resolve(__dirname, 'fixtures/sse-events.examples.json');

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv); // for `format: "uri"` on CitationEvent.url
const validate = ajv.compile(schema);

describe('SSE event contract — drift detector', () => {
  it('every example fixture entry validates against the canonical schema', () => {
    for (const event of fixture) {
      const ok = validate(event);
      if (!ok) {
        // Surface ajv errors with the failing event for diagnosis.
        // eslint-disable-next-line no-console
        console.error('Validation failed for event:', JSON.stringify(event));
        // eslint-disable-next-line no-console
        console.error(validate.errors);
      }
      expect(ok).toBe(true);
    }
  });

  it('rejects an event whose `type` is not in the schema oneOf', () => {
    const bogus = { type: 'heartbeat', text: 'nope' };
    expect(validate(bogus)).toBe(false);
  });

  it('rejects an event with an extra (unknown) property', () => {
    const extra = { type: 'chunk', text: 'hi', surplus: 'field' };
    expect(validate(extra)).toBe(false);
  });

  it('rejects a chunk event missing the required `text` field', () => {
    const missing = { type: 'chunk' };
    expect(validate(missing)).toBe(false);
  });
});

describe('SSE event contract — R4a inline-restatement guard (skill-repo only)', () => {
  // R4a: INTEGRATION_PLAN.md must not reintroduce inline `data: {"type":...}`
  // SSE event examples in prose. The canonical examples live in
  // `.junie/contracts/sse-events.examples.json`. This check is informational
  // outside the skill repo; in scaffolded targets the file is typically absent.
  const integrationPlanPath = resolve(__dirname, '..', 'INTEGRATION_PLAN.md');
  const planExists = existsSync(integrationPlanPath);

  beforeAll(() => {
    if (!planExists) {
      // eslint-disable-next-line no-console
      console.warn(
        '[contract.spec] INTEGRATION_PLAN.md not present in working tree — ' +
          'skipping R4a inline-restatement guard. This warning is informational; ' +
          'R4a is the documented "this-repo-only enforcement" pattern (skill repo enforces, ' +
          'scaffolded targets do not need to).'
      );
    }
  });

  it.skipIf(!planExists)('contains zero inline `data: {"type":` SSE event examples', () => {
    const body = readFileSync(integrationPlanPath, 'utf8');
    const matches = body.match(/data:\s*\{"type":/g) || [];
    expect(matches.length).toBe(0);
  });
});
```

The fixture validates because Step 1 copied both files from the same canonical pair under `.junie/contracts/`. If a future contributor edits the schema without updating the fixture (or vice versa), this test fails with the failing event surfaced in the error output.

---

## Step 3 — Mock orchestrator for offline dev

Many developers may not have the RAG orchestrator running locally. Generate a **fallback mock**:

**`backend/src/main/kotlin/.../mock/MockOrchestratorClient.kt`:**
```kotlin
@Component
@ConditionalOnProperty(
  name = "orchestrator.mock-enabled",
  havingValue = "true"
)
class MockOrchestratorClient(
  val properties: OrchestratorProperties
) : OrchestratorClient {

  override fun askOrchestrator(
    ask: String,
    conversationId: String,
    userContext: UserContext
  ): Flow<AskChunk> = flow {
    // Simulate streaming response
    emit(AskChunk.Chunk("This is a mocked response to: \"$ask\""))
    delay(100)
    emit(AskChunk.Citation("Sample Doc", "https://example.com/doc"))
    emit(AskChunk.Done())
  }
}
```

**`application-mock.yml`:**
```yaml
orchestrator:
  mock-enabled: true
  url: http://localhost:8080  # ignored when mock is enabled
  api-key: mock-key
```

Print:
```
To develop without the real orchestrator:

./gradlew -p backend bootRun --args='--spring.profiles.active=mock'

The backend will return mocked SSE responses. Perfect for frontend dev.
```

---

## Step 4 — Single Vite config with mode-conditional auth alias

Replace any prior runtime auth-stub catch-and-substitute fallback in `ragApi.js` with a build-time alias. There is **one** `vite.config.js`, not two; mode determines which auth implementation the bundler resolves. Allowlist (not denylist) the dev-only modes so a future `vite build --mode staging` (or any other custom mode) cannot silently ship the stub.

**`vite.config.js`:**

```javascript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// Dev-mode allowlist. Anything not in this list resolves to the real auth
// implementation (production-safe by default). DO NOT change this to
// `mode === 'production'` — that pattern fails open for any custom mode
// (e.g., `vite build --mode staging`) and would silently ship the dev stub.
const DEV_MODES = ['development', 'test'];

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  build: {
    // Load-bearing for the leak test in Step 5: the manifest gives us a
    // minification-stable view of which sources made it into the prod bundle.
    manifest: true,
  },
  resolve: {
    alias: {
      // Absolute paths are required — Vite resolves relative alias values
      // relative to the importer, which makes `./src/...` non-deterministic.
      '@/services/auth': DEV_MODES.includes(mode)
        ? fileURLToPath(new URL('./src/services/auth-stub.js', import.meta.url))
        : fileURLToPath(new URL('./src/services/auth.js', import.meta.url)),
    },
  },
}));
```

**`src/services/auth-stub.js`** (dev only — never present in prod manifest):

```javascript
// Dev-only auth stub. Resolved by the Vite alias in `vite.config.js` when
// `mode in ['development', 'test']`. The two-layer leak test in Step 5
// asserts this file never lands in a prod bundle.
//
// R6a: token is held in a module-scoped variable, NOT localStorage.
// Reloading the dev server clears the stub token; this is intentional —
// it prevents the stub token from outliving the dev session and being
// mistaken for a real one.

let stubToken = null;

// Pre-committed sentinel UUID. The leak test in Step 5 greps the prod
// `dist/` for this exact string; zero matches is the pass condition.
//
// MUST be referenced by side-effect-bearing code. If we only `export const`
// without using the binding, Rollup's tree-shaker drops the unused export
// from the bundle and the sentinel grep becomes vacuously satisfied
// (false-pass). The top-level `console.warn` below pins the sentinel into
// the emitted module AND surfaces a runtime signal if the stub somehow
// ends up active outside dev.
export const STUB_SENTINEL = '__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__';
console.warn('[AUTH-STUB ACTIVE]', STUB_SENTINEL);

export async function getToken() {
  if (stubToken) return stubToken;
  const fakeClaims = {
    oid: 'dev-user-id',
    preferred_username: 'dev@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  stubToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(fakeClaims))}.DEV`;
  return stubToken;
}
```

**`src/services/auth.js`** (real MSAL — production path; the only path resolved when `mode` is not in the dev allowlist):

```javascript
// Real auth path. Imported transitively by `ragApi.js` via the alias
// `@/services/auth` whenever Vite is NOT building in `development` or
// `test` mode. There is no runtime catch-and-substitute fallback anywhere
// in this module's call sites — getToken() failure throws and surfaces as
// a sanitized user-visible error (see Step 6 for MSAL hardening).
import { msalInstance } from '../auth/msalConfig.js';

export async function getToken() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error('AUTH_NO_ACCOUNT');
  }
  const result = await msalInstance.acquireTokenSilent({
    account: accounts[0],
    scopes: [import.meta.env.VITE_API_SCOPE],
  });
  return result.accessToken;
}
```

**`src/services/ragApi.js`** (consumes the alias; no stub fallback):

```javascript
import { getToken } from '@/services/auth';

export async function callRagApi(payload) {
  // R8: getToken() failure must propagate. No silent catch-and-substitute
  // fallback — that pattern silently downgrades production to a stub
  // token and is the exact bug class the build-time alias is closing.
  const token = await getToken();
  return fetch('/api/rag/ask', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
```

---

## Step 5 — Frontend leak test (two-layer: manifest + sentinel)

After `vite build`, run a dedicated leak test that asserts the dev auth-stub did not make it into the production bundle. Two layers, defense in depth:

1. **Manifest layer (primary; minification-stable):** the Rollup manifest names every entry source. We assert no entry references `auth-stub`. Note that Vite's manifest `src` field lists entry chunks only, not transitive imports — so we treat the manifest assertion as defense in depth, NOT as a complete guarantee.
2. **Sentinel layer (defense in depth):** we recursively walk the entire `dist/` tree and grep every `.js` file's content for the pre-committed sentinel UUID. Zero matches is the pass condition. The recursive walk uses `fs.readdirSync(dist, { recursive: true })` (Node 20+) rather than a glob library, because some glob implementations miss hashed asset directories.
3. **Filename guard:** no asset basename under `dist/` may contain `auth-stub`.
4. **False-pass guard:** `dist/` must exist and be non-empty. If a previous build was wiped and the leak test runs anyway, it would otherwise vacuously pass.

**`contract-tests/leak.spec.js`:**

```javascript
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';

const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');

const SENTINEL = '__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__';

function walkDist() {
  // Recursive walk of dist/. Returns absolute paths of every regular file.
  // We use { recursive: true } (Node 20+) instead of a glob lib because
  // some glob impls silently miss hashed asset subdirectories.
  return readdirSync(distDir, { recursive: true })
    .map((rel) => join(distDir, rel))
    .filter((p) => statSync(p).isFile());
}

describe('frontend leak test — dev auth-stub must not ship in prod bundle', () => {
  it('dist/ exists and is non-empty (false-pass guard)', () => {
    expect(existsSync(distDir)).toBe(true);
    const all = walkDist();
    expect(all.length).toBeGreaterThan(0);
  });

  it('Vite manifest is enabled and contains no auth-stub source', () => {
    // Vite 5+ writes to dist/.vite/manifest.json; Vite 4 writes to dist/manifest.json.
    const candidates = [
      resolve(distDir, '.vite', 'manifest.json'),
      resolve(distDir, 'manifest.json'),
    ];
    const manifestPath = candidates.find((p) => existsSync(p));
    if (!manifestPath) {
      throw new Error(
        'manifest disabled: neither dist/.vite/manifest.json nor dist/manifest.json exists. ' +
          'Set `build.manifest: true` in vite.config.js — the leak test depends on it.',
      );
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const [key, entry] of Object.entries(manifest)) {
      const src = entry.src ?? '';
      const file = entry.file ?? '';
      const imports = [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])];
      const looksStubby = (s) => typeof s === 'string' && s.includes('auth-stub');
      if (looksStubby(key) || looksStubby(src) || looksStubby(file) || imports.some(looksStubby)) {
        throw new Error(
          `manifest entry references auth-stub: ${JSON.stringify({ key, entry })}`,
        );
      }
    }
  });

  it('no built file basename contains "auth-stub"', () => {
    const offenders = walkDist().filter((p) => basename(p).includes('auth-stub'));
    expect(offenders).toEqual([]);
  });

  it('no .js file in dist/ contains the auth-stub sentinel', () => {
    const jsFiles = walkDist().filter((p) => p.endsWith('.js'));
    const offenders = jsFiles.filter((p) => readFileSync(p, 'utf8').includes(SENTINEL));
    if (offenders.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Sentinel matched in:', offenders);
    }
    expect(offenders).toEqual([]);
  });
});
```

Run with `pnpm build && pnpm test contract-tests/leak.spec.js`. The build must precede the test; running the test without a fresh `dist/` fails the false-pass guard.

---

## Step 6 — MSAL hardening (`msalConfig.js`)

Per R11, the scaffolded `msalConfig.js` template is hardened against four common production footguns: token-store XSS exposure, placeholder credentials shipped to prod, MSAL diagnostic info leaking to the DOM, and dead-end errors that lose the user mid-session.

**`src/auth/msalConfig.js`:**

```javascript
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// Reject these placeholder values at startup — they almost always indicate
// the developer copied the template without filling in tenant-specific
// values, and shipping them produces a confusing runtime auth failure
// instead of a clear config error.
const PLACEHOLDER_VALUES = new Set([
  'YOUR_CLIENT_ID',
  'YOUR_TENANT_ID',
  'YOUR_AUTHORITY',
  'YOUR_REDIRECT_URI',
  '',
  undefined,
  null,
]);

const isDevMode = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';

function isPlaceholder(value) {
  if (PLACEHOLDER_VALUES.has(value)) return true;
  if (typeof value !== 'string') return true;
  // localhost in non-dev mode is also a placeholder smell.
  if (!isDevMode && /^https?:\/\/localhost(:\d+)?(\/|$)/i.test(value)) return true;
  return false;
}

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: import.meta.env.VITE_MSAL_AUTHORITY,
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI,
  },
  cache: {
    // R11: sessionStorage is XSS-resistant relative to localStorage — tokens
    // do not survive a tab close, narrowing the exfiltration window. Future
    // devs: do NOT change this back to 'localStorage' to "fix" cross-tab
    // sign-in. If cross-tab SSO is genuinely required, escalate to a
    // separate brainstorm — it's not a v4 deliverable, and the swap silently
    // expands the auth attack surface.
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/**
 * Validate config at module load. If any required value is a placeholder,
 * render a config-error screen and halt before MSAL initializes — the app
 * must not mount in a broken auth state.
 */
function validateConfigOrHalt() {
  const checks = [
    ['clientId', msalConfig.auth.clientId],
    ['authority', msalConfig.auth.authority],
    ['redirectUri', msalConfig.auth.redirectUri],
  ];
  const bad = checks.filter(([, v]) => isPlaceholder(v));
  if (bad.length > 0) {
    const root = document.getElementById('app') || document.body;
    root.innerHTML = `
      <div role="alert" style="font-family:system-ui;padding:2rem;max-width:40rem;margin:4rem auto;border:1px solid #c00;border-radius:8px;">
        <h1 style="color:#c00;margin-top:0;">Authentication is not configured</h1>
        <p>Required MSAL values are missing or contain placeholder text. Set <code>VITE_MSAL_CLIENT_ID</code>, <code>VITE_MSAL_AUTHORITY</code>, and <code>VITE_MSAL_REDIRECT_URI</code> in your environment, then redeploy.</p>
        <p>Contact your administrator if you do not have these values.</p>
      </div>
    `;
    throw new Error('msalConfig: invalid configuration; halting before app mount.');
  }
}

validateConfigOrHalt();

export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Acquire a token silently, redirecting only on InteractionRequiredAuthError.
 * Other MSAL errors surface as a sanitized user-visible error — never
 * rendering MSAL diagnostic fields (errorMessage, authority, correlationId)
 * to the DOM, but always offering an explicit recovery affordance so the
 * user is not stuck on a dead-end message.
 */
export async function getToken(scopes) {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    throw new Error('AUTH_NO_ACCOUNT');
  }
  try {
    const result = await msalInstance.acquireTokenSilent({
      account: accounts[0],
      scopes,
    });
    return result.accessToken;
  } catch (err) {
    // Sanitized server-side log: include only the correlation ID for ops
    // forensics; do not write it to the DOM. (Logged via console here for
    // the scaffolded template — replace with your telemetry hook.)
    // eslint-disable-next-line no-console
    console.error('[auth] token acquisition failed', {
      correlationId: err?.correlationId,
      name: err?.name,
    });

    if (err instanceof InteractionRequiredAuthError) {
      // The only redirect path: user genuinely needs to re-authenticate.
      await msalInstance.acquireTokenRedirect({ scopes });
      return null; // unreachable; redirect leaves the page
    }

    // Render a generic, non-leaking error WITH explicit recovery — never
    // a dead-end. Do NOT inject err.message, err.errorMessage, authority,
    // or correlationId into the DOM.
    const root = document.getElementById('app') || document.body;
    root.innerHTML = `
      <div role="alert" style="font-family:system-ui;padding:2rem;max-width:40rem;margin:4rem auto;border:1px solid #c00;border-radius:8px;">
        <h1 style="color:#c00;margin-top:0;">We couldn't sign you in</h1>
        <p>Something went wrong while contacting the sign-in service. This is usually temporary.</p>
        <p><button id="auth-retry" style="padding:0.5rem 1rem;font-size:1rem;">Sign in again</button></p>
      </div>
    `;
    const retry = document.getElementById('auth-retry');
    if (retry) {
      retry.addEventListener('click', () => msalInstance.loginRedirect({ scopes }));
    }
    throw new Error('AUTH_FAILED'); // sanitized; never the raw MSAL error
  }
}
```

**Why each piece:**

- `sessionStorage` cache (XSS-resistance — explicit comment warns future maintainers not to swap back to localStorage).
- Startup placeholder validation halts the app *before* MSAL init when `clientId` / `authority` / `redirectUri` are obviously wrong; the user sees a clear "auth is not configured" screen instead of a confusing runtime failure.
- Sanitized error rendering surfaces a generic message; MSAL `errorMessage`, `authority`, and `correlationId` stay out of the DOM (correlation ID goes to the log only).
- `acquireTokenSilent` fallback policy redirects **only** on `InteractionRequiredAuthError`. Other MSAL errors render an error WITH an explicit "Sign in again" button — recovery affordance, not a dead end.

---

## Step 7 — Communication failure scenarios & troubleshooting

Generate **`docs/communication-fallbacks.md`**:

```markdown
# Communication Fallbacks & Troubleshooting

## Offline development

### Scenario: RAG orchestrator is down

**Frontend side:**
- `useSseClient` will timeout after 30s and surface a network error.
- Tests should mock `fetch` to avoid real network calls.

**Backend side:**
- Use `MockOrchestratorClient` by running with `--spring.profiles.active=mock`.
- Alternatively, set `orchestrator.mock-enabled=true` in `application.yml`.

**To test locally (frontend + backend, no orchestrator):**

\`\`\`bash
# Terminal 1: Backend (mocked orchestrator)
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev,mock'

# Terminal 2: Frontend
cd frontend
pnpm dev
\`\`\`

Visit `http://localhost:5173`, submit a query. Backend returns fake SSE, frontend renders it.

### Scenario: MSAL auth is not wired

**Frontend (development mode):**
- The Vite alias in `vite.config.js` resolves `@/services/auth` to `auth-stub.js` for `mode in ['development', 'test']` only.
- The dev stub returns a fake JWT held in a module-scoped variable (no localStorage). Reloading the page clears it; this is intentional.
- Console emits `[AUTH-STUB ACTIVE] true` so misconfigured environments self-announce.

**Frontend (production mode):**
- The alias resolves to `auth.js` (real MSAL). There is no runtime catch-and-substitute fallback in `ragApi.js`. `getToken()` failures throw and surface via the sanitized error rendering in `msalConfig.js` (Step 6).
- The leak test (`contract-tests/leak.spec.js`) asserts the auth-stub never made it into `dist/`.

**To wire real auth:**
- Implement `src/services/auth.js` with real MSAL calls (see Step 4 template).
- Set `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI` in your environment.
- Build with `vite build` (default mode `production` picks up the real auth path).

### Scenario: Backend can't reach orchestrator (network error)

**Behavior:**
- `RagController` gets a 502 / timeout from `OrchestratorClient`.
- `SseEnvelopeMapper` catches the error and emits an `ErrorEvent`.
- Frontend receives an error envelope per the canonical schema.
- UI shows error banner.

**To debug:**
\`\`\`bash
# Check if orchestrator is reachable
curl -X POST http://<orchestrator-host>:8080/orchestrator \
  -H "X-API-KEY: <key>" \
  -H "Content-Type: application/json" \
  -d '{"ask":"test"}'

# Check backend logs
./gradlew -p backend bootRun -i | grep -A5 OrchestratorClient
\`\`\`

### Scenario: JWT is expired

**Behavior:**
- Backend's JWT filter rejects the token with 401 Unauthorized.
- Frontend's `useSseClient` sees 401 and emits an error.
- UI prompts user to re-authenticate via the explicit "Sign in again" button (Step 6 sanitized error path).

**To test:**
- Set MSAL token expiry to -1 (already expired).
- Or use a known-bad token in curl.

### Scenario: CORS preflight fails

**Symptom:**
- Browser console shows "Access-Control-Allow-Origin missing."
- `useSseClient` aborts before SSE connection.

**Root cause:**
- Backend's CORS config missing or incorrect.

**To fix:**
- Check `SecurityConfig.kt` has CORS configured for your frontend origin.
- If dev/prod mismatch, add to `application-dev.yml`:
\`\`\`yaml
spring:
  web:
    cors:
      allowed-origins: http://localhost:5173
      allowed-methods: GET,POST,OPTIONS
\`\`\`

---

## Recovery procedures

| Issue | Recovery |
|---|---|
| Token expired mid-request | Catch 401, redirect to login, retry |
| Orchestrator timeout (30s) | Log & emit error, user can retry |
| CORS error | Check CORS config, reload frontend |
| Backend crash | Frontend should timeout & show error banner |
| Frontend crash | Backend continues streaming (client disconnect) |
| MSAL config has placeholders | Startup validation halts app; fix env, redeploy |
| Auth-stub leaked into prod bundle | Leak test fails build; check Vite mode + alias |
```

---

## Step 8 — Contract test execution

Run the contract + leak tests from the scaffolded project root:

```bash
# Build first (the leak test depends on dist/)
pnpm build

# Drift detector
pnpm test contract-tests/contract.spec.js

# Auth-stub leak test
pnpm test contract-tests/leak.spec.js

# Backend contract test
cd backend && ./gradlew test --tests '*ContractTest*'
```

Print results:
```
Contract validation complete

Drift detector:    fixture validates against canonical schema
Leak test:         manifest clean, sentinel grep zero, dist/ non-empty
Backend contract:  events serialize to canonical shape

All SSE events match the canonical schema in .junie/contracts/.
Frontend ↔ Backend communication is safe.
Production bundle does not contain the dev auth stub.
```

---

## Step 9 — Update SCAFFOLD_PROGRESS.md

```markdown
## Phase 04 — Contract-Tests DONE

**Completed:** <timestamp>

**Contracts (single-source from .junie/contracts/):**
- `contract-tests/schemas/ask-chunk-event.schema.json` (copied from canonical)
- `contract-tests/fixtures/sse-events.examples.json` (copied from canonical)
- Drift detector: `contract-tests/contract.spec.js`
- Leak test: `contract-tests/leak.spec.js`

**Build-time auth gate:**
- Single `vite.config.js` with mode-conditional alias
- `src/services/auth-stub.js` (dev only; sentinel-bearing)
- `src/services/auth.js` (prod path; no STUB fallback in ragApi.js)

**MSAL hardening (R11):**
- `sessionStorage` cache (XSS-resistant)
- Startup placeholder validation
- Sanitized error rendering with "Sign in again" recovery
- `acquireTokenSilent` redirects only on `InteractionRequiredAuthError`

**Fallbacks/Mocks:**
- Mock orchestrator (Spring `@ConditionalOnProperty`)
- Docs: `docs/communication-fallbacks.md`

**Coverage:**
- Network error scenarios documented
- CORS troubleshooting documented
- Auth failure recovery (with affordance) documented
- Offline dev flow documented

**Next phase:** 05-Docs-Generation
```

---

## Guardrails

- **The canonical SSE contract lives in `.junie/contracts/sse-events.schema.json`.** Never restate it inline. R5 invariant (`scripts/check-r5-invariant.mjs`) enforces this at parser level.
- **One Vite config.** Mode determines which auth path is bundled — the dev allowlist is positive (`['development', 'test']`), not a denylist of `'production'`. Custom modes default to the real auth path.
- **The dev stub never ships.** The two-layer leak test (manifest + sentinel grep + filename guard + non-empty `dist/` guard) catches regressions at build time.
- **`getToken()` failures throw.** No runtime catch-and-substitute fallback in `ragApi.js`. Stub tokens are reachable only through the dev-mode alias path.
- **MSAL placeholders fail closed at startup.** The app does not mount when `clientId` / `authority` / `redirectUri` look like template values; the user sees an explicit config-error screen.
- **Mock orchestrator is for dev, not prod.** Never ship mocks enabled. CI must validate against real orchestrator stub or testcontainers.
