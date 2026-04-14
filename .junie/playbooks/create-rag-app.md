# Playbook: Create RAG App (Vue 3 + Spring Boot, TDD)

**Purpose:** Scaffold the full `frontend/` and `backend/` trees described in [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md) §4, wired to the contracts in §3, using strict TDD. Honor `REFERENCE_BRIEF.md` (if present) for versions and conventions.

**Run this playbook inside the target project (the one being scaffolded).**

---

## Operating principles

- **TDD is mandatory.** For every unit of behavior: write a failing test, show it fail, write the minimum code to pass, show it pass, refactor. Commit (or at minimum stage) at each green.
- **Interactive but efficient.** Ask all related questions in one grouped prompt. Never ask what you can infer from `REFERENCE_BRIEF.md` without showing the inferred value and offering override.
- **Idempotency with consent.** If a target directory exists, stop and ask the user: (a) abort, (b) scaffold into a sibling (`frontend-new/`), (c) merge (only for config files; never overwrite `.vue` / `.kt` without diff preview).
- **Read [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md) once at start.** It defines architecture, DTOs, error envelope, and phase ordering. Do not re-derive.
- **No placeholder TODOs in code unless the user explicitly deferred that feature.** A scaffold with empty `// TODO` everywhere is not what we want — generate working, tested stubs.

---

## Step 1 — Preflight (one grouped question)

Read in order: `REFERENCE_BRIEF.md` (if present), [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md), existing `frontend/` and `backend/` dirs.

Then ask the user in **one** message:

```
Ready to scaffold. Please confirm or override:

A. Reference brief
   Detected: <path or "none">. Use it as the source of truth for conventions? [Y/n]

B. Conflict policy
   frontend/ exists: <yes/no>
   backend/ exists: <yes/no>
   Policy if conflict: [abort / sibling-dir / merge-configs-only]?  (default: abort)

C. Package manager (frontend)
   Reference uses: <pnpm@9 / npm / yarn>
   Use same? [Y/n]   If n, choose: [pnpm / npm / yarn]

D. Node version
   Reference: <20.x / 22.x>
   Use same? [Y/n]   If n, specify.

E. JDK + Kotlin
   Reference: JDK <21>, Kotlin <1.9.x>
   Use same? [Y/n]   If n, specify.

F. Version bumps — I found newer stable versions for these vs. your reference:
   - vue:          <ref> → <latest>    [keep / bump]
   - vuetify:      <ref> → <latest>    [keep / bump]
   - vite:         <ref> → <latest>    [keep / bump]
   - pinia:        <ref> → <latest>    [keep / bump]
   - spring-boot:  <ref> → <latest>    [keep / bump]
   - kotlin:       <ref> → <latest>    [keep / bump]
   Default: keep ref versions. Reply with overrides only.

G. MSAL / Entra ID auth
   Options:
   (1) Scaffold MSAL now (@azure/msal-browser + @azure/msal-vue or composable). Requires: SPA client ID, tenant ID, API scope.
   (2) Leave as TODO — generate typed stubs + interface, wire nothing. You fill it in later.
   Choice? (default: 2)

H. Frontend language
   Default: JavaScript (team standard, carried from the Vue 2 codebase).
   Options:
   (1) JavaScript — `.js` files, `<script setup>` (no `lang="ts"`), JSDoc allowed for hints.
   (2) TypeScript — `.ts` + `.vue` with `<script setup lang="ts">`, adds `tsconfig.json`, `vue-tsc`, `typescript` devDeps.
   Choice? (default: 1)

I. Optional add-ons (pick any):
   [ ] vue-router        [ ] vue-i18n
   [ ] Playwright E2E    [ ] Storybook
   [ ] Testcontainers (backend integration tests)
   [ ] MCP server scaffolding (Phase 4 from plan) — adds io.modelcontextprotocol.sdk:mcp-spring-webflux
```

If no `REFERENCE_BRIEF.md`, warn once:
> No REFERENCE_BRIEF.md found. I can proceed using plan defaults (Vue 3.5, Vuetify 3.7, Vite 5, Spring Boot 3.3, Kotlin 1.9, JDK 21, pnpm). Continue? [Y/n/run extract-reference-brief first]

Wait for answers. Do not proceed on assumptions for A–H.

## Step 2 — Lock decisions

Write `SCAFFOLD_DECISIONS.md` at repo root capturing every answer from Step 1 plus timestamps. This file is the audit log; update it if the user changes their mind mid-scaffold.

## Step 3 — Frontend scaffold (TDD)

Target tree — file extensions depend on Step 1.H choice. Structure is [INTEGRATION_PLAN.md §4.2](../../INTEGRATION_PLAN.md); `.js` is the default, `.ts` + `tsconfig.json` only if TS was chosen.

```
frontend/
├── package.json
├── vite.config.{js|ts}
├── (tsconfig.json — TS only)
├── jsconfig.json          # JS mode: enables path aliases + editor intellisense
├── index.html
└── src/
    ├── main.{js|ts}
    ├── App.vue
    ├── components/rag/
    │   ├── RagChat.vue
    │   ├── RagMessage.vue
    │   ├── RagCitation.vue
    │   └── RagInput.vue
    ├── composables/
    │   ├── useRagChat.{js|ts}
    │   └── useSseClient.{js|ts}
    ├── services/
    │   └── ragApi.{js|ts}
    ├── models/            # JS mode — JSDoc typedefs live here (replaces types/)
    │   └── rag.js         # @typedef AskChunk, Citation, etc. via JSDoc
    └── plugins/
        └── markdown.{js|ts}
```

In JS mode:
- SFCs use `<script setup>` (no `lang="ts"`).
- Shared shapes are declared as JSDoc `@typedef` in `src/models/rag.js`; import with `/** @type {import('@/models/rag').AskChunk} */`.
- `jsconfig.json` enables `"checkJs": true` and `"baseUrl": "."` + `"paths"` so editors still give go-to-definition.
- Drop `typescript`, `vue-tsc`, and `@types/*` from devDeps.

TDD loop — do each unit in this order, one at a time, test-first. (File extension follows Step 1.H.)

1. `models/rag.js` **or** `types/rag.ts` — shape definitions. Tests: JS mode → a smoke test importing the module; TS mode → type-only (`expectTypeOf`).
2. `plugins/markdown.{js|ts}` — marked + DOMPurify + highlight.js. Tests: XSS input is sanitized; code fences are highlighted.
3. `composables/useSseClient.{js|ts}` — wraps `@microsoft/fetch-event-source`. Tests: parses `data:` lines, dispatches per event type, propagates `AbortController`, surfaces 401 / network errors.
4. `services/ragApi.{js|ts}` — thin HTTP wrapper over `useSseClient`. Tests: sends `Authorization` + `Accept: text/event-stream`, request body shape matches §3.1.
5. `composables/useRagChat.{js|ts}` — reactive state (messages, streaming flag, current conversationId, citations). Tests: appends chunks, accumulates citations, handles `done`, handles `error`, cancellation resets state.
6. `components/rag/RagCitation.vue` — chip. Tests: renders title + external link with `rel="noopener"`.
7. `components/rag/RagMessage.vue` — markdown bubble + citations list. Tests: renders sanitized markdown, groups citations below content.
8. `components/rag/RagInput.vue` — textarea + submit. Tests: emits `submit` on Enter (not Shift+Enter), disabled while streaming.
9. `components/rag/RagChat.vue` — orchestrates composable + children. Tests: wires submit → `useRagChat.ask()`, renders incoming messages, cancel button aborts.

After each unit: run the test, show red, implement, show green. Commit message template: `test(rag-fe): <unit> — TDD green`.

Wire MSAL per Step 1.G choice. If deferred, generate `services/auth.{js|ts}` exporting `getToken()` that throws `new Error('auth not wired')`, plus a test asserting that behavior — so the TODO is discoverable via failing tests, not silent. In JS mode, document the return type via JSDoc (`@returns {Promise<string>}`).

## Step 4 — Backend scaffold (TDD)

Target tree — exactly [INTEGRATION_PLAN.md §4.1](../../INTEGRATION_PLAN.md). Generate `build.gradle.kts` with the exact deps from [§5.1](../../INTEGRATION_PLAN.md), version-bumped per Step 1.F.

TDD loop:

1. DTOs (`AskRequest`, `AskChunk` sealed class, `Citation`). Tests: Jackson round-trip, discriminator `type` present on serialization.
2. `SseEnvelopeMapper` — raw orchestrator text → `AskChunk` events. Tests: plain text → `Chunk`; `[title](url)` inline → `Citation` + `Chunk` with link stripped; end marker → `Done`; upstream error payload → `Error`.
3. `UserContextBuilder` — extracts `oid`, `upn`, `name` from JWT claims + merges `userContext` map. Tests: missing claims → `BadRequest`; extra fields pass through.
4. `OrchestratorProperties` — `@ConfigurationProperties`. Tests: binding from `application.yml`, validation on missing `url` / `apiKey`.
5. `OrchestratorClient` — WebClient reactive SSE. Tests (`WebClient.builder()` + `MockWebServer`): sends `X-API-KEY`, passes through `Authorization`, streams chunks, propagates 502, times out per config.
6. `SecurityConfig` — JWT resource server + CORS. Tests (`@WebFluxTest` + `MockJwt`): unauthenticated → 401; valid JWT → allowed; CORS preflight returns expected headers.
7. `RagController` — `POST /api/rag/ask`. Tests (`WebTestClient`): streams normalized JSON envelope; `error` event on upstream failure; honors `AbortController` (cancellation closes upstream subscription).
8. `ToolController` + `ToolRegistry` + one sample `CreateTicketTool`. Tests: tool discovery endpoint lists schema; invocation validates params; unknown tool → 404.
9. (If Step 1.H opted in) MCP scaffolding — `McpServer`, `McpMessageHandler`, `McpToolAdapter` bridging `ToolRegistry`. Tests: `list_tools` returns registry; `call_tool` dispatches through adapter.

Commit template: `test(rag-be): <unit> — TDD green`.

## Step 5 — Contract tests (cross-cutting)

Generate a `contract-tests/` folder at repo root with:
- A JSON-schema file per event type in `AskChunk` (language-agnostic — this works identically for JS and TS frontends).
- A test (runnable from both frontend via Vitest and backend via JUnit) that asserts a captured sample stream conforms.

This catches drift between `SseEnvelopeMapper` (backend) and `useSseClient` (frontend) early. In JS mode the schemas are the only type contract the frontend has, so they matter more — enforce them in the ragApi test.

## Step 6 — Dev ergonomics

Generate only what the reference project also has (check `REFERENCE_BRIEF.md`). Don't add tooling the team doesn't use.

Candidates:
- `.nvmrc` / `.tool-versions`.
- `.editorconfig` matching reference.
- `pnpm-workspace.yaml` if monorepo-style.
- `docker-compose.yml` with a stub `orchestrator` service (image placeholder) + `backend` service for local dev.
- `Makefile` or `justfile` with `dev`, `test`, `lint`, `check` targets.
- `.github/workflows/ci.yml` mirroring reference CI (lint + test on PR).

## Step 7 — README and handoff

Write/update `README.md` with:
- Prereqs (Node, JDK, package manager versions from Step 2).
- Quickstart: `pnpm install && pnpm -C frontend dev` / `./gradlew -p backend bootRun`.
- Env vars required (copy from `.env.sample` style — list them, don't commit real values).
- Pointer to [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md) phases and where the scaffold leaves off.
- If MSAL deferred: a clear "Auth is stubbed — implement `services/auth.ts:getToken()` before first real request" banner.

Final message to user should include:
- Paths of every file created (grouped by frontend / backend / root).
- Green test count per layer.
- Unresolved TODOs (only the ones the user explicitly deferred).
- Next suggested phase from [INTEGRATION_PLAN.md §8](../../INTEGRATION_PLAN.md) given current state.

---

## Guardrails

- Never generate code that logs tokens, cookies, or full request bodies.
- Never hardcode tenant IDs, client IDs, or API keys.
- Never skip the failing-test step to "save time." If the user asks you to, push back once and note the deviation in `SCAFFOLD_DECISIONS.md`.
- Never invent contract fields not in [INTEGRATION_PLAN.md §3](../../INTEGRATION_PLAN.md). If something's missing, ask.
- If a newer major version of any framework has breaking changes vs. the reference, call it out in Step 1.F and require explicit opt-in.
