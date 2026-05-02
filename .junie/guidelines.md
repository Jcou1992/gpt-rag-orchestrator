# Junie Project Guidelines — GPT-RAG Integration

This repo integrates the GPT-RAG Orchestrator (Python/FastAPI) into a **Vue 3 + Vuetify + Vite** frontend proxied by a **Kotlin + Spring Boot (WebFlux)** backend. Full architecture, contracts, and phased plan live in [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) — treat it as the source of truth for any design decision.

## Standing rules

- **Stack is not negotiable at the architecture level.** Vue 3 + Vuetify 3 + Vite + Pinia on the frontend. Kotlin + Spring Boot WebFlux + OAuth2 Resource Server on the backend. Library *versions*, language flavor (JS vs TS), and optional add-ons are negotiable; swapping Vuetify → PrimeVue (or similar) is not.
- **Frontend language default is JavaScript** (the team's current standard, carried over from the Vue 2 codebase). TypeScript is available as an opt-in during scaffolding — do not silently introduce `.ts` files.
- **Never expose the orchestrator directly to the browser.** All traffic goes through Spring Boot. Vue only speaks to `POST /api/rag/ask`.
- **SSE end-to-end.** Use `@microsoft/fetch-event-source` in Vue (native `EventSource` cannot send `Authorization` headers). Use WebClient reactive streaming in Spring (not `RestTemplate`).
- **JSON envelope in the proxy.** Spring normalizes the orchestrator's raw-text SSE into `{type: chunk|citation|done|error, ...}` events before forwarding. Don't parse markdown citations in Vue.
- **TDD for all generated code.** Red → green → refactor. No production code without a failing test first. Tests live alongside implementation: frontend `*.spec.js` (default) — or `*.spec.ts` only when the TypeScript opt-in variant is selected — and backend `*Test.kt`.
- **Auth tokens passthrough.** The user's Entra ID JWT is forwarded to the orchestrator for OBO. Never cache or log tokens.
- **No secrets in the repo.** App registrations, API keys, connection strings → environment variables or Key Vault references only.
- **The SSE events contract lives in `.junie/contracts/sse-events.schema.json`** (with examples in `.junie/contracts/sse-events.examples.json`). Do not restate it in prose — playbook 04 reads the canonical file via a Node copy step, and `scripts/check-r5-invariant.mjs` enforces the no-inline-schema invariant in `.junie/playbooks/**/*.md`. Extend this pattern (one schema file per contract under `.junie/contracts/`) when a second contract is canonicalized — until then, treat this rule as scoped to SSE events only.
- **Reactive Spring stack is locked, not just nominal.** The backend playbook templates use WebFlux types only: `ServerHttpSecurity`, `SecurityWebFilterChain`, `ReactiveJwtDecoder`, `NimbusReactiveJwtDecoder`, `WebTestClient`. Servlet imports — `HttpSecurity`, `SecurityFilterChain`, `JwtDecoder`, `NimbusJwtDecoder`, `MockMvc`, `@AutoConfigureMockMvc`, `jakarta.servlet.*`, `javax.servlet.*` — are forbidden in Kotlin/Java code blocks under `.junie/playbooks/**`. `scripts/check-stack-invariant.mjs` fails the build if any appear. Auth-boundary safety (R6/R7c/SC1/SC5) depends on the reactive chain wiring through the same filter that handles the SSE endpoint; a servlet `SecurityFilterChain` in a WebFlux app silently leaves the reactive endpoints unauthenticated.
- **Single dev-double activation gate.** Every dev/test-double bean across the scaffolded backend (frontend mock orchestrator, backend mock services, in-memory repositories, fakes) MUST be gated by `@DevOnlyBean` (which composes `@ConditionalOnProperty(name = "app.dev-doubles.enabled", havingValue = "true", matchIfMissing = false)`). There is exactly ONE switch — `app.dev-doubles.enabled` — that activates dev doubles. Do not introduce parallel switches like `orchestrator.mock-enabled`. `DevDoubleGateTest` enforces the single-gate invariant; a parallel switch creates a second activation path that bypasses it.
- **Single hardened-auth boundary.** Across the scaffolded frontend, exactly two `auth*.js` modules exist: `src/services/auth.js` (production adapter that delegates to `msalConfig.js`'s `hardenedGetToken`) and `src/services/auth-stub.js` (dev-only, sentinel-bearing, resolved by Vite alias only when `mode in ['development', 'test']`). NO dummy-JWT generation in `auth.js`, NO catch-and-substitute fallback in `ragApi.js`, NO inline `getToken` mock anywhere else. R8 invariant: `getToken()` failures throw and surface via the sanitized error rendering in `msalConfig.js`. `scripts/check-auth-policy.mjs` enforces this at the parser level — it greps `.junie/playbooks/**/*.md` for forbidden tokens (`STUB-JWT`, `auth-stub-token`, `dummy JWT`, `mocked getToken`, `.catch(() => '...')` fallbacks) and obsolete env-var names (`RAG_API_URL`, `VITE_MSAL_TENANT_ID`, `VITE_MSAL_API_SCOPE`).
- **Invariant scripts run in CI.** All three repo-side invariants — `scripts/check-r5-invariant.mjs`, `scripts/check-stack-invariant.mjs`, `scripts/check-auth-policy.mjs` — are wired into `.github/workflows/junie_invariants.yaml` so any PR that touches `.junie/**`, `INTEGRATION_PLAN.md`, or the invariant scripts themselves runs all three on GitHub. A reviewer who forgets to run them locally still sees the failure as a red check on the PR. Pushes to `main`, `develop`, `release/**`, and `playbookGeneration` are gated the same way. Manual local invocation: `node scripts/check-{r5,stack,auth-policy}-invariant.mjs` (for `auth-policy.mjs` the file name is exact).

## Guides & Playbooks

### 📚 Documentation (read these first)

**Three guides in [`guides/`](guides/) explain the skill:**

- [`guides/NAVIGATION.md`](guides/NAVIGATION.md) — **Start here if confused.** Explains which doc to read when, how they work together.
- [`guides/QUICK_START.md`](guides/QUICK_START.md) — **Real scenario walkthrough.** Step-by-step commands, outputs, failure recovery. Best for first-time users.
- [`guides/SKILL_USAGE.md`](guides/SKILL_USAGE.md) — **Complete reference manual.** All options, architecture, customization. Best for understanding the full design.
- [`guides/REFACTORING_SUMMARY.md`](guides/REFACTORING_SUMMARY.md) — Why the skill is built this way. Design decisions, tradeoffs.

### ▶️ Playbooks (invoke by name)

**Two phases:**

1. **Extract reference (optional but recommended)**
   - [`playbooks/extract-reference-brief.md`](playbooks/extract-reference-brief.md) — Run **inside a reference project** to capture stack, versions, conventions. Produces `REFERENCE_BRIEF.md` for the target project.

2. **Scaffold the RAG app (modular, recoverable)**
   - [`playbooks/create-rag-app.md`](playbooks/create-rag-app.md) — **Orchestrator.** Calls 5 sub-playbooks sequentially:
     1. **01-preflight** — lock all decisions (language, package manager, MSAL, add-ons). Output: `SCAFFOLD_DECISIONS.md`.
     2. **02-frontend-scaffold** — generate Vue 3 code TDD-first (9 units, 27 tests). Output: `frontend/`, `docs/frontend-api.md`.
     3. **03-backend-scaffold** — generate Kotlin/Spring code TDD-first (Units 1–8 + Unit 9b dev-double/OBO, 39 tests; Unit 9 MCP optional). Output: `backend/`, `docs/backend-openapi.md`.
     4. **04-contract-tests** — validate frontend ↔ backend contracts, set up mocks/fallbacks. Output: `contract-tests/`, `docs/communication-fallbacks.md`.
     5. **05-docs-generation** — generate 10+ comprehensive guides (1200+ lines). Output: `docs/` with setup, architecture, development, testing, troubleshooting, conventions.

   Each phase updates `SCAFFOLD_PROGRESS.md` as a memory checkpoint. If interrupted, re-run and it resumes.

## Invocation examples

> "Junie, follow `.junie/playbooks/create-rag-app.md`."

> "Junie, run the extract-reference-brief playbook against this project and write the output to `REFERENCE_BRIEF.md`."
