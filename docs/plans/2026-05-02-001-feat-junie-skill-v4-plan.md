---
title: feat: Junie Skill v4 — Single-Source Contracts & Drift Elimination
type: feat
status: active
date: 2026-05-02
deepened: 2026-05-02
origin: docs/brainstorms/junie-skill-v4-requirements.md
---

# feat: Junie Skill v4 — Single-Source Contracts & Drift Elimination

## Overview

Rewrite the `.junie/` scaffolding skill from v3 to v4. Eliminate two Codex-graded-D defects: (1) SSE schema drift between `INTEGRATION_PLAN.md` and `.junie/playbooks/04-contract-tests.md`, (2) auth-stub leaking to production via unguarded `.catch(() => 'STUB-JWT')`. Introduce a canonical contract directory (`.junie/contracts/`) with schema + travelling example fixture, build-time auth-stub exclusion via single Vite config with mode-conditional alias, sentinel-based leak detection backed by Rollup manifest assertion, broader backend mock-bean gate paired with backend OBO JWT validation, MSAL config hardening, and an LLM grounding spike against the actual Junie agent before full impl.

## Problem Frame

`.junie/` is a portable scaffolding skill — Junie (JetBrains AI agent) reads its playbooks to generate fresh Vue 3 + Kotlin/Spring RAG apps that consume this orchestrator. Codex adversarial review of v3 (`fe55235`) graded the skill **D** for two defects propagating to every scaffolded project. v3 has no public consumers (verified: 0 forks of the repo, never merged to `main`, no inbound git references); the residual risk that a teammate has scaffolded from v3 in a private clone is explicitly accepted in this plan (see Risks & Dependencies). A clean v4 cut is strictly cheaper than patching every generated repo later for the public-consumer case.

Root cause is structural: the playbook restates contracts in prose. Any future contract addition repeats the drift class. v4 fixes the two known defects AND establishes a single-source-of-truth pattern for the SSE contract, narrowed to that single contract until evidence demands wider rollout (see origin: `docs/brainstorms/junie-skill-v4-requirements.md`).

## Requirements Trace

- R1. Canonical SSE schema at `.junie/contracts/sse-events.schema.json` (machine-readable, draft-07, pinned `$schema` URI).
- R2. Schema covers 5 events: `conversationId`, `chunk`, `citation`, `done`, `error`. Each `type` const + required value fields, `additionalProperties: false`, top-level `oneOf`. `ConversationIdEvent` schema includes a `description` capturing the ordering invariant (emitted at most once, before first chunk) — the lifecycle constraint JSON Schema cannot express structurally.
- R3. Playbook 04 reads canonical schema directly into scaffolded `contract-tests/schemas/` via a Node-driven copy (`fs.copyFileSync`-style step, not POSIX `cp`) so it works on Windows shells. No inline schema duplication.
- R4. Drift detector validates a sidecar fixture (`.junie/contracts/sse-events.examples.json`, travelling with the canonical schema) against the schema; fails scaffold if any event drifts. Fixture is the single source for SSE event examples; INTEGRATION_PLAN.md references it by link.
- R4a. Drift detector additionally asserts that `INTEGRATION_PLAN.md` contains zero `data: {"type":` literal substrings (negative grep invariant prevents prose re-introduction of inline events).
- R5. No inline schema blocks remain in `.junie/playbooks/*.md` or `.junie/guides/*.md`. Verified by a parser-level check (`scripts/check-r5-invariant.mjs`) that extracts fenced ` ```json ` blocks and asserts none contain a JSON object with both `oneOf` and `additionalProperties` — flat regex is insufficient because legitimate prose mentions event names.
- R6. Frontend auth-stub gated by Vite single-config mode-conditional `resolve.alias` (`vite.config.js` exporting `defineConfig(({ mode }) => ...)`) so the stub module is excluded from prod bundle by build-time module-graph exclusion, not by runtime guard.
- R6a. Dev stub stores token in module-scoped variable, not `localStorage` (XSS- and extension-exfil-resistant even in dev).
- R6b. Scaffolded backend gates all dev/test-double beans via `@ConditionalOnProperty(name = "app.dev-doubles.enabled", havingValue = "true", matchIfMissing = false)` (fail-closed default — more bypass-resistant than `@Profile("!prod")` alone, which depends on `prod` profile being active and silently activates dev beans when no profile is set).
- R6c. Scaffolded backend's Spring Security `oauth2ResourceServer` is configured with the Entra ID JWKS URI, required `aud` claim, expected `iss`. Frontend hardening alone is decorative without backend token validation.
- R7. Frontend leak test uses two-layer detection: (a) **primary** — Rollup bundle manifest (`build.manifest: true`) asserts `auth-stub` module symbol absent from chunk source list; (b) **defense-in-depth** — `dist/**/*.js` greps for a pre-committed UUID-shaped sentinel constant (`__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__`). Test asserts `dist/` exists and is non-empty (no false-pass on missing build).
- R7b. Scaffolded backend integration test (`DevDoubleGateTest`) asserts (a) no bean carrying the `@DevOnlyBean` marker annotation registers when `app.dev-doubles.enabled` is unset/false, AND (b) no bean whose simple class name matches the case-insensitive pattern `^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` registers under the same condition. Marker annotation is the load-bearing control; name regex is defense-in-depth.
- R7c. Scaffolded backend integration test asserts that requests with a missing or invalid `Authorization: Bearer ...` header return HTTP 401 (validates R6c reaches the wire).
- R8. `ragApi.js` removes `.catch(() => 'STUB')` fallback. `getToken()` failure in production throws a sanitized error (no MSAL `errorMessage` / `authority` / `correlationId` rendered to DOM).
- R9. v4 ships as fresh `.junie/`. v3 archived to `.juniebackups/v3/`. Existing `.juniebackups/*.md` first migrated to `.juniebackups/v2/` to avoid path collision. `git status --porcelain .junie/ .juniebackups/` clean before archival.
- R10. `.junie/guidelines.md` adds narrow standing rule: SSE events contract lives in `.junie/contracts/`; pattern extends when a second contract is canonicalized. Rule explicitly scoped to SSE for now.
- R11. Scaffolded `msalConfig.js` template includes: `cacheLocation: 'sessionStorage'` (with inline comment explaining XSS-resistance rationale, warning future devs not to "fix" by switching to localStorage), startup validation rejecting placeholder `clientId`/`tenantId`/`authority` values (fail-closed config-error screen, app does not mount), sanitized `getToken()` error rendering, `acquireTokenSilent` with `InteractionRequiredAuthError` → redirect fallback only (other MSAL errors surface as user-visible error without redirect).

**Success criteria (6 deterministic gates, no LLM-judge dependency):**
- SC1. Frontend prod bundle Rollup manifest does not list `auth-stub` as a chunk module source AND `dist/**/*.js` greps for the pre-committed sentinel UUID return zero matches AND `dist/` is non-empty.
- SC2. Drift detector test fails when any event in `.junie/contracts/sse-events.examples.json` is missing from the schema or vice versa, AND fails when `INTEGRATION_PLAN.md` contains any `data: {"type":` literal (R4a negative invariant).
- SC3. Spring `DevDoubleGateTest` fails the build when any `@DevOnlyBean`-marked or pattern-matching bean registers without `app.dev-doubles.enabled=true`.
- SC4. Adding a 6th SSE event requires editing exactly two files, both under `.junie/contracts/` (the canonical schema + its sidecar examples). INTEGRATION_PLAN.md needs zero edits. Code-side changes (backend mapper, frontend handler) are orthogonal and do not count.
- SC5. Spring integration test asserts a request with no `Authorization: Bearer` header returns HTTP 401 (validates R6c at the wire).
- SC6. `msalConfig.js` startup validation rejects placeholder values (e.g., `clientId === 'YOUR_CLIENT_ID'`) and renders the config-error screen; app does not mount under those conditions. Asserted via Vitest unit on the validation function plus a Playwright (or Vitest+jsdom) smoke test verifying app does not reach mount.

## Scope Boundaries

**In scope**
- `.junie/contracts/sse-events.schema.json` (new)
- `.junie/contracts/sse-events.examples.json` sidecar fixture (new — under `.junie/contracts/` so it travels with the canonical schema; eliminates the v4 portability gap)
- `scripts/check-r5-invariant.mjs` (new — parser-level invariant for R5)
- Rewrite `.junie/playbooks/04-contract-tests.md`
- Update `.junie/playbooks/03-backend-scaffold.md` for backend gate + OBO validation
- Update `.junie/guidelines.md` for narrow R10 rule
- v3 → `.juniebackups/v3/` migration; preceded by v2 reorg into `.juniebackups/v2/`
- Updates to `INTEGRATION_PLAN.md` §3.1 to reference sidecar fixture instead of restating events inline

**Out of scope**
- Canonicalizing other contracts (request body, MCP wire format, error catalog) — same pattern, deferred until a second bug demands it
- Versioning policy / semver for `.junie/`
- Auto-publishing `.junie/` as standalone artifact
- Retroactively fixing already-scaffolded projects (no public consumers; private-clone consumers covered by accepted residual risk in Risks & Dependencies)
- Changing the 5-phase playbook structure or the locked stack

### Deferred to Separate Tasks

- **Real-target Junie scaffold attempt** (running `create-rag-app.md` end-to-end on a blank IntelliJ project). Tracked separately because it requires a fresh IntelliJ workspace AND access to the actual Junie agent. v4 ships in a "validated-but-unproven" state until this runs. Unit 7a (in this plan) gates v4 on internal artifact validation; the real-target run (Unit 7b, deferred) gates the user-facing release. **Plan acknowledges that internal SCs measure artifact hygiene, not user-observable scaffold function.**

## Context & Research

### Relevant Code and Patterns

- **Inline-schema pattern (to remove):** `.junie/playbooks/04-contract-tests.md:19-61` (current schema with 4 events) and `.junie/playbooks/04-contract-tests.md:174-207` (current auth-stub backdoor with `.catch(() => 'STUB-JWT')`).
- **SSE example source of truth (to migrate):** `INTEGRATION_PLAN.md:147-165` (5 events including `conversationId`).
- **Backend gate prior art:** `MockOrchestratorClient` referenced in v3 playbook 04 already gated by `@ConditionalOnProperty`. v4 generalizes this — every dev-double bean gets `@DevOnlyBean` + the same property gate.
- **Migration prior art:** `da63ea0` (Skill v2.0) and `fe55235` (Skill v3.0) commits show prior playbook restructure shape.
- **Standing-rule prior art:** `.junie/guidelines.md` "Standing rules" list — append the narrow R10 rule consistent with existing format.

### Institutional Learnings

- None directly applicable (no `docs/solutions/` entries about playbook design or scaffolding artifacts).

### External References

- Vite `defineConfig` mode-conditional pattern (`({ mode }) => ...`) — standard Vite idiom for build-mode-conditional config; preferred over multiple config files because it removes "wrong config passed to build" failure mode.
- Vite `build.manifest` config flag — required for the leak test's primary check (Rollup bundle manifest assertion). Without it, manifest does not exist and the assertion silently no-ops.
- JSON Schema draft-07 (matches existing v3 schema; `ajv` and `networknt/json-schema-validator` agree on `oneOf` semantics for this draft).
- Spring `@ConditionalOnProperty(matchIfMissing = false)` — fail-closed bean gate; activates only when the property is explicitly set to the matching value. Bypass-resistant compared to profile-based gating.
- Spring Security `oauth2ResourceServer().jwt()` configuration — JWKS URI + audience + issuer validation pattern.

## Key Technical Decisions

- **Sidecar fixture lives under `.junie/contracts/sse-events.examples.json`, not `docs/`.** Travels with the canonical schema; eliminates portability gap; SC4 holds literally because both files are under the same directory.
- **Single Vite config with mode-conditional alias, not two config files.** `vite.config.js` exports `defineConfig(({ mode }) => ...)` returning different aliases per `mode`. Eliminates the "wrong config passed to build" failure mode that two-file patterns introduce.
- **`build.manifest: true` + sentinel-grep two-layer leak detection.** Manifest assertion is minification-stable and primary; sentinel grep is secondary. Sentinel is pre-committed (`__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__`) — UUID-shaped, terser-stable, collision-resistant.
- **Backend gate: `@ConditionalOnProperty` with fail-closed default + custom `@DevOnlyBean` marker annotation, not `@Profile("!prod")`.** Profile-based gating activates dev beans by default when no profile is set (common in cloud-native deployments using `spring.config.import` or env-var-only config). Property-based gating with `matchIfMissing = false` is bypass-resistant. The `@DevOnlyBean` marker annotation is the load-bearing convention; bean-name regex catches teams that forget the annotation.
- **Backend OBO JWT validation in scope (R6c).** Frontend hardening without backend validation is decorative — every scaffolded app needs `oauth2ResourceServer` configured with JWKS URI, audience, issuer.
- **Module-scoped variable for dev token, not `localStorage`.** XSS- and extension-exfil-resistant in dev. Dev token does not persist across page reloads (intentional; documented in playbook so devs aren't surprised).
- **Schema emission via Node `fs.copyFileSync`-style step, not POSIX `cp`.** Cross-platform (Windows-friendly). Embedded in a small generation script.
- **Spike-first execution order, runs against actual Junie.** No agent substitution. The risk class is Junie-specific grounding behavior; testing on a different agent (Claude Code) provides near-zero evidence about Junie. Spike is gated on IntelliJ workspace availability; if the workspace cost (~30 min one-time setup) is unavailable, the spike is downgraded to a smoke test and the actual GO/NO-GO gate moves to the deferred real-target run (Unit 7b). One or the other; not both substitutions stacked.
- **Spike NO-GO default fallback: option (a) — generator-script-enforced single-source.** Keep schema inline in playbook 04 but add a CI check that lints inline schema against the canonical file. Preserves R5 invariant via tooling rather than via Junie's grounding behavior. Documented as the default fallback in the spike doc template.
- **Narrow R10, not "all contracts".** Pre-committing to a pattern validated on one contract is framework-ahead-of-need. Promote to general rule when a second contract is canonicalized.
- **MSAL hardening promoted to R11 + SC6.** v3 review framing called it "security-critical scaffolded code." Treating it as un-numbered ships substantial security behavior with no acceptance gate. R11 + SC6 give it explicit traceability.
- **Vite-locked stack is now a security-correctness dependency.** Auth-boundary safety (R6 + SC1) depends on Vite's `resolve.alias` semantics. If the stack ever unlocks, the safety guarantee evaporates. Documented under Unchanged Invariants and Risks & Dependencies.

## Open Questions

### Resolved During Planning

- **Schema emission mechanism**: Node `fs.copyFileSync`-style step in a small generation script invoked by playbook 04. Cross-platform. (origin Q: "How exactly does playbook 04 emit contract-tests/schemas/?")
- **Drift-detector source format**: Sidecar fixture file `.junie/contracts/sse-events.examples.json` (under `.junie/contracts/`, travels with schema). INTEGRATION_PLAN.md §3.1 links to it instead of restating events. R4a adds a negative-grep invariant on INTEGRATION_PLAN.md to prevent prose re-introduction. (origin Q: "regex vs parsed Markdown vs maintained fixture")
- **Stub import strategy**: Single `vite.config.js` with `defineConfig(({ mode }) => ({ resolve: { alias: { '@/services/auth': mode === 'production' ? './src/services/auth.js' : './src/services/auth-stub.js' } } }))`. Single source of truth for build-mode-conditional alias. (origin Q: "alias swap vs dynamic import vs naive guard")
- **Leak detection method**: Two-layer — Rollup bundle manifest (primary, requires `build.manifest: true`) + sentinel UUID grep (secondary). Plan pre-commits the exact sentinel value. (origin Q: "grep vs source-map walk vs visualizer")
- **Sentinel string**: `__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__` (pre-committed in plan, not deferred to impl).
- **Backend gate mechanism**: `@ConditionalOnProperty(name = "app.dev-doubles.enabled", havingValue = "true", matchIfMissing = false)` (fail-closed) + custom `@DevOnlyBean` marker annotation. (origin Q: "does Spring need an equivalent")
- **Backend test detection breadth**: Marker annotation primary + case-insensitive regex over `(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` prefix as secondary.
- **Backend OBO JWT validation**: In scope as R6c + SC5.
- **MSAL hardening status**: Elevated to R11 + SC6.
- **v3 unused verification**: 0 forks, never merged to `main`, no inbound git refs. Private-clone residual risk explicitly accepted (see Risks & Dependencies).
- **v2 archive collision**: Reorganize `.juniebackups/*.md` into `.juniebackups/v2/` first, then archive v3 into `.juniebackups/v3/`. Files enumerated in Unit 1.
- **Spike agent**: Junie itself (no Claude Code substitution). If IntelliJ workspace unavailable at spike time, spike downgrades to smoke test and the real GO/NO-GO gate moves to Unit 7b (deferred real-target run).
- **Spike NO-GO fallback**: Option (a) — generator-script-enforced single-source.
- **Unit 7 split**: 7a (in-repo static artifact validation, gates v4 ship) + 7b (real-target scaffold run, deferred). v4 ships when 7a passes; 7b gates the user-facing release.

### Deferred to Implementation

- **Exact frontend test runner integration for the leak test** (Vitest config to load built `dist/` artifact). Resolves once `npm run build` artifact paths are confirmed during impl.
- **Backend integration test framework choice** (`@SpringBootTest` vs `ApplicationContextRunner`). Resolves at impl time per scaffolded backend's existing test setup; doc both options in playbook 03 update.
- **Junie grounding spike prompt wording**. Unit 3 defines GO/NO-GO criteria but the exact prompt sent to Junie is finalized inside the spike — depends on what minimum v4 content reads naturally.
- **`@DevOnlyBean` annotation package location** within the scaffolded backend (e.g., `com.example.config.annotations` vs `com.example.security`). Resolves per scaffolded backend conventions.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Single-source-of-truth flow for SSE events:**

```
.junie/contracts/
├── sse-events.schema.json        ← canonical (one file, draft-07, 5 events)
└── sse-events.examples.json      ← sidecar fixture (5 example events; travels with schema)
        ▲
        └── INTEGRATION_PLAN.md §3.1 (links to fixture; no inline restatement; R4a grep invariant guards re-introduction)

.junie/playbooks/04-contract-tests.md
        │
        └── instructs scaffolder:
              Node-driven copy: .junie/contracts/sse-events.schema.json
                             →  contract-tests/schemas/ask-chunk-event.schema.json
              emit drift test (validates sidecar against schema)
              emit frontend leak test (manifest assertion + sentinel grep)
              emit Vite single-config alias
              emit backend gate + OBO validation
              emit MSAL hardened config
```

**Auth-stub exclusion via single Vite config (mode-conditional alias):**

```
// vite.config.js (single file; idiomatic mode-conditional defineConfig)
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  build: { manifest: true },
  resolve: {
    alias: {
      // Absolute paths required (Vite resolves alias values relative to importer otherwise).
      // Allowlist dev-mode only; any mode that's not 'development'/'test' resolves to the real client.
      // Defends against `vite build --mode staging` (or any custom mode) silently shipping the stub.
      '@/services/auth':
        ['development', 'test'].includes(mode)
          ? fileURLToPath(new URL('./src/services/auth-stub.js', import.meta.url)) // dev only
          : fileURLToPath(new URL('./src/services/auth.js',      import.meta.url)) // real MSAL, no fallback
    }
  }
}))

// ragApi.js
import { getToken } from '@/services/auth'  // resolves at build time per mode

// auth-stub.js (dev only; never present in prod manifest)
// Sentinel must be referenced by side-effect-bearing code; otherwise Rollup tree-shakes
// the unused export and the secondary leak grep becomes vacuously satisfied.
export const __JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__ = true
console.warn('[AUTH-STUB ACTIVE]', __JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__)
// ^ side-effect at module top-level keeps the sentinel in the emitted bundle
//   AND surfaces a console signal for misconfigured environments.
```

**Canonical schema sketch (Unit 2):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://github.com/Jcou1992/gpt-rag-orchestrator/.junie/contracts/sse-events.schema.json",
  "$defs": {
    "ConversationIdEvent": {
      "type": "object",
      "description": "Emitted at most once, before the first chunk event.",
      "properties": { "type": { "const": "conversationId" }, "value": { "type": "string" } },
      "required": ["type", "value"],
      "additionalProperties": false
    },
    "ChunkEvent": { "...": "type=chunk; required text:string" },
    "CitationEvent": { "...": "type=citation; required title:string, url:string" },
    "DoneEvent": { "...": "type=done; no payload" },
    "ErrorEvent": { "...": "type=error; required code:string, message:string" }
  },
  "oneOf": [
    { "$ref": "#/$defs/ConversationIdEvent" },
    { "$ref": "#/$defs/ChunkEvent" },
    { "$ref": "#/$defs/CitationEvent" },
    { "$ref": "#/$defs/DoneEvent" },
    { "$ref": "#/$defs/ErrorEvent" }
  ]
}
```

## Output Structure

```
.junie/
├── contracts/                       # NEW
│   ├── sse-events.schema.json       # NEW: canonical SSE schema (R1, R2)
│   └── sse-events.examples.json     # NEW: sidecar fixture (R4) — travels with schema
├── guidelines.md                    # MODIFY: add narrow R10 rule
├── playbooks/
│   ├── 03-backend-scaffold.md       # MODIFY: R6b property gate + @DevOnlyBean,
│   │                                 #          R6c OBO validation, R7b/R7c integration tests
│   └── 04-contract-tests.md         # REWRITE: remove inline schema, Node-driven schema copy,
│                                    #          single-config Vite alias, two-layer leak test,
│                                    #          drift detector, MSAL hardening (R11)
│   └── (other phase playbooks unchanged)
└── (guides/ unchanged, but R5 invariant runs against them)

scripts/
└── check-r5-invariant.mjs           # NEW: parser-level R5 invariant check

.juniebackups/
├── v2/                              # NEW: existing top-level *.md moved here
│   ├── NAVIGATION.md
│   ├── QUICK_START.md
│   ├── README.md
│   ├── REFACTORING_SUMMARY.md
│   └── SKILL_USAGE.md
└── v3/                              # NEW: snapshot of current .junie/ state
    └── (full v3 .junie/ tree)

INTEGRATION_PLAN.md                  # MODIFY §3.1: link to .junie/contracts/sse-events.examples.json

docs/spikes/
├── 2026-05-junie-grounding-spike.md      # NEW: Unit 3 transcript + GO/NO-GO + selected fallback
└── 2026-05-junie-v4-validation.md        # NEW: Unit 7a transcript + 6 SC results
```

## Implementation Units

- [ ] **Unit 1: Pre-flight migration — reorganize backups, archive v3**

**Goal:** Clear collision, snapshot v3 before any v4 edits land. Reversible — if Unit 3 spike fails, this is the only persistent change.

**Requirements:** R9

**Dependencies:** None.

**Files:**
- Create dir: `.juniebackups/v2/`
- Create dir: `.juniebackups/v3/`
- Move (each via `git mv` to preserve history):
  - `.juniebackups/NAVIGATION.md` → `.juniebackups/v2/NAVIGATION.md`
  - `.juniebackups/QUICK_START.md` → `.juniebackups/v2/QUICK_START.md`
  - `.juniebackups/README.md` → `.juniebackups/v2/README.md`
  - `.juniebackups/REFACTORING_SUMMARY.md` → `.juniebackups/v2/REFACTORING_SUMMARY.md`
  - `.juniebackups/SKILL_USAGE.md` → `.juniebackups/v2/SKILL_USAGE.md`
- Copy: `.junie/**` → `.juniebackups/v3/` (Node `fs.cpSync(src, dst, { recursive: true })` for cross-platform; not POSIX `cp`)

**Precondition:** `git status --porcelain .junie/ .juniebackups/` is clean before this unit runs. Snapshotting an in-flight working tree absorbs uncommitted edits into the v3 archive and changes the meaning of "reversible." If non-empty: stash, run Unit 1, pop after verification.

**Approach:**
- `git mv` enumerated files (5 specific paths above, not glob).
- Node-driven recursive copy of `.junie/` into `.juniebackups/v3/` — copy not move; `.junie/` stays in place for in-place rewrite.
- Verify with `diff -r .junie/ .juniebackups/v3/` (post-copy, pre-edit; must be empty).

**Patterns to follow:**
- v1 → v2 → v3 archive pattern from prior commits (`a699f9a`, `da63ea0`, `fe55235`).

**Test scenarios:**
- Test expectation: none — file-system reorganization, no behavioral change. Verification is `diff -r` (see Verification).

**Verification:**
- `diff -r .junie/ .juniebackups/v3/` exits 0.
- `.juniebackups/v2/` contains exactly the 5 files enumerated above.
- No file in `.junie/` modified yet (`git diff --stat .junie/` shows zero).

---

- [ ] **Unit 2: Canonical SSE schema + sidecar fixture (under `.junie/contracts/`)**

**Goal:** Author the single source of truth. Both schema and example fixture live under `.junie/contracts/` so they travel together with the portable skill artifact. Minimum viable v4 surface for Unit 3 spike to validate.

**Requirements:** R1, R2, R4, R4a

**Dependencies:** Unit 1.

**Files:**
- Create: `.junie/contracts/sse-events.schema.json`
- Create: `.junie/contracts/sse-events.examples.json`
- Modify: `INTEGRATION_PLAN.md` §3.1 (replace inline `data: {...}` examples with link to sidecar fixture; keep prose narrative)

**Approach:**
- Schema body follows the directional sketch in High-Level Technical Design above. JSON Schema draft-07. Top-level `oneOf` with 5 `$defs`. `ConversationIdEvent` carries the ordering invariant in its `description`. Pin `$id` to a stable URL identifying this canonical file.
- Sidecar: array of 5 example event objects matching `INTEGRATION_PLAN.md:147-165` literally (`{"type":"conversationId","value":"c-123"}`, etc.).
- INTEGRATION_PLAN.md §3.1 edit: delete the `data: {...}` example block (currently spans approximately lines 152-166: from the line containing `data: {"type":"conversationId","value":"c-123"}` through the closing of the surrounding fenced code block, including any blank-line separators between events). Replace the deleted block with one line of prose: `Examples: see [.junie/contracts/sse-events.examples.json](.junie/contracts/sse-events.examples.json) — validated by the contract test.` Surrounding prose narrative ("Response SSE..." paragraph and the "Errores estructurados" paragraph) stays. The dangling fenced code block opener/closer is removed along with its contents — do not leave an empty ` ``` ... ``` ` fence.

**Patterns to follow:**
- Existing schema fragment in `.junie/playbooks/04-contract-tests.md:19-61` (uses draft-07, `oneOf`, `additionalProperties: false`) — extract structure, add `ConversationIdEvent`.
- Event field shapes from `INTEGRATION_PLAN.md:147-165`.

**Test scenarios:**
- Happy path: ajv parses `sse-events.schema.json` without error; reports valid draft-07.
- Happy path: every entry in `sse-events.examples.json` validates against schema's `oneOf`.
- Edge case: unknown `type` value in a fixture entry fails `oneOf` with descriptive error naming the bad type.
- Edge case: `additionalProperties: false` rejects an event with extra field.
- Edge case: missing required field (`conversationId` without `value`) fails with field-name-bearing error.

**Verification:**
- `npx ajv compile -s .junie/contracts/sse-events.schema.json` succeeds.
- `node -e "const {default: Ajv} = require('ajv'); const s = require('./.junie/contracts/sse-events.schema.json'); const e = require('./.junie/contracts/sse-events.examples.json'); const v = new Ajv().compile(s); for (const x of e) if (!v(x)) { console.error(v.errors); process.exit(1) }"` exits 0.
- `INTEGRATION_PLAN.md` no longer contains inline `data: {"type":` substrings (R4a invariant precursor); link to sidecar present.

---

- [ ] **Unit 3: Junie LLM grounding spike (GO/NO-GO gate, runs on Junie itself)**

**Goal:** Validate that **Junie** can ground scaffold generation in an external schema file before committing to the full playbook rewrite. Highest-risk assumption in the v4 design. **No agent substitution permitted** — substituting Claude Code or another agent for Junie produces a verdict that doesn't address the actual risk class.

**Requirements:** Validates R3 feasibility. Gates Units 4-6 in this plan.

**Dependencies:** Unit 2.

**Files:**
- Create: `docs/spikes/2026-05-junie-grounding-spike.md` (test scaffold prompt + observed Junie output + GO/NO-GO verdict + selected fallback if NO-GO)

**Approach:**
- Set up a scratch IntelliJ project (outside this repo) with Junie enabled.
- Copy minimum v4 content into it: `.junie/contracts/sse-events.schema.json`, `.junie/contracts/sse-events.examples.json`, plus a single placeholder playbook fragment that says "read the canonical schema at `.junie/contracts/sse-events.schema.json` and emit `contract-tests/schemas/ask-chunk-event.schema.json` matching it."
- Prompt **Junie** (the actual JetBrains AI agent in IntelliJ) to scaffold `contract-tests/schemas/`. No substitution.
- Verify the output: did Junie (a) read the canonical file, (b) produce a schema in `contract-tests/schemas/` byte-equivalent or structurally equivalent, (c) avoid hallucinating events not in the canonical?
- **GO** if all 3 hold. **NO-GO** if Junie restates the schema from memory, drops events, or invents events.
- **NO-GO default fallback (selected at plan time):** option (a) — generator-script-enforced single-source. Keep schema inline in playbook 04 but add `scripts/check-r5-invariant.mjs` extended to also lint inline schema blocks against the canonical file. Preserves R5 outcome via tooling. Document the selection in the spike doc.
- **If IntelliJ workspace genuinely unavailable for spike (rare):** downgrade Unit 3 to a smoke test (Claude Code as approximation), explicitly flag the GO verdict as conditional, and move the actual GO/NO-GO gate to Unit 7b (deferred real-target run). Do not pretend a Claude Code GO is a Junie GO.
- Record outcome in the spike document including which path was taken (real Junie spike, or downgraded smoke test).

**Patterns to follow:**
- Spike documents under `docs/spikes/` (create dir if absent) — short-form, hypothesis + method + result + verdict.

**Test scenarios:**
- Happy path (GO): Junie's output `contract-tests/schemas/ask-chunk-event.schema.json` validates the same 5 fixture events as the canonical.
- Failure mode (NO-GO): Junie's output is missing `conversationId`, has extra events, or differs structurally from canonical.
- Failure mode (NO-GO): Junie restates schema body inline in playbook output instead of copying the canonical file.

**Verification:**
- `docs/spikes/2026-05-junie-grounding-spike.md` exists with: verdict (GO/NO-GO/CONDITIONAL-GO), spike-agent identity (Junie or downgraded), observed output transcript, selected fallback if NO-GO.
- If GO: proceed to Unit 4. If NO-GO: switch to fallback path before executing Units 4-6. If CONDITIONAL-GO: proceed to Unit 4 but require Unit 7b (deferred) before user-facing release.

---

- [ ] **Unit 4: Rewrite `04-contract-tests.md` (frontend gate, drift detector, leak test, MSAL hardening)**

**Goal:** Replace inline schema and auth-stub backdoor with the v4 patterns: Node-driven schema copy, single-config Vite alias, two-layer leak detection, drift detector, MSAL hardening per R11.

**Requirements:** R3, R4, R4a, R5, R6, R6a, R7, R8, R11

**Dependencies:** Unit 3 (GO or CONDITIONAL-GO verdict; on NO-GO follow fallback).

**Files:**
- Modify: `.junie/playbooks/04-contract-tests.md` (substantial rewrite of Steps 1-4; preserve overall playbook header + step structure)
- Create: `scripts/check-r5-invariant.mjs` (parser-level invariant — extracts fenced ` ```json ` blocks across `.junie/playbooks/**/*.md` and `.junie/guides/**/*.md`, asserts no extracted block contains both `oneOf` and `additionalProperties` keys)

**Execution note:** Test-first for the patterns the playbook produces — the playbook must specify the expected scaffolder output as a contract (input → expected files) so the implementer can verify a real scaffold run matches.

**Approach:**
- **Schema emission step** (replaces v3 Step 1): instructs scaffolder to invoke a small Node script `node -e "require('fs').copyFileSync('.junie/contracts/sse-events.schema.json', 'contract-tests/schemas/ask-chunk-event.schema.json')"` (or equivalent npm script). Cross-platform. **Precondition documented in playbook:** scaffolded target has `.junie/` at its root (Junie skill activation copies it into target's working tree).
- **Schema copy for fixture** (new step): same mechanism copies `.junie/contracts/sse-events.examples.json` to `contract-tests/fixtures/sse-events.examples.json` so the contract test can validate fixture against schema in the target's working tree.
- **Drift test** (replaces v3 Step 2): `contract-tests/contract.spec.js` loads schema + fixture from the copied locations, validates each fixture entry against schema's `oneOf`. R4a additional assertion: greps `INTEGRATION_PLAN.md` (in canonical location relative to the playbook reference) for `data: {"type":` substrings — must be zero. If `INTEGRATION_PLAN.md` is not in target tree, drift test skips R4a check with a logged warning (R4a runs in this repo's CI, not in scaffolded targets).
- **Single-config Vite alias** (replaces v3 Step 4): playbook emits one `vite.config.js` with `defineConfig(({ mode }) => ({ build: { manifest: true }, resolve: { alias: { '@/services/auth': mode === 'production' ? './src/services/auth.js' : './src/services/auth-stub.js' } } }))`. `auth-stub.js` exports the pre-committed sentinel UUID and stores token in module-scoped variable (R6a). `ragApi.js` imports from `@/services/auth` only — no `.catch(() => 'STUB')` fallback (R8).
- **Frontend leak test** (new step, two-layer): `contract-tests/leak.spec.js` runs after `vite build` and:
  - Asserts `dist/.vite/manifest.json` exists, parses it, asserts no entry's `src` contains `auth-stub` (primary check; minification-stable).
  - Greps `dist/**/*.js` for `__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__`; asserts zero matches (defense-in-depth).
  - Asserts `dist/` exists and is non-empty (false-pass guard when no build ran).
- **MSAL hardening** (new step; emits scaffolded `msalConfig.js`): scaffolder produces a template containing:
  - `cacheLocation: 'sessionStorage'` with inline comment explaining XSS-resistance rationale and warning future devs not to switch to localStorage.
  - Startup validation rejecting placeholder `clientId`/`tenantId`/`authority` patterns; renders config-error screen and halts before app mounts.
  - Sanitized `getToken()` error rendering — catches MSAL error, logs only sanitized correlation ID, renders generic user message.
  - `acquireTokenSilent` with `InteractionRequiredAuthError` → redirect fallback only (other MSAL errors surface as user-visible error without redirect).
- **R5 enforcement**: no `oneOf` + `additionalProperties` JSON literals in playbook body. Verified by `scripts/check-r5-invariant.mjs` (parser-level, not regex).

**Patterns to follow:**
- Existing Step 1-4 structure in `.junie/playbooks/04-contract-tests.md` (preserve narrative voice).
- Vite `defineConfig` mode-conditional pattern from Vite docs.

**Test scenarios:**
- Happy path: scaffold dry-run reads playbook 04 and outputs the expected file list (`contract-tests/schemas/ask-chunk-event.schema.json`, `contract-tests/fixtures/sse-events.examples.json`, `contract-tests/leak.spec.js`, `contract-tests/contract.spec.js`, `vite.config.js`, `src/services/auth-stub.js`, `src/services/auth.js`, `msalConfig.js`).
- Happy path: `contract-tests/leak.spec.js` against a built prod `dist/` reports 0 sentinel matches AND manifest contains no `auth-stub` chunk source.
- Edge case: `contract-tests/leak.spec.js` with no `dist/` present fails with explicit "no build artifact found" error.
- Edge case: `contract-tests/leak.spec.js` with `build.manifest: false` fails with explicit "manifest disabled" error (not silent zero-match pass).
- Edge case: `contract-tests/contract.spec.js` rejects fixture entry with `type` not in schema's `oneOf`.
- Error path: `msalConfig.js` startup validation rejects `clientId === 'YOUR_CLIENT_ID'` and renders config-error screen; app does not mount.
- Error path: `getToken()` failure surfaces sanitized error — `errorMessage`, `authority`, `correlationId` not in DOM or any user-visible string.
- Integration: `ragApi.js` calling `getToken()` under prod build (alias resolves to `auth.js`) throws on failure; under dev build (alias resolves to `auth-stub.js`) returns in-memory stub token without touching `localStorage`.

**Verification:**
- `node scripts/check-r5-invariant.mjs` exits 0 (parser-level R5 invariant).
- Playbook contains an explicit Node-driven schema copy step (no POSIX `cp` instruction).
- Playbook references `__JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__` exactly twice (definition in `auth-stub.js` snippet + assertion in leak test).
- Playbook contains `cacheLocation: 'sessionStorage'` exactly once.
- Playbook contains `build.manifest: true` exactly once.
- No `.catch(() => 'STUB'` substring in playbook body.
- Playbook emits **one** `vite.config.js` (not two), confirmed by file list in scaffold dry-run.

---

- [ ] **Unit 5: Update `03-backend-scaffold.md` (property gate, OBO validation, integration tests as Unit 9b)**

**Goal:** Mirror frontend gate on the backend with bypass-resistant property gating; close the actual auth boundary by adding OBO JWT validation; add integration tests as a new Unit 9b in playbook 03.

**Requirements:** R6b, R6c, R7b, R7c, SC3, SC5

**Dependencies:** Unit 1 (Unit 5 only depends on archive completion; Unit 3's Junie-grounding spike is irrelevant to backend annotation patterns).

**Files:**
- Modify: `.junie/playbooks/03-backend-scaffold.md` (add Unit 9b: backend gate + OBO + integration tests; preserve existing 9-unit TDD structure)

**Execution note:** Test-first for the integration test patterns — playbook specifies expected test class shape so any v4-scaffolded backend has the gates from day one.

**Approach:**
- **Add as Unit 9b** in playbook 03 (immediately after current Unit 9), titled "Profile-gated dev-double + OBO JWT integration tests."
- **Property-based gate (R6b):** every dev/test-double bean class annotated with `@ConditionalOnProperty(name = "app.dev-doubles.enabled", havingValue = "true", matchIfMissing = false)`. Fail-closed default. Additionally annotated with custom `@DevOnlyBean` marker (load-bearing convention; bean-name regex is defense-in-depth).
- **OBO JWT validation (R6c):** Spring Security config emits `oauth2ResourceServer().jwt()` with JWKS URI from `app.entra.jwks-uri` property, required audience from `app.entra.audience`, expected issuer from `app.entra.issuer`. Validation runs on every authenticated endpoint. No silent acceptance of unsigned tokens.
- **`DevDoubleGateTest` (R7b):** `@SpringBootTest` (or `ApplicationContextRunner` — playbook documents both options) without setting `app.dev-doubles.enabled`. Asserts (a) no bean carrying `@DevOnlyBean` registers, AND (b) no bean whose simple class name matches case-insensitive `^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` registers. Test fails the build on any match.
- **`OboValidationTest` (R7c):** Spring integration test — sends a request with no `Authorization` header, asserts HTTP 401. Sends a request with malformed/expired/wrong-audience token, asserts 401. Sends a request with a valid token, asserts 200 (or expected business response).
- **Bean-name regex false-positives**: documented explicitly. `MockingjayController` would match. Marker annotation is the load-bearing control; teams refining the regex should keep the marker behavior as the primary check.

**Patterns to follow:**
- Existing 9-unit TDD structure in v3's `03-backend-scaffold.md`.
- `MockOrchestratorClient` / `@ConditionalOnProperty` reference from v3 playbook 04 (extend pattern).
- Spring Security `oauth2ResourceServer().jwt()` documentation.

**Test scenarios:**
- Happy path (R7b): `DevDoubleGateTest` passes when no `@DevOnlyBean` or pattern-matching bean is registered without `app.dev-doubles.enabled=true`.
- Failure mode (R7b): `DevDoubleGateTest` fails with name-bearing error when a developer adds `MockFooClient` without `@DevOnlyBean` or property gate.
- Failure mode (R7b): `DevDoubleGateTest` fails when `@DevOnlyBean`-marked bean activates without the property set.
- Edge case (R7b): bean named `MockingjayController` (false-positive risk) — test catches it; comment in playbook documents this is expected and how to refine the regex if needed.
- Integration (R7b): with `app.dev-doubles.enabled=true`, dev-double beans load (no regression of existing dev workflow).
- Happy path (R7c): request with valid Bearer token reaches handler.
- Failure mode (R7c): request with no `Authorization` header returns 401.
- Failure mode (R7c): request with malformed JWT returns 401.
- Failure mode (R7c): request with token whose `aud` doesn't match returns 401.
- Failure mode (R7c): request with token whose `iss` doesn't match returns 401.

**Verification:**
- Playbook 03 Unit 9b contains `@ConditionalOnProperty(name = "app.dev-doubles.enabled", havingValue = "true", matchIfMissing = false)` literal.
- Playbook 03 Unit 9b defines `@DevOnlyBean` annotation and references it in `DevDoubleGateTest`.
- Playbook 03 Unit 9b contains `oauth2ResourceServer` + `jwks-uri` + `audience` + `issuer` references.
- Playbook 03 Unit 9b explicitly mentions "fails the build" as the failure mode for both `DevDoubleGateTest` and `OboValidationTest`.

---

- [ ] **Unit 6: Update `guidelines.md` (R10 narrow rule)**

**Goal:** Codify the canonical-contracts pattern in standing rules so future playbook authors don't reintroduce drift, scoped narrowly to evidence (one canonicalized contract).

**Requirements:** R10

**Dependencies:** Unit 1 (independent of Units 3-5; no LLM-grounding risk).

**Files:**
- Modify: `.junie/guidelines.md` (append one bullet under "Standing rules")

**Approach:**
- Append a single bullet to "Standing rules" list, format-matching existing bullets:
  > **The SSE events contract lives in `.junie/contracts/sse-events.schema.json`** (with examples in `.junie/contracts/sse-events.examples.json`). Do not restate it in prose. Extend this pattern (one schema file per contract under `.junie/contracts/`) when a second contract is canonicalized — until then, treat this rule as scoped to SSE events only.
- No other edits to guidelines.md.

**Patterns to follow:**
- Existing bullet format under "Standing rules" (lead with `**bold rule**`, follow with single-sentence explanation).

**Test scenarios:**
- Test expectation: none — content addition. Verification by mechanical diff.

**Verification:**
- `grep -c '\.junie/contracts/sse-events\.schema\.json' .junie/guidelines.md` returns ≥ 1.
- New bullet appears under "Standing rules" section, not elsewhere.
- `git diff --stat .junie/guidelines.md` shows a single insertion hunk (no deletions, no edits to other lines).

---

- [ ] **Unit 7a: In-repo static artifact validation (gates v4 ship)**

**Goal:** Verify all 6 success criteria pass against the v4 artifacts in this repo before declaring v4 done. Static-only — does not require a real Junie scaffold run.

**Requirements:** SC1, SC2, SC3, SC4, SC5, SC6

**Dependencies:** Units 1-6.

**Files:**
- Create: `docs/spikes/2026-05-junie-v4-validation.md` (validation transcript + 6 SC results + verdict)

**Approach:**
- **SC1 (frontend leak gate):** Extract the leak-test snippet from the rewritten `.junie/playbooks/04-contract-tests.md` into a temporary scratch project. Build with the emitted `vite.config.js`. Run leak test. Confirm: manifest excludes `auth-stub`, sentinel grep returns zero, `dist/` non-empty.
- **SC2 (drift gate):** Run `scripts/check-r5-invariant.mjs` and the drift test directly against `.junie/contracts/sse-events.schema.json` + `.junie/contracts/sse-events.examples.json`. Add a test event with bad `type` to the fixture; confirm drift test fails with descriptive error. Restore fixture. Add inline `data: {"type":"test"}` to a temp INTEGRATION_PLAN.md copy; confirm R4a grep invariant fails.
- **SC3 (backend gate):** Extract `DevDoubleGateTest` pattern from playbook 03 Unit 9b into a temporary Spring Boot scratch project. Run with `app.dev-doubles.enabled` unset; confirm pass. Add `@DevOnlyBean class MockTestBean` without the property; re-run; confirm fail. Add `class FakeAuthClient`; re-run; confirm fail (name regex catches it). Remove the test beans.
- **SC4 (single-source extensibility):** Hypothetically add a 6th event (`heartbeat`) by editing `.junie/contracts/sse-events.schema.json` and `.junie/contracts/sse-events.examples.json`. Confirm: exactly two files changed, both under `.junie/contracts/`, INTEGRATION_PLAN.md unchanged. Run drift test; confirm pass.
- **SC5 (OBO validation):** Extract `OboValidationTest` from playbook 03 Unit 9b into a temporary Spring scratch project. Run; confirm 401 for missing/malformed/wrong-audience tokens.
- **SC6 (MSAL hardening):** Extract `msalConfig.js` template from playbook 04. Unit-test the validation function with placeholder values; confirm rejection. Smoke-test app boot with placeholder `clientId`; confirm config-error screen renders and app does not mount.
- Record observations in the validation document.

**Patterns to follow:**
- Spike document format from Unit 3.

**Test scenarios:**
- See Approach — each SC is a scenario with explicit input + action + expected outcome.

**Verification:**
- `docs/spikes/2026-05-junie-v4-validation.md` lists all 6 SCs with explicit pass/fail + evidence.
- All 6 SCs pass. If any fail, file follow-up issues; v4 ship blocks until they pass.

---

- [ ] **Unit 7b: Real-target Junie scaffold attempt (deferred — gates user-facing release)**

**Goal:** Run a real `create-rag-app.md` scaffold against a blank IntelliJ project. This is the only check that validates whether Junie produces a working scaffold from v4. **v4 ships when 7a passes; 7b gates the user-facing release announcement.**

**Requirements:** End-to-end validation of the complete v4 artifact; not tied to a specific R# but verifies the v4 product purpose.

**Dependencies:** Unit 7a passed; access to a fresh IntelliJ workspace + Junie agent.

**Files:**
- Create: `docs/spikes/2026-05-junie-v4-real-target.md` (real-target transcript + outcome + follow-up issues)

**Approach:**
- Set up a fresh blank IntelliJ project. Copy v4 `.junie/` + `INTEGRATION_PLAN.md` into it. Invoke "Junie, follow `.junie/playbooks/create-rag-app.md`."
- Observe each phase output. Capture: did Junie use the canonical schema correctly, did the generated scaffold's `pnpm build` produce a clean prod bundle (pass leak test), did the generated backend pass `DevDoubleGateTest` and `OboValidationTest`, did `msalConfig.js` template render and validate?
- Any defect surfaced becomes a v5 issue. v4 ships in "validated-but-unproven" state if 7b is delayed; ships in "validated-and-proven" state once 7b passes.

**Test scenarios:**
- Happy path: full scaffold completes, generated `frontend/`, `backend/`, `contract-tests/`, `docs/` all match playbook contracts.
- Failure modes: any deviation from playbook-specified file list, any test failing in the generated scaffold, any Junie hallucination of contract content.

**Verification:**
- `docs/spikes/2026-05-junie-v4-real-target.md` records outcome.
- If failures: filed as v5 issues with reproducer; v4 user-facing release announcement blocks until resolved.

## System-Wide Impact

- **Interaction graph:** `.junie/playbooks/04-contract-tests.md` and `.junie/playbooks/03-backend-scaffold.md` are read by Junie when scaffolding; outputs flow into target's `contract-tests/`, `backend/`, `src/services/`, `vite.config.js`, `msalConfig.js`. `.junie/contracts/sse-events.schema.json` + `.junie/contracts/sse-events.examples.json` are consumed by both playbook 04 (via Node copy step) and the drift detector (via direct read). `scripts/check-r5-invariant.mjs` runs against `.junie/playbooks/**` and `.junie/guides/**`.
- **Error propagation:** Drift detector + R4a grep + R5 invariant + leak test failures are scaffold-time / build-time errors with file:line context. Backend `DevDoubleGateTest` and `OboValidationTest` fail Spring tests with bean-name / endpoint evidence. MSAL config validation halts app boot with a config-error screen.
- **State lifecycle risks:** `localStorage` removal (R6a) means dev token doesn't persist across reloads. Intentional. Documented in playbook so devs aren't surprised. MSAL `sessionStorage` (R11) means sign-out occurs when last tab closes — also intentional, comment in template explains and warns against reverting.
- **API surface parity:** No external HTTP contract changes. `.junie/contracts/` is a new internal surface (consumed by Junie + scaffolded contract test). INTEGRATION_PLAN.md updates §3.1 prose only — documented HTTP contract (events, fields, ordering) unchanged.
- **Integration coverage:** Unit 7a covers all 6 SCs against in-repo artifacts. Unit 7b covers the cross-system end-to-end (Junie reads playbook, generates scaffold, scaffold builds and tests pass).
- **Unchanged invariants:**
  - 5-phase playbook structure (`01-preflight` → `05-docs-generation`) untouched.
  - Stack lock (Vue 3 + Vuetify + Vite + Pinia / Kotlin + Spring WebFlux + OAuth2) untouched. **Note: the lock now carries security-correctness weight — R6 + SC1 depend on Vite `resolve.alias` semantics. Unlocking the stack invalidates the auth-boundary safety guarantee.**
  - INTEGRATION_PLAN.md remains the prose architectural spec; only §3.1's example block is replaced with a sidecar link.
  - `.juniebackups/` archive convention preserved (was implicit; now explicit per-version subdirs).
  - All other v3 standing rules in `guidelines.md` remain.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Junie LLM cannot ground generation in external schema file (degrades scaffold quality). | Unit 3 spike runs against actual Junie (no agent substitution) — GO/NO-GO gate before Units 4-6. NO-GO triggers default fallback (option (a): generator-script-enforced single-source). |
| Vite `resolve.alias` mode-conditional doesn't tree-shake stub from prod (Vite version regression). | Unit 4's two-layer leak test (manifest + sentinel) catches the regression at build time. Manifest assertion is minification-stable. |
| Drift detector's sidecar fixture diverges from `INTEGRATION_PLAN.md` if someone edits one and not the other. | INTEGRATION_PLAN.md §3.1 only links to fixture (no inline restatement). R4a negative-grep invariant in drift detector blocks prose re-introduction. |
| Backend test regex false-negatives on differently-named test doubles (e.g., `Fake`, `Spy`). | Regex broadened to case-insensitive `^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)`. Custom `@DevOnlyBean` marker annotation is the load-bearing primary control; regex is defense-in-depth. |
| Backend test false-positives (`MockingjayController`). | Documented explicitly in playbook 03 Unit 9b. Marker annotation is primary; teams refining the regex keep the marker check. |
| `cp` step in playbook fails on Windows. | Replaced with Node `fs.copyFileSync`-style step. Cross-platform without depending on shell. |
| Wrong Vite config passed to prod build. | Eliminated by single-config + mode-conditional pattern. Only one `vite.config.js`; mode determines aliases. |
| Sentinel string false-positive (legitimate code happens to contain it). | Pre-committed UUID-shaped sentinel; collision probability negligible. Manifest assertion is the primary check; sentinel grep is defense-in-depth. |
| `build.manifest: false` silently no-ops the manifest assertion. | Leak test asserts manifest file exists before reading; fails with "manifest disabled" if missing. |
| Profile-based gating bypassed by deployments not setting `prod` profile. | Replaced with `@ConditionalOnProperty(matchIfMissing = false)` — fail-closed default; cannot be bypassed by missing profile. |
| Backend OBO JWT not validated → backend accepts unsigned tokens. | R6c adds `oauth2ResourceServer().jwt()` config; SC5 + R7c integration test asserts 401 for missing/invalid tokens. |
| MSAL `sessionStorage` breaks team's actual SSO requirements (cross-tab sharing). | Inline comment in scaffolded `msalConfig.js` explains rationale and warns against reverting. If team needs cross-tab, escalate to separate brainstorm — not a v4 deliverable. |
| MSAL placeholder values silently accepted by scaffolded app. | R11 startup validation rejects placeholders with config-error screen; SC6 asserts. |
| `getToken()` failure leaks MSAL diagnostic info to DOM. | R8 sanitized rendering; SC6 unit/smoke tests assert. |
| Real-target Junie scaffold reveals defects no static check caught (Unit 7b). | v4 ships in "validated-but-unproven" state on Unit 7a pass. Unit 7b gates the user-facing release announcement. Defects filed as v5 issues. |
| ConversationIdEvent ordering invariant not machine-enforced (JSON Schema can't express it). | Captured as `description` in schema; integration tests in real-target run (Unit 7b) verify ordering. Acknowledged limitation. |
| **v3 has a private/local clone we don't know about (residual after fork-count + main-merge check).** | Explicitly accepted residual risk. Mitigation cost (one-line team check) is low; doing it is recommended but not gating. If a private consumer is discovered, file a v3→v4 migration note and add to v4 release notes. |
| Vite-locked stack carries security-correctness weight. | Documented under Unchanged Invariants. If stack ever unlocks, R6 + SC1 must be re-evaluated. |
| Skill repo supply-chain compromise modifies canonical schema. | Out of scope for v4. Future work: schema integrity check (signed `$id` URL or content hash). Acknowledged risk. |
| Spike runs against Junie but IntelliJ workspace setup is genuinely unavailable. | CONDITIONAL-GO path: spike downgrades to Claude Code smoke test, real GO/NO-GO moves to Unit 7b. v4 doesn't ship to user-facing release without 7b in this scenario. |

## Documentation / Operational Notes

- Update `.junie/guides/QUICK_START.md` and `.junie/guides/SKILL_USAGE.md` ONLY IF they reference the inline schema or auth-stub fallback. R5 invariant (`scripts/check-r5-invariant.mjs`) runs against guides; any inline schema block in a guide fails the check.
- No CI changes for this repo (the gpt-rag-orchestrator) for v4 functionality. The `scripts/check-r5-invariant.mjs` invariant should run as part of any future repo CI; if no CI is wired today, it runs locally as part of Unit 4 verification.
- For scaffolded targets: playbook 04 emits `package.json` scripts that chain build + leak test (e.g., `"verify": "vite build && vitest run contract-tests/leak.spec.js"`) so the gate runs even when the target has no external CI yet.
- Promotion trigger for "all contracts" rule: when a second contract is canonicalized, `.junie/contracts/README.md` (if added later) lists known-pending candidates and the trigger condition.

## Known Limitations / v4.1 Backlog

Round-2 review surfaced these issues. Plan ships v4 as-is (option B); items below are tracked for v4.1 or impl-time resolution. None are blockers for Unit 7a-gated v4 ship.

**Plan-structure (resolve at impl time):**
- "Ships" semantics — Section "Deferred to Separate Tasks" says "v4 ships in validated-but-unproven state until 7b runs"; Unit 7b says "v4 ships when 7a passes; 7b gates user-facing release announcement." Pick one vocabulary at impl time. Recommended: "v4 artifact-complete on 7a; v4 user-facing release announcement on 7b."
- Unit 7a manual snippet extraction is methodologically circular (validates what a human reconstructed, not what Junie extracts). Mitigation at impl time: add `scripts/extract-playbook-snippets.mjs` keyed off HTML region markers in the playbook so extraction is mechanical and reproducible.

**Scaffolded-output fixes (implement during Units 4-5, not plan-structure changes):**
- Vite manifest path differs by major version (Vite 4: `dist/manifest.json`; Vite 5+: `dist/.vite/manifest.json`). Pin Vite major version in `.junie/guidelines.md` standing rules at impl time and use the matching path.
- Vite manifest `src` field only lists entry chunks, not transitive imports — manifest assertion alone won't catch transitive auth-stub inclusion. Strengthen during Unit 4 impl: walk Rollup module graph (custom plugin recording `moduleParsed`) OR keep manifest as weak signal and treat sentinel grep as primary.
- Sentinel grep glob (`dist/**/*.js`) may miss hashed assets under `dist/assets/`. Use Node `fs.readdirSync(dist, {recursive: true})` filter `.js` instead. Add filename-level check: assert no `dist/**/*` basename matches `*auth-stub*`.
- `@ConditionalOnProperty` on `@Configuration` class doesn't auto-cascade to `@Bean` methods unless class-level annotated. Make `@DevOnlyBean` a Spring meta-annotation (composed with `@AliasFor` carrying its own `@ConditionalOnProperty`) so method-level marker also gates the property check.
- `DevDoubleGateTest` may fail to bootstrap context when collaborators are dev-double-only. Use `ApplicationContextRunner` (sliced context) rather than `@SpringBootTest` to avoid `NoSuchBeanDefinitionException` masquerading as gate failure.
- SC5 wording too narrow ("missing/malformed/wrong-audience returns 401"). Broaden Unit 5 test scenarios at impl time to assert: forged JWT (valid structure, wrong key) → 401; wrong `aud` → 401; wrong `iss` → 401. SC5 stays in plan; test breadth handled in playbook content.
- CSRF posture undefined for Spring stateless JWT endpoints. At impl time scaffold `http.csrf(AbstractHttpConfigurer::disable)` with comment explaining safety (Bearer headers can't be cross-origin-injected; CSRF concerns cookie injection only).
- R11 MSAL `redirectUri` not in placeholder validation. Add `redirectUri === 'http://localhost:3000'` (or any localhost in non-dev mode) to startup-rejection set during Unit 4 impl.
- R5 invariant scope: restrict `scripts/check-r5-invariant.mjs` to `.junie/playbooks/**` only (exclude `.junie/guides/**`). Guides legitimately need didactic JSON-Schema examples for documentation purposes.
- MSAL `acquireTokenSilent` policy too narrow (only handles `InteractionRequiredAuthError`). Broaden during Unit 4 impl per matrix: `InteractionRequiredAuthError` + `BrowserAuthError: monitor_window_timeout|popup_window_error` → redirect; `ServerError 5xx` → backoff + 1 retry → "Sign in again" button; `ClientAuthError: no_account_error` → redirect; others → sanitized error WITH explicit recovery affordance.
- Spike NO-GO fallback presumes CI that doesn't exist. If NO-GO path activated, wire enforcement via pre-commit hook (`.git/hooks/pre-commit` invoking `node scripts/check-r5-invariant.mjs`) rather than abstract "CI check."
- Sentinel cross-contamination guard: add invariant scan asserting sentinel UUID appears only in `auth-stub.js` and the leak test. Future fixtures referencing the sentinel for negative-tests are forbidden.

**v4.1 candidates (deferred — not implemented in v4):**
- R12: API key (`X-API-KEY` / `APP_API_TOKEN`) lifecycle — scaffolded `application.yml` should reference via env var with no default, fail-startup on missing value. INTEGRATION_PLAN.md §3.2 + §7 gap row 6 flag this; v4 doesn't address.
- Backend supply-chain integrity for `.junie/contracts/sse-events.schema.json` and `scripts/check-r5-invariant.mjs` (signed `$id` URL OR content hash). Same risk class as schema compromise; current plan acknowledges schema half only.
- R4a downstream-target enforcement: scaffolded targets currently get "logged warning" + test-pass when INTEGRATION_PLAN.md absent. Either downgrade R4a's claim (this-repo only) OR emit target-side equivalent (generic "no inline `data: {\"type\":` literal in any `*.md`" check baked into target's `verify` script).
- Stack-lock-as-security-dependency: introduce a defense-in-depth runtime guard in `auth-stub.js` itself (e.g., `if (import.meta.env.PROD) throw new Error('stub loaded in prod')`) so the security guarantee survives a future bundler swap. v4 keeps the Vite-locked premise.
- MSAL `cacheLocation` upgrade path documentation — between `sessionStorage` (current) and encrypted-localStorage (`PrivateCache` in newer MSAL). Currently v4's comment only warns against reverting to plain localStorage.
- Schema `$id` URL — currently includes GitHub username; minor info-disclosure in scaffolded artifacts. Move to a stable bare-domain URL in v4.1.
- Contract-surface complexity budget: round-2 surfaced concern that R-list grew 50% in one review round. v4.1 should establish a hard cap on contract surface and a "future reviewer-surfaced gaps file v5 issues, not new Rs" rule.

**Out-of-skill-scope (acknowledged but not addressed):**
- Python orchestrator's own JWKS validation behavior. Spring OBO validation (R6c) is meaningful only if downstream orchestrator also validates (`aud`/`iss`/`sig`). INTEGRATION_PLAN.md §2.3 mentions a `DISABLE_AUTH=true` env path; if active, Spring's hardening is unilaterally effective but downstream trust chain broken. Out of v4 scope; tracked here for visibility.
- Adoption ceiling: v4 baking R6c/R7c/R11 into every scaffold assumes Entra ID + MSAL. Non-Entra teams can't consume the skill without ripping out the auth stack. Implicit narrowing of the audience; surface but don't fix in v4.

## Sources & References

- **Origin document:** [docs/brainstorms/junie-skill-v4-requirements.md](../brainstorms/junie-skill-v4-requirements.md)
- Codex adversarial review of v3 (this session, no persistent record).
- Document review (this plan, headless mode, 2026-05-02): 6 personas, 18 above-gate findings + 3 silent fixes applied; deepening pass folded 7 concrete fixes + 4 decision resolutions (MSAL → R11+SC6, SC4 reframed, spike → Junie, Unit 7 split).
- Related commits: `a699f9a` (v1.0), `da63ea0` (v2.0), `fe55235` (v3.0), `615faac` (this brainstorm).
- INTEGRATION_PLAN.md §3.1 (SSE event source of truth before fixture migration).
- Vite docs: `defineConfig` mode-conditional pattern, `build.manifest`.
- Spring Security docs: `oauth2ResourceServer().jwt()`.
- Spring Boot: `@ConditionalOnProperty(matchIfMissing = false)`.
- JSON Schema draft-07 specification.
