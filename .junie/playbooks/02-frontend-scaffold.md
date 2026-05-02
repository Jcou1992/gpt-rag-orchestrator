# Playbook: 02 — Frontend Scaffold (TDD)

**Purpose:** Generate `frontend/` tree with tests first, per TDD discipline. Adopt testing conventions from `REFERENCE_BRIEF.md`. Generate API documentation.

**Input:** `SCAFFOLD_DECISIONS.md`, `REFERENCE_BRIEF.md` (optional), [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md).

**Output:** `frontend/` with 9 TDD units, `docs/frontend-api.md`, test report, updated `SCAFFOLD_PROGRESS.md`.

---

## Step 1 — Setup & test framework selection

Read `SCAFFOLD_DECISIONS.md` to unlock language (JS/TS) and add-ons.

If `REFERENCE_BRIEF.md` exists, scan for:
- **Testing framework:** Vitest / Jest / other. Adopt it.
- **Test file naming:** `.test.js` / `.spec.js` / other. Match it.
- **Component test library:** `@vue/test-utils` + Vitest / Vue Test Utils + Jest / other. Match it.
- **Playwright** presence → if add-on selected, use it.

If no reference, **default to:**
- Testing framework: **Vitest** (fast, modern, Vue-native)
- Test naming: `.spec.{js|ts}` (industry standard)
- Component testing: **@vue/test-utils** + **vitest**
- E2E: Playwright if opted in, else skip.

### Generate `frontend/package.json`

Include:
- `vue@<version>`, `vuetify@<version>`, `vite@<version>`, `pinia@<version>`
- `@microsoft/fetch-event-source`
- Markdown plugins: `marked`, `highlight.js`, `dompurify`
- Test deps: `vitest`, `@vue/test-utils`, `@testing-library/vue` (optional)
- MSAL (if opted in): `@azure/msal-browser`, `@azure/msal-vue` or custom composable
- Add-ons per user selection
- Package manager: from SCAFFOLD_DECISIONS.md

### Generate config files

- `vite.config.{js|ts}` — Vue 3 plugin, test setup, alias `@` → `src/`
- `jsconfig.json` or `tsconfig.json` — per language choice
- `vitest.config.ts` (if not in vite.config)
- `.env.example` — RAG_API_URL, VITE_MSAL_CLIENT_ID (if MSAL opted)

Print to user:

```
Generated frontend/ structure.
- Language: <JS/TS>
- Test framework: <Vitest/Jest/other>
- Config files ready.

Now running TDD loop (9 units, red → green per unit).
Watch for test output.
```

---

## Step 2 — TDD Loop (units 1–9)

**Discipline:** For EACH unit:
1. Write a **failing test** (red).
2. Show the user the red output.
3. Implement the minimum code to pass.
4. Show the user the green output.
5. Refactor if needed (improve, but don't change behavior).
6. Commit or stage with message `test(rag-fe): <unit-name> — TDD green`.

**Testing conventions:** Adopt from REFERENCE_BRIEF if available. If not, use defaults (Vitest + @vue/test-utils + descriptive test names).

**Naming conventions:** Infer from REFERENCE_BRIEF. If missing, ask user per component:
> Before implementing RagChat.vue, confirm naming:
> - File: PascalCase `.vue`?
> - Template tags: kebab-case?
> - Props: camelCase?
> (Offer reference patterns or defaults.)

### Unit 1: Data models

**File:** `src/models/rag.js` (JS) or `src/types/rag.ts` (TS)

**Behavior to test:**
- (JS) Smoke test: module imports, JSDoc `@typedef` is readable.
- (TS) Type definitions compile, `expectTypeOf` assertions pass.

**Test output expectations:**
- All models export: `AskChunk` (sealed), `Chunk`, `Citation`, `Done`, `Error`.
- Discriminator field `type` is present.

**Red test:**
```js
// frontend/src/models/rag.spec.js
import { describe, it, expect } from 'vitest';
import * as RagModels from './rag';

describe('Rag models', () => {
  it('should export AskChunk union type', () => {
    // Smoke test: imports work
    expect(RagModels).toBeDefined();
  });
});
```

**Green implementation:** JSDoc `@typedef` or TS `type` definitions per INTEGRATION_PLAN.md §3.

---

### Units 2–9: Follow the same discipline

**Unit 2:** `plugins/markdown.{js|ts}` — sanitize XSS, highlight code.
**Unit 3:** `composables/useSseClient.{js|ts}` — parse SSE, handle abort, propagate errors.
**Unit 4:** `services/ragApi.{js|ts}` — HTTP wrapper, auth headers, request shape.
**Unit 5:** `composables/useRagChat.{js|ts}` — state mgmt, accumulate messages, handle done/error.
**Unit 6:** `components/rag/RagCitation.vue` — render title + link.
**Unit 7:** `components/rag/RagMessage.vue` — markdown + citations.
**Unit 8:** `components/rag/RagInput.vue` — textarea, submit on Enter, disabled while streaming.
**Unit 9:** `components/rag/RagChat.vue` — orchestrate all above, show messages, cancel button.

After each unit:
- Show test results (✅ pass / ❌ fail).
- Print lines added/modified.
- Commit message: `test(rag-fe): <name> — TDD green`.

---

## Step 3 — MSAL wiring (if opted in)

> **Auth policy is owned by playbook 04 Steps 4 + 6.** Phase 02 does NOT generate a dummy-JWT `auth.js` fallback. The hardened MSAL adapter (`auth.js` delegating to `msalConfig.js`'s `hardenedGetToken`) and the dev-only `auth-stub.js` (resolved by Vite alias only in `mode in ['development', 'test']`) are emitted in playbook 04. Generating a separate dummy-token `auth.js` here would leave a non-hardened module on the production code path that bypasses the R6/R6a/R8/R11 controls, and the leak test (which scans for the dev-stub sentinel only) would NOT catch it.

If user chose **MSAL now** in preflight:

- DO NOT generate `src/services/auth.js|ts` in this phase. The hardened adapter + dev stub are emitted in playbook 04 Step 4.
- Wire MSAL `@azure/msal-browser` in `main.js|ts` (placeholder config; `@azure/msal-vue` is OPTIONAL — playbook 04 uses `@azure/msal-browser` directly).
- Add environment vars: `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_API_SCOPE` (note: same names playbook 04 Step 6 validates at startup; do NOT use `VITE_MSAL_TENANT_ID` / `VITE_MSAL_API_SCOPE` — those names diverge from the Step 6 validator and would be flagged as placeholders).
- Tests: covered by playbook 04 Step 6 (msalConfig validator) and the build-time / runtime / regression layers from playbook 04 Step 5b. Phase 02 does not need its own auth test.

If user chose **TODO:**

- Generate `src/services/auth.js|ts` with `getToken()` throwing `new Error('auth not wired')`. **No dummy/stub return value** — a thrown error is the only acceptable placeholder, since it surfaces the gap loudly via failing tests AND blocks any code path that tries to call MSAL before playbook 04 lands.
- Test asserts the error is thrown.
- This makes the gap discoverable via failing tests in CI.

**Single-auth-policy invariant.** Across the entire scaffolded frontend, exactly two `auth*.js` files exist: `src/services/auth.js` (hardened delegator) and `src/services/auth-stub.js` (dev-only sentinel-bearing stub). No third file, no inline `getToken` mock, no catch-and-substitute fallback in `ragApi.js`. The scaffolder rejects any unit instructions that contradict this invariant — see playbook 04 Step 4 and Step 6 for the canonical templates.

---

## Step 4 — Frontend API documentation

Generate `docs/frontend-api.md`:

```markdown
# Frontend API Reference

Auto-generated from `frontend/src/`.

## Models

### AskChunk
Union type for SSE events.
- **Chunk**: `{ type: "chunk", text: string }`
- **Citation**: `{ type: "citation", title: string, url: string }`
- **Done**: `{ type: "done" }`
- **Error**: `{ type: "error", code: string, message: string }`

(Copy from code)

## Services

### ragApi.{js|ts}
HTTP client wrapper.

**Methods:**
- `askOrchestrator(ask: string, conversationId?: string): Readable<AskChunk>`
  - Sends SSE request to backend `POST /api/rag/ask`.
  - Returns async iterable of events.
  - Propagates `Authorization: Bearer <token>`.

(Copy from code + JSDoc)

## Composables

### useRagChat()
Reactive chat state.

**Returns:**
```
{
  messages: Ref<Array<{ role, content, citations }>>,
  isStreaming: Ref<boolean>,
  currentConversationId: Ref<string>,
  ask(prompt: string): Promise<void>,
  cancel(): void,
}
```

(Copy from code + JSDoc)

### useSseClient()
Low-level SSE parser.

(Copy from code + JSDoc)

## Components

- **RagChat** — main chat interface
- **RagMessage** — message bubble with markdown
- **RagCitation** — citation chip
- **RagInput** — input textarea + submit

(Auto-extract from `<script>` blocks via regex or JSDoc)

---

## Environment variables

- `VITE_RAG_API_URL` (default: `http://localhost:8080`) — backend URL
- `VITE_MSAL_CLIENT_ID` (if MSAL wired) — Azure SPA ID
- `VITE_MSAL_TENANT_ID` (if MSAL wired) — Azure tenant
- `VITE_MSAL_API_SCOPE` (if MSAL wired) — backend scope
```

---

## Step 5 — Test report & commit summary

After all 9 units, print:

```
✅ FRONTEND SCAFFOLD COMPLETE

Tests: 27/27 passed (9 units × 3 assertions)
Coverage: (if available) 92% statements
Lint: 0 errors

Files created:
- frontend/package.json
- frontend/vite.config.{js|ts}
- frontend/src/models/rag.{js|ts}
- frontend/src/plugins/markdown.{js|ts}
- frontend/src/composables/useRagChat.{js|ts}
- frontend/src/composables/useSseClient.{js|ts}
- frontend/src/services/ragApi.{js|ts}
- frontend/src/services/auth.{js|ts} [MSAL status: <now/TODO>]
- frontend/src/components/rag/*.vue (4 components)
- docs/frontend-api.md

Commits:
- test(rag-fe): models — TDD green
- test(rag-fe): markdown — TDD green
- ... (8 more)

Next: Run 03-Backend-Scaffold to generate Kotlin + Spring Boot.
```

---

## Step 6 — Update SCAFFOLD_PROGRESS.md

Append a memory checkpoint (do not delete prior phases):

```markdown
## Phase 02 — Frontend-Scaffold ✅ DONE

**Completed:** <timestamp>

| Unit | Tests | Status |
|---|---|---|
| 1. Models | 1/1 | ✅ |
| 2. Markdown | 2/2 | ✅ |
| 3. useSseClient | 4/4 | ✅ |
| 4. ragApi | 3/3 | ✅ |
| 5. useRagChat | 5/5 | ✅ |
| 6. RagCitation | 1/1 | ✅ |
| 7. RagMessage | 2/2 | ✅ |
| 8. RagInput | 2/2 | ✅ |
| 9. RagChat | 2/2 | ✅ |

**Total:** 27/27 tests passed

**MSAL Status:** <now/TODO>

**Docs:** `docs/frontend-api.md` generated

**Next phase:** 03-Backend-Scaffold
```

---

## Guardrails

- **TDD non-negotiable:** Show red, show green. No skipping to "speed up."
- **Test names matter:** Use descriptive names (not `test1`, `test2`). Example: `should emit submit event on Enter key when not streaming`.
- **No hardcoded URLs:** Use `VITE_RAG_API_URL` env var.
- **MSAL local fallback:** Owned by playbook 04 Step 4 — Vite resolves `@/services/auth` to `auth-stub.js` only when `mode in ['development', 'test']`. The dev stub token is held module-scoped and bears the pre-committed leak-test sentinel; it is NEVER a generic catch-and-substitute fallback in `auth.js` or `ragApi.js`. R8 invariant: `getToken()` failures throw and surface via the sanitized error rendering in `msalConfig.js`.
- **XSS prevention:** Markdown renderer must sanitize with `dompurify`. Test it with `<script>alert('xss')</script>`.
