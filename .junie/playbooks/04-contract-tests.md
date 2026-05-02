# Playbook: 04 — Contract Tests & Communication Fallbacks

**Purpose:** Wire the canonical SSE event contract into the scaffolded target, validate frontend ↔ backend communication against it, gate the auth boundary at build time, document failure scenarios, and harden MSAL config against common production-leak footguns.

**Input:** `SCAFFOLD_DECISIONS.md`, completed `frontend/` + `backend/`, [INTEGRATION_PLAN.md §3](../../INTEGRATION_PLAN.md), the canonical contract files under `.junie/contracts/`.

**Output:** `contract-tests/`, `vite.config.js`, `src/services/{auth,auth-stub}.js`, `src/auth/msalConfig.js`, `docs/communication-fallbacks.md`, test report, updated `SCAFFOLD_PROGRESS.md`.

**Single source of truth for SSE events:** the canonical schema and example fixture live under `.junie/contracts/sse-events.schema.json` and `.junie/contracts/sse-events.examples.json`. This playbook never restates either body inline — it copies them into the scaffolded target. Restating either is an R5 violation; `scripts/check-r5-invariant.mjs` enforces this at the parser level.

**Precondition (read this before Step 1):** the scaffolded target has `.junie/` at its root after Junie skill activation copies it into the target's working tree. The schema-emission step in this playbook depends on `.junie/contracts/sse-events.schema.json` being readable from the target's working directory; if `.junie/` is not there, the copy step fails fast and the rest of this playbook does not run.

---

## Step 1 — Schema emission (Node-driven copy from canonical)

The canonical SSE schema is **not restated here**. Instead, the scaffolder runs a small Node copy step that emits `contract-tests/schemas/ask-chunk-event.schema.json` from `.junie/contracts/sse-events.schema.json` byte-for-byte. The same mechanism emits the example fixture from `.junie/contracts/sse-events.examples.json` into `contract-tests/fixtures/sse-events.examples.json` so the contract test can validate fixture against schema in the target's working tree.

We use Node's `fs.copyFileSync` instead of POSIX `cp` because the scaffolded target may be running on Windows; `cp` is not available in default cmd.exe / PowerShell environments. Node ships with the JetBrains-bundled runtime that Junie targets, so this works cross-platform.

Run from the scaffolded project root (where `.junie/` lives). Every command is a single `node -e` invocation so the same line works in cmd.exe, PowerShell, and POSIX shells (no `mkdir -p` / `test -s` / shell substitutions):

```bash
node -e "const fs=require('fs'); fs.mkdirSync('contract-tests/schemas',{recursive:true}); fs.mkdirSync('contract-tests/fixtures',{recursive:true});"
node -e "require('fs').copyFileSync('.junie/contracts/sse-events.schema.json', 'contract-tests/schemas/ask-chunk-event.schema.json')"
node -e "require('fs').copyFileSync('.junie/contracts/sse-events.examples.json', 'contract-tests/fixtures/sse-events.examples.json')"
```

Verify the copy (Node `statSync` replaces POSIX `test -s`; non-zero exit on missing/empty file works the same on Windows):

```bash
node -e "const s=require('fs').statSync('contract-tests/schemas/ask-chunk-event.schema.json'); if(!s.size) process.exit(1); console.log('schema copied');"
node -e "const s=require('fs').statSync('contract-tests/fixtures/sse-events.examples.json'); if(!s.size) process.exit(1); console.log('fixture copied');"
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
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// ESM has no __dirname / __filename — derive them from import.meta.url.
// Without this, `resolve(__dirname, ...)` throws ReferenceError in Vitest's
// ESM runner BEFORE any assertion runs (vacuous fail with no signal).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

## Step 3 — Mock orchestrator for offline dev (configure mock profile only)

`MockOrchestratorClient.kt` is generated in **playbook 03 Unit 9b Step C** (the backend phase, before this contract-tests phase). This step does not regenerate the class — emitting it here would create a phase-ordering compile error, since `DevDoubleGateTest` in phase 03 Unit 9b needs `MockOrchestratorClient` on the classpath when it runs. Instead, this step:

1. Confirms the mock was generated correctly in phase 03 (path: `backend/src/main/kotlin/com/example/rag/dev/MockOrchestratorClient.kt`, gated by `@DevOnlyBean` AND marked `@Primary` to win over the real `OrchestratorClient` from Unit 5 when both beans are on the classpath — required to avoid `NoUniqueBeanDefinitionException`).
2. Generates `application-mock.yml` to flip the single dev-double gate into the `mock` Spring profile.
3. Documents the dev runner invocation.

**Single-gate invariant (read first).** There is exactly one path to activate any dev/test double across the scaffolded backend: `app.dev-doubles.enabled=true`. Do not introduce parallel properties like `orchestrator.mock-enabled`. `DevDoubleGateTest` (playbook 03 Unit 9b Step D) enforces this; a parallel switch creates a second activation path that bypasses the gate and lets a misconfigured prod profile route real users to canned SSE responses while the central gate appears satisfied.

**`application-mock.yml`** — single dev-double activation property (the file may carry other unrelated overrides like `orchestrator.url` and `orchestrator.api-key`; the invariant scoped here is "exactly one property activates the dev-double gate", namely `app.dev-doubles.enabled=true`):

```yaml
# Activates the dev-double gate established in playbook 03 Unit 9b.
# This is the ONLY property that activates dev doubles. Do not add orchestrator.mock-enabled
# or any other parallel switch — DevDoubleGateTest enforces the single-gate invariant.
app:
  dev-doubles:
    enabled: true

orchestrator:
  url: http://localhost:8080  # ignored when MockOrchestratorClient is registered
  api-key: ${ORCHESTRATOR_API_KEY:mock-key}
```

`DevDoubleGateTest` (playbook 03 Unit 9b Step D) already includes `MockOrchestratorClient` in its `withUserConfiguration(...)` list — no changes required from this phase.

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

// Modes that allow loopback redirect URIs at runtime (consumed by
// src/auth/msalConfig.js). Local-auth is dev-server-only — see the
// build-command guard below for why `vite build --mode local-auth`
// must FAIL THE BUILD itself, not just throw at user runtime.
const LOCAL_AUTH_MODE = 'local-auth';

export default defineConfig(({ command, mode }) => {
  // BUILD-TIME GUARD (closes round-22 adversarial bypass).
  //
  // The runtime guard in `msalConfig.js` (`if PROD && mode === 'local-auth'
  // throw`) only fires when a USER loads the app. A CI pipeline running
  // `vite build --mode local-auth` would otherwise exit zero, publish a
  // poisoned artifact, and ship sign-in failure to production. This block
  // raises the failure to build time so a misconfigured pipeline fails
  // before the artifact is even emitted.
  //
  // The check is `command === 'build'` rather than `import.meta.env.PROD`
  // because Vite config evaluation is Node-side; `import.meta.env` is the
  // bundle-side abstraction. `command` is the canonical Node-side signal.
  if (command === 'build' && mode === LOCAL_AUTH_MODE) {
    throw new Error(
      'vite build --mode local-auth is forbidden. ' +
      'local-auth is a developer-machine convenience for `vite dev` only. ' +
      'Use the default `production` mode to build deployable bundles.',
    );
  }

  return {
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
  };
});
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
// a sanitized user-visible error.
//
// CRITICAL: this module MUST delegate to the hardened getToken in
// msalConfig.js (Step 6). Re-implementing acquireTokenSilent here would
// bypass the InteractionRequiredAuthError redirect, the sanitized error
// rendering, and the correlation-ID-only logging — all R11/SC6 controls.
// The single-source pattern keeps the auth boundary's hardening in exactly
// one file; auth.js is just the alias adapter.
import { getToken as hardenedGetToken, apiScope } from '../auth/msalConfig.js';

export async function getToken() {
  // Pull apiScope from msalConfig so the value has already been validated at
  // startup. Reading import.meta.env.VITE_API_SCOPE directly here would
  // bypass that validator and let a missing scope reach acquireTokenSilent.
  return hardenedGetToken([apiScope]);
}
```

**`src/services/ragApi.js`** (consumes the alias; no stub fallback):

```javascript
import { getToken } from '@/services/auth';

// LOAD-BEARING: build the endpoint from VITE_RAG_API_URL (validated at
// startup by msalConfig.js's placeholder check) — NEVER use a relative
// `/api/rag/ask` path. In a typical Vite SPA the frontend and backend
// are served from different origins, so a relative URL would hit the
// frontend's static host (404) instead of the orchestrator backend.
// `new URL(path, base)` produces an absolute URL when base is set and
// throws synchronously if base is missing or malformed — fail-loud beats
// silent wrong-origin requests.
const API_BASE = import.meta.env.VITE_RAG_API_URL;
const RAG_ASK_URL = new URL('/api/rag/ask', API_BASE).toString();

export async function callRagApi(payload) {
  // R8: getToken() failure must propagate. No silent catch-and-substitute
  // fallback — that pattern silently downgrades production to a stub
  // token and is the exact bug class the build-time alias is closing.
  const token = await getToken();
  return fetch(RAG_ASK_URL, {
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
2. **Sentinel layer (defense in depth):** we recursively walk the entire `dist/` tree and grep every `.js` file's content for the pre-committed sentinel UUID. Zero matches is the pass condition. The walk is implemented as a manual recursive function over `readdirSync(dir, { withFileTypes: true })` (works on Node 18+) rather than the Node-20-only `{ recursive: true }` flag — that flag is silently dropped on Node 18 and would skip hashed asset subdirectories like `dist/assets/`, producing a vacuous pass. Glob libraries are also avoided because some skip hashed asset directories outright.
3. **Filename guard:** no asset basename under `dist/` may contain `auth-stub`.
4. **False-pass guard:** `dist/` must exist and be non-empty. If a previous build was wiped and the leak test runs anyway, it would otherwise vacuously pass.

**`contract-tests/leak.spec.js`:**

```javascript
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM-safe __dirname (see contract.spec.js for rationale — Vitest's ESM
// runner does not define __dirname; resolve() against undefined throws).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');

const SENTINEL = '__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__';

function walkDist(dir = distDir) {
  // Manual recursive walk of dist/. Returns absolute paths of every regular
  // file. We avoid `readdirSync(dir, { recursive: true })` (Node 20+) because
  // on Node 18 that flag is silently ignored and the leak test then scans only
  // the top level of dist/ — vacuous pass when the auth-stub lands inside a
  // hashed subdirectory like dist/assets/. Manual walk works on Node 18+ and
  // is no slower in practice for a few hundred files. Glob libs are also
  // avoided: some implementations skip hashed asset subdirectories.
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDist(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
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

Run via the dedicated `pnpm test:leak` script defined in Step 5b — it cleans `dist/`, runs `vite build`, then runs only the leak spec. Running the leak spec ad-hoc (`pnpm vitest run contract-tests/leak.spec.js`) without a fresh build either fails the false-pass guard (no `dist/`) or scans a stale bundle (older `dist/`); use the script to avoid both.

**Step 5b — Build-mode regression check (closes round-22 adversarial bypass).**

The build-time guard added to `vite.config.js` in Step 4 (`if (command === 'build' && mode === 'local-auth') throw`) MUST be exercised by an automated regression check so a future contributor cannot silently revert it. The check needs three properties:

1. Cross-shell portable. The scaffolded project may run under cmd.exe / PowerShell where POSIX `!` negation is not available. Node is the only runtime guaranteed across all targets (already required by `engines.node >= 20`).
2. Asserts the specific guard error text, not just any non-zero exit. A `vite build` that fails for an unrelated reason (e.g., missing dependency) would otherwise pass the negation and silently mask a regressed guard.
3. Wired directly into `package.json` and gated by `pnpm test` so CI cannot skip it.

**`scripts/check-no-local-auth-build.mjs`** (scaffolded under the frontend root):

```javascript
#!/usr/bin/env node
// Regression check for the vite.config.js build-time guard. Closes the
// round-22 adversarial bypass: `vite build --mode local-auth` must FAIL
// the build with the guard's specific error message — not pass, and not
// fail for an unrelated reason.
//
// Exit codes:
//   0  PASS — build failed AND stderr contained the guard sentinel substring.
//   1  FAIL — build succeeded (guard regressed), OR build failed for a
//             different reason (we did not actually exercise the guard).
//
// Cross-shell: pure Node. Works on cmd.exe, PowerShell, bash, zsh.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Sentinel substring the guard's Error message must contain. Update both
// here AND in vite.config.js if the guard wording changes — a mismatch
// means the regression check is checking a stale string.
const GUARD_SENTINEL = 'vite build --mode local-auth is forbidden';

// Locate Vite's CLI script and invoke it via process.execPath. We do NOT
// use node_modules/.bin/vite.cmd on Windows because .cmd shims are shell
// scripts; spawnSync(..., { shell: false }) cannot launch them, and
// shell: true would re-introduce the cross-shell quoting hazards Step 5b
// is supposed to close. Calling vite.js through process.execPath is
// platform-agnostic, shell-free, and matches what npm/pnpm do internally.
const viteCli = resolve(projectRoot, 'node_modules/vite/bin/vite.js');
if (!existsSync(viteCli)) {
  console.error(`[check-no-local-auth-build] Vite CLI not found at ${viteCli}.`);
  console.error('  Run `pnpm install` (or `npm install`) before running this check.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [viteCli, 'build', '--mode', 'local-auth'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: false,
  },
);

// Distinguish "could not launch Node/Vite" (result.error set, status null)
// from "launched and failed/passed". A launch failure must not be silently
// reinterpreted as a guard regression OR a guard hit — both would mislead.
if (result.error) {
  console.error('[check-no-local-auth-build] FAIL: could not launch Vite.');
  console.error(`  ${result.error.message}`);
  process.exit(1);
}

if (result.status === 0) {
  console.error('[check-no-local-auth-build] FAIL: vite build --mode local-auth EXITED ZERO.');
  console.error('  The build-time guard in vite.config.js has regressed; a poisoned bundle could ship.');
  process.exit(1);
}

const combined = (result.stderr || '') + (result.stdout || '');
if (!combined.includes(GUARD_SENTINEL)) {
  console.error('[check-no-local-auth-build] FAIL: build failed but NOT for the guard reason.');
  console.error(`  Expected stderr to contain: "${GUARD_SENTINEL}"`);
  console.error('  Got:');
  console.error(combined.split('\n').slice(0, 20).map((l) => '    ' + l).join('\n'));
  process.exit(1);
}

console.log('[check-no-local-auth-build] PASS — build-time guard fired with expected message.');
process.exit(0);
```

**`package.json` `scripts` block:**

The leak spec needs a **fresh** `dist/` to be meaningful. Two failure modes the scripts must prevent:
- A clean CI checkout has no `dist/` → leak spec's false-pass guard would fire (correct), but `pnpm test` would halt before unit tests even run.
- A stale workspace has an old `dist/` from a previous build → leak spec scans the OLD bundle and passes vacuously, missing a regression introduced after that build.

Both are closed by splitting the test pipeline so the leak spec is gated on a freshly produced `dist/`, and the rest of the unit suite is decoupled from the build:

```json
{
  "scripts": {
    "build": "vite build",
    "build:clean": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\" && vite build",
    "check:no-local-auth-build": "node scripts/check-no-local-auth-build.mjs",
    "test:unit": "vitest run --exclude contract-tests/leak.spec.js",
    "test:leak": "pnpm run build:clean && vitest run contract-tests/leak.spec.js",
    "test": "pnpm run check:no-local-auth-build && pnpm run test:unit && pnpm run test:leak"
  }
}
```

What each script enforces:
- `build:clean` removes any prior `dist/` via Node `fs.rmSync(..., {recursive:true, force:true})` (cross-shell; works on cmd.exe / PowerShell / bash) and then runs `vite build`. Always emits a freshly built bundle.
- `test:unit` runs the unit + contract-drift + frontend Vitest suite, excluding the leak spec. Fast loop; no build dependency.
- `test:leak` runs `build:clean` first, then runs the leak spec only. Guarantees the bundle the leak spec scans was emitted seconds ago.
- `test` chains all three: build-mode regression guard → unit suite → fresh-build leak gate. CI gates on this top-level script. None of the gates can be skipped without editing the script directly.

A contributor who weakens any of the three guards sees the failure before the artifact ships, AND the failure points specifically at which gate failed (regression vs unit vs leak) — narrowing diagnosis.

---

## Step 6 — MSAL hardening (`msalConfig.js`)

Per R11, the scaffolded `msalConfig.js` template is hardened against four common production footguns: token-store XSS exposure, placeholder credentials shipped to prod, MSAL diagnostic info leaking to the DOM, and dead-end errors that lose the user mid-session.

**`src/auth/msalConfig.js`:**

```javascript
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// Substring-aware placeholder tokens. We do NOT use Set.has(value) here:
// real misconfig is almost always a TEMPLATED string (e.g.
// "https://login.microsoftonline.com/YOUR_TENANT_ID") rather than a literal
// "YOUR_TENANT_ID". Exact equality silently lets templated placeholders pass.
const PLACEHOLDER_TOKENS = [
  'YOUR_CLIENT_ID',
  'YOUR_TENANT_ID',
  'YOUR_AUTHORITY',
  'YOUR_REDIRECT_URI',
  'YOUR_API_SCOPE',
  '<tenant>',
  '<tenant-id>',
  '<client-id>',
  '<redirect-uri>',
  'TODO',
  'CHANGE_ME',
];

// Three modes that talk to a real MSAL on a developer machine: the two Vite
// dev modes that resolve auth-stub.js, plus `local-auth` (described in the
// offline-dev section below — real MSAL but a loopback redirect URI is OK).
// `production` is intentionally NOT in this list; a production build with a
// loopback redirect URI is a misconfigured deploy and must fail loud.
const ALLOWS_LOCAL_REDIRECT = new Set(['development', 'test', 'local-auth']);

const mode = import.meta.env.MODE;
const isDevMode = mode === 'development' || mode === 'test';

// LOAD-BEARING: `import.meta.env.PROD` is `false` only when Vite is serving
// from the dev server (`vite dev`); `vite build` always sets `PROD=true`,
// regardless of `--mode`. Gating the loopback allow-list on `!PROD` closes
// the round-21 adversarial bypass: `vite build --mode local-auth` would
// otherwise bake `mode === 'local-auth'` into a production bundle while
// still accepting loopback redirect URIs. Checking `mode` alone is NOT
// enough — `mode` is just a build-time string. `PROD` is the only flag
// Vite controls based on the actual command (dev vs build).
const isLocalRedirectAllowed =
  !import.meta.env.PROD && ALLOWS_LOCAL_REDIRECT.has(mode);

// Defense-in-depth: a production build that explicitly opted into the
// `local-auth` mode is always a misconfiguration. Fail loud at module load
// before any redirect URI is even evaluated.
if (import.meta.env.PROD && mode === 'local-auth') {
  const root = (typeof document !== 'undefined')
    ? (document.getElementById('app') || document.body)
    : null;
  if (root) {
    root.innerHTML = `
      <div role="alert" style="font-family:system-ui;padding:2rem;max-width:40rem;margin:4rem auto;border:1px solid #c00;border-radius:8px;">
        <h1 style="color:#c00;margin-top:0;">Production build with a developer auth mode</h1>
        <p>This bundle was built with <code>--mode local-auth</code>, which is a developer-machine convenience. Production builds must use the default <code>production</code> mode (which rejects loopback redirect URIs). Rebuild without <code>--mode local-auth</code> and redeploy.</p>
      </div>
    `;
  }
  throw new Error('msalConfig: PROD build with --mode local-auth is forbidden.');
}

// Loopback hostname detector. Covers four classes Microsoft Identity treats
// as loopback and MSAL will redirect to in dev:
//   1. `localhost`
//   2. IPv4: any `127.x.y.z` (RFC 3330, all of 127.0.0.0/8)
//   3. IPv6: `::1`
//   4. IPv4-mapped IPv6: `::ffff:127.x.y.z` and the compressed-hex form
//      Node normalizes them to (`::ffff:7f00:1`, `::ffff:7f05:607`, etc.)
//
// Node URL caveats (verified locally with `node -e ...`):
//   new URL('http://[::1]:5173').hostname                   // → '[::1]'
//   new URL('http://[::ffff:127.0.0.1]:5173').hostname      // → '[::ffff:7f00:1]'
//   new URL('http://[::ffff:127.5.6.7]:5173').hostname      // → '[::ffff:7f05:607]'
//   new URL('http://localhost:5173').hostname               // → 'localhost'
//   new URL('http://127.0.0.1:5173').hostname               // → '127.0.0.1'
// Node returns IPv6 hostnames WITH surrounding brackets (DOM URL impls
// sometimes return them bare). We strip a leading/trailing bracket pair so
// both shapes reduce to the same form before comparing. We also normalize
// IPv4-mapped IPv6 addresses (`::ffff:...`) into the IPv4 they wrap so
// `127.x.y.z` reachable through that wrapper is still caught.
function isLoopbackHost(value) {
  if (typeof value !== 'string') return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  // Normalize: lowercase, strip IPv6 brackets if present.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost') return true;
  // 127.0.0.0/8 — the entire 127.x.y.z block is loopback per RFC 3330.
  if (/^127(?:\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 loopback: ::1.
  if (host === '::1') return true;
  // IPv4-mapped IPv6: `::ffff:` prefix wrapping an IPv4 address.
  // Two surface forms reach us:
  //   (a) Dotted-decimal tail (rare from Node, common from raw input):
  //       `::ffff:127.0.0.1`. Match the tail against the IPv4 regex above.
  //   (b) Compressed-hex tail (what Node serializes IPv4-mapped to):
  //       `::ffff:7f00:1`. The first hex group's high byte is the first IPv4
  //       octet — for any 127.x.y.z mapping, that high byte is 0x7f.
  // Failing to handle (b) is the round-21 adversarial bypass: a production
  // build accepted `http://[::ffff:127.0.0.1]:5173` as a non-loopback URL.
  const mapped = host.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (/^127(?:\.\d{1,3}){3}$/.test(tail)) return true; // (a) dotted-decimal
    const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {                                            // (b) compressed-hex
      const word = parseInt(hex[1], 16);
      // High byte of the first 16-bit group == first IPv4 octet.
      if (((word >> 8) & 0xff) === 0x7f) return true;
    }
  }
  return false;
}

function isPlaceholder(value) {
  if (value === '' || value === undefined || value === null) return true;
  if (typeof value !== 'string') return true;
  // Trim then substring-scan against every known placeholder token.
  // Templated values like `https://login.microsoftonline.com/YOUR_TENANT_ID`
  // are caught here; exact-equality matching silently let them through.
  const trimmed = value.trim();
  if (trimmed === '') return true;
  for (const token of PLACEHOLDER_TOKENS) {
    if (trimmed.includes(token)) return true;
  }
  // Loopback redirect URIs are accepted ONLY in modes explicitly allow-listed
  // above. Treating them as a placeholder in `production` keeps a misconfigured
  // deploy from silently shipping; treating them as valid in `local-auth` lets
  // a developer run real MSAL against http://localhost:5173 (or 127.0.0.1, or
  // [::1]) without re-routing through a tunneling service.
  if (!isLocalRedirectAllowed && isLoopbackHost(trimmed)) return true;
  return false;
}

// API scope is read here so the same placeholder validator that gates clientId /
// authority / redirectUri also gates VITE_API_SCOPE. Without this, a missing
// scope would not fail at startup — it would fail silently inside acquireTokenSilent
// at first request, after the app has already mounted and looked healthy.
export const apiScope = import.meta.env.VITE_API_SCOPE;

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
    ['apiScope', apiScope],            // VITE_API_SCOPE — fail-closed at startup
  ];
  const bad = checks.filter(([, v]) => isPlaceholder(v));
  if (bad.length > 0) {
    const root = document.getElementById('app') || document.body;
    root.innerHTML = `
      <div role="alert" style="font-family:system-ui;padding:2rem;max-width:40rem;margin:4rem auto;border:1px solid #c00;border-radius:8px;">
        <h1 style="color:#c00;margin-top:0;">Authentication is not configured</h1>
        <p>Required MSAL values are missing or contain placeholder text. Set <code>VITE_MSAL_CLIENT_ID</code>, <code>VITE_MSAL_AUTHORITY</code>, <code>VITE_MSAL_REDIRECT_URI</code>, and <code>VITE_API_SCOPE</code> in your environment, then redeploy.</p>
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
- Use `MockOrchestratorClient` by running with `--spring.profiles.active=mock` (loads `application-mock.yml`, which sets `app.dev-doubles.enabled=true`).
- The single gate is `app.dev-doubles.enabled=true` — do NOT introduce `orchestrator.mock-enabled` or any other parallel property. `DevDoubleGateTest` enforces this invariant.

**Offline dev: two supported modes (and one unsupported one).**

The frontend `auth-stub.js` mints a fake non-RSA JWT for module-scope storage. The backend's `SecurityConfig` validates incoming tokens against the Entra ID JWKS, audience, and issuer using `NimbusReactiveJwtDecoder`. **The fake token will not pass** — that is the point of R6c/R7c: there is no dev backdoor in the auth chain, and adding one would silently re-introduce the v3 leak class. Plan accordingly.

**Mode 1 — Frontend-only dev (real backend not running).** The Vite dev alias resolves `@/services/auth` to `auth-stub.js`. Pair with a frontend-side mock for `/api/rag/ask` (e.g., MSW or a Vite middleware) so `ragApi.js` never reaches a real backend. Use this for pure UI/UX iteration where the auth boundary is irrelevant.

**Mode 2 — Frontend + backend dev (no orchestrator).** Backend uses `MockOrchestratorClient` via the dev-double gate; frontend acquires a **real** Entra ID JWT via MSAL.

Use the dedicated **`local-auth`** Vite mode here, NOT `--mode production`. `local-auth` is allow-listed by `msalConfig.js` to accept a `localhost` redirect URI (so MSAL can return to `http://localhost:5173` after sign-in) while still resolving the real `auth.js` path (NOT in Vite's dev-stub allowlist `['development', 'test']`). Running `--mode production` against a localhost redirect URI fails the placeholder validator at startup — by design, since a production build with a localhost redirect is a misconfigured deploy.

\`\`\`bash
# Terminal 1: Backend with the mock orchestrator profile (canned SSE).
# `dev` profile gives prod-like config; `mock` flips app.dev-doubles.enabled=true.
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev,mock'

# Terminal 2: Frontend in `local-auth` mode — real MSAL, localhost redirect OK.
cd frontend
pnpm dev --mode local-auth
\`\`\`

Visit `http://localhost:5173`, sign in via real MSAL, submit a query. Backend returns canned SSE; frontend renders it. **End-to-end works because the JWT is real, even though the orchestrator is faked.**

**Unsupported: fake-token + real backend.** Running `pnpm dev` (which resolves `auth-stub.js`) against the backend will return HTTP 401 from `oauth2ResourceServer().jwt()`. This is correct behavior — do not "fix" it by disabling backend JWT validation in the `dev` profile. R6c is non-negotiable: the auth boundary holds in every profile, including local dev. If you need the orchestrator faked AND the frontend without real auth, run Mode 1 (frontend-only) instead.

### Scenario: MSAL auth is not wired

**Frontend (development mode):**
- The Vite alias in `vite.config.js` resolves `@/services/auth` to `auth-stub.js` for `mode in ['development', 'test']` only.
- The dev stub returns a fake JWT held in a module-scoped variable (no localStorage). Reloading the page clears it; this is intentional.
- Console emits `[AUTH-STUB ACTIVE] __JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__` (the sentinel string the leak test greps for) so misconfigured environments self-announce. The sentinel argument is what pins the export into the bundle for tree-shaking-resistance — emitting just `true` would let Rollup drop the export and silently regress the leak test.

**Frontend (production mode):**
- The alias resolves to `auth.js` (real MSAL). There is no runtime catch-and-substitute fallback in `ragApi.js`. `getToken()` failures throw and surface via the sanitized error rendering in `msalConfig.js` (Step 6).
- The leak test (`contract-tests/leak.spec.js`) asserts the auth-stub never made it into `dist/`.

**To wire real auth:**
- Implement `src/services/auth.js` with real MSAL calls (see Step 4 template).
- Set `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, and `VITE_API_SCOPE` in your environment. All four are validated at startup by `msalConfig.js`; missing or placeholder values render the config-error screen and prevent app mount.
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
