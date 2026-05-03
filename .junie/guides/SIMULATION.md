# Junie Skill v4 — Simulated Full Run-Through

> **Purpose:** End-to-end visualization of what running the Junie scaffolding skill actually looks like. From empty repo → fully functional Vue 3 + Spring Boot RAG client wired to this `gpt-rag-orchestrator`.
>
> **This is a simulation.** Outputs shown are representative — exact wording, file counts, and timing match playbook contracts but real runs may vary slightly. Use this to set expectations and dry-run mentally before committing real time.

---

## Table of contents

1. [What you start with](#0-what-you-start-with)
2. [Step 0 — Bootstrap target repo](#step-0--bootstrap-target-repo-2-min)
3. [Step 1 — (Optional) Extract reference brief](#step-1--optional-extract-reference-brief-5-min)
4. [Step 2 — Kick off scaffolder](#step-2--kick-off-scaffolder)
5. [Step 3 — Answer the preflight question (A–I)](#step-3--answer-the-preflight-question-ai-1-min)
6. [Phase 01 — Preflight (2 min)](#phase-01--preflight-2-min)
7. [Phase 02 — Frontend scaffold (10 min)](#phase-02--frontend-scaffold-10-min)
8. [Phase 03 — Backend scaffold (12 min)](#phase-03--backend-scaffold-12-min)
9. [Phase 04 — Contract tests + auth hardening (4 min)](#phase-04--contract-tests--auth-hardening-4-min)
10. [Phase 05 — Documentation (8 min)](#phase-05--documentation-8-min)
11. [Final state](#final-state)
12. [Verify it works (mocked, no orchestrator)](#verify-it-works-mocked-no-orchestrator)
13. [Wire to the real orchestrator](#wire-to-the-real-orchestrator)
14. [Configure MSAL (Entra ID auth)](#configure-msal-entra-id-auth)
15. [Send a real query end-to-end](#send-a-real-query-end-to-end)
16. [CI invariants you must keep green](#ci-invariants-you-must-keep-green)
17. [Recovery scenarios](#recovery-scenarios)

---

## 0. What you start with

```
~/Dev/my-rag-client/         ← empty target repo
└── .git/
```

That's it. A blank git repo. The skill brings everything else.

You will copy two artifacts from `gpt-rag-orchestrator` into the target repo:

```
gpt-rag-orchestrator/
├── .junie/                   ← skill (playbooks + guides + contracts)
│   ├── guidelines.md
│   ├── playbooks/
│   │   ├── 01-preflight.md
│   │   ├── 02-frontend-scaffold.md
│   │   ├── 03-backend-scaffold.md
│   │   ├── 04-contract-tests.md
│   │   ├── 05-docs-generation.md
│   │   ├── create-rag-app.md           ← orchestrator playbook
│   │   └── extract-reference-brief.md
│   ├── guides/
│   └── contracts/
│       ├── sse-events.schema.json      ← canonical SSE contract
│       └── sse-events.examples.json
└── INTEGRATION_PLAN.md       ← spec the playbooks read
```

---

## Step 0 — Bootstrap target repo (2 min)

```bash
mkdir -p ~/Dev/my-rag-client && cd ~/Dev/my-rag-client
git init -b main

# Copy skill artifacts from this repo
cp -r ~/Dev/gpt-rag-orchestrator/.junie .
cp ~/Dev/gpt-rag-orchestrator/INTEGRATION_PLAN.md .

git add .junie INTEGRATION_PLAN.md
git commit -m "bootstrap: junie skill v4 + integration plan"
```

Open `~/Dev/my-rag-client` in JetBrains IDE (IntelliJ IDEA / WebStorm / PyCharm). Verify Junie plugin is installed and signed in (Settings → Plugins → search "Junie").

---

## Step 1 — (Optional) Extract reference brief (5 min)

Skip if you have no reference Vue/Spring repo. With reference, output is much closer to team conventions.

In a **second IDE window** opened on your reference project, send this to Junie:

> ```
> Follow ../playbooks/extract-reference-brief.md and write REFERENCE_BRIEF.md to the repo root.
> Treat this as the reference project for conventions.
> ```

Junie responds:

```
Ready to extract. Please confirm:

A. Reference brief detected: frontend/, backend/, docs/
   Use as reference? [Y/n]

B. Layers to extract? (frontend / backend / tooling / all) [default: all]

C. Capture naming patterns, test frameworks, deps? [Y/n]
```

Answer:

```
A: Y
B: all
C: Y
```

After ~45 seconds:

```
✅ REFERENCE_BRIEF.md written to repo root.

Captured:
- Frontend: Vue 3.4, Vitest + @vue/test-utils, PascalCase components, JS not TS
- Backend: Spring Boot 3.2, Kotlin 1.9, JUnit 5 + MockK, WebFlux
- Conventions: Request/Response DTO suffixes, com.example.* package root
- Test naming: .spec.js (frontend), Test.kt suffix (backend)
- CI: GitHub Actions, ./gradlew test, pnpm test
```

Copy into target:

```bash
cp REFERENCE_BRIEF.md ~/Dev/my-rag-client/REFERENCE_BRIEF.md
```

Switch back to the target IDE window.

---

## Step 2 — Kick off scaffolder

In the target repo's Junie chat, send exactly:

> ```
> Follow ../playbooks/create-rag-app.md
> ```

Junie responds (10–30 seconds):

```
Scaffolding RAG app...

Reading: INTEGRATION_PLAN.md, REFERENCE_BRIEF.md (detected), git status (clean)...
Detected canonical SSE schema at .junie/contracts/sse-events.schema.json ✓

Ready to proceed. One question:
```

---

## Step 3 — Answer the preflight question (A–I, 1 min)

Junie prints **one** grouped question:

```
Ready to scaffold the RAG app. Answer all of the following:

A. REFERENCE_BRIEF
   Detected: /Users/JC/Dev/my-rag-client/REFERENCE_BRIEF.md
   Use as source of truth for conventions? [Y/n]  (default: Y)

B. CONFLICT POLICY
   frontend/ exists: no
   backend/ exists: no
   If conflicts: [abort / sibling-dir / merge-configs-only]? (default: abort)

C. PACKAGE MANAGER (frontend)
   Reference suggests: pnpm@9
   Use same? [Y/n]  If n, choose: [pnpm / npm / yarn] (default: pnpm)

D. NODE VERSION
   Reference suggests: 20.x
   Use same? [Y/n]  If n, specify: [18 / 20 / 22] (default: 20)

E. JDK + KOTLIN (backend)
   Reference suggests: JDK 21, Kotlin 1.9
   Use same? [Y/n]  If n, specify JDK: [17 / 21 / 23], Kotlin: [1.9 / 2.0]

F. VERSION BUMPS
   Newer stable versions found:
   - vue:          3.4 → 3.5    [keep / bump]
   - vuetify:      3.6 → 3.7    [keep / bump]
   - vite:         5.2 → 5.4    [keep / bump]
   - pinia:        2.1 → 2.3    [keep / bump]
   - spring-boot:  3.2 → 3.3    [keep / bump]
   - kotlin:       1.9 → 2.0    [keep / bump]
   (default: keep all. reply only with overrides.)

G. MSAL / ENTRA ID AUTH (frontend)
   (1) Scaffold MSAL now — requires SPA client ID, tenant ID, API scope
   (2) Leave as TODO — generates failing test + stub. You wire it later.
   (default: 2)

H. FRONTEND LANGUAGE
   (1) JavaScript — .js files, <script setup>, JSDoc
   (2) TypeScript — .ts files, <script setup lang="ts">
   (default: 1)

I. OPTIONAL ADD-ONS (pick any)
   [ ] vue-router  [ ] vue-i18n  [ ] playwright-e2e  [ ] storybook
   [ ] testcontainers  [ ] mcp-server
   (default: none)
```

Sample safe answer (paste back as a single message):

```
A: Y
B: abort
C: Y
D: Y
E: Y
F: (keep all)
G: 2
H: 1
I: (none)
```

---

## Phase 01 — Preflight (2 min)

```
Running: 01-preflight.md
─────────────────────────

✓ Read REFERENCE_BRIEF.md
✓ Read INTEGRATION_PLAN.md
✓ Git status clean
✓ No prior SCAFFOLD_DECISIONS.md (fresh start)
✓ Validating answers...
✓ Locking decisions

Writing SCAFFOLD_DECISIONS.md ...
Writing SCAFFOLD_PROGRESS.md ...

✅ Phase 01 complete (1m 47s).

Next: Phase 02 (Frontend scaffold)
```

Created files:

```
my-rag-client/
├── .junie/
├── INTEGRATION_PLAN.md
├── REFERENCE_BRIEF.md
├── SCAFFOLD_DECISIONS.md      ← NEW (audit log, read-only thereafter)
└── SCAFFOLD_PROGRESS.md       ← NEW (live checkpoint)
```

Sample `SCAFFOLD_DECISIONS.md`:

```markdown
# Scaffold Decisions

**Locked:** 2026-05-02T18:14:32Z
**Source of truth:** REFERENCE_BRIEF.md

## Answers
| Key | Value |
|---|---|
| reference_brief | use |
| conflict_policy | abort |
| package_manager | pnpm@9 |
| node_version | 20.11 |
| jdk_version | 21 |
| kotlin_version | 1.9.25 |
| frontend_language | javascript |
| msal_mode | TODO |
| addons | none |
| versions | vue@3.4, vuetify@3.6, vite@5.2, pinia@2.1, spring-boot@3.2, kotlin@1.9 |

## Environment
- OS: darwin 25.2.0
- Node: 20.11.0
- pnpm: 9.7.0
- JDK: 21.0.4
- Git: clean

## Next steps
Phase 02 reads this file. Do not edit manually.
```

---

## Phase 02 — Frontend scaffold (10 min)

```
Running: 02-frontend-scaffold.md
────────────────────────────────

✓ Generated frontend/package.json (vue 3.4, vuetify 3.6, vite 5.2, pinia 2.1)
✓ Generated frontend/vite.config.js (alias @ → src/, vitest setup)
✓ Generated frontend/jsconfig.json
✓ Generated frontend/.env.example (5 VITE_* vars)

TDD Loop (9 units):

─── Unit 1: models/rag.js ───────────────────────────────
  Write failing test: frontend/src/models/rag.spec.js
  ❌ FAIL · should export AskChunk discriminated union
        Cannot find module '@/models/rag'
  Implement: frontend/src/models/rag.js
  ✅ PASS · 3/3 assertions
  Stage: test(rag-fe): models — TDD green

─── Unit 2: plugins/markdown.js ──────────────────────────
  ❌ FAIL · should sanitize <script> XSS
  Implement: marked + dompurify + highlight.js
  ✅ PASS · 3/3 assertions
  Stage: test(rag-fe): markdown — TDD green

─── Unit 3: composables/useSseClient.js ─────────────────
  ❌ FAIL · should parse SSE event chunks
  ❌ FAIL · should propagate AbortController.abort()
  ❌ FAIL · should surface stream errors
  Implement: @microsoft/fetch-event-source wrapper
  ✅ PASS · 3/3 assertions
  Stage: test(rag-fe): useSseClient — TDD green

─── Unit 4: services/ragApi.js ──────────────────────────
  ❌ FAIL · should attach Bearer token from getToken()
  ❌ FAIL · should send POST /api/rag/ask with body
  ❌ FAIL · should NOT catch-and-substitute on auth failure
  Implement: fetch wrapper, auth delegator (placeholder throws)
  ✅ PASS · 3/3 assertions
  Stage: test(rag-fe): ragApi — TDD green

─── Unit 5: composables/useRagChat.js ───────────────────
  ❌ FAIL · should accumulate text deltas into message
  ❌ FAIL · should append citations on done
  ❌ FAIL · should expose cancel()
  Implement: ref state, useSseClient + ragApi
  ✅ PASS · 3/3 assertions
  Stage: test(rag-fe): useRagChat — TDD green

─── Unit 6: components/rag/RagCitation.vue ──────────────
  ❌ FAIL · should render title + link
  Implement
  ✅ PASS · 3/3 assertions

─── Unit 7: components/rag/RagMessage.vue ───────────────
  ❌ FAIL · should render markdown + citations
  ✅ PASS · 3/3 assertions

─── Unit 8: components/rag/RagInput.vue ─────────────────
  ❌ FAIL · should submit on Enter, disabled while streaming
  ✅ PASS · 3/3 assertions

─── Unit 9: components/rag/RagChat.vue ──────────────────
  ❌ FAIL · should orchestrate input → useRagChat → messages
  ❌ FAIL · should show cancel button while streaming
  ✅ PASS · 3/3 assertions
  Stage: test(rag-fe): RagChat — TDD green

✅ Phase 02 complete (9m 42s). 27/27 tests passed.
✓ Generated docs/frontend-api.md
✓ Updated SCAFFOLD_PROGRESS.md
```

Files created:

```
my-rag-client/frontend/
├── package.json
├── pnpm-lock.yaml
├── vite.config.js
├── jsconfig.json
├── .env.example
├── index.html
└── src/
    ├── main.js
    ├── App.vue
    ├── models/rag.js
    ├── plugins/markdown.js
    ├── composables/
    │   ├── useRagChat.js
    │   └── useSseClient.js
    ├── services/
    │   ├── ragApi.js
    │   └── auth.js              ← throws "auth not wired" (TODO mode)
    └── components/rag/
        ├── RagChat.vue
        ├── RagMessage.vue
        ├── RagCitation.vue
        └── RagInput.vue
```

`docs/frontend-api.md` (auto-generated):

```markdown
# Frontend API

Auto-generated from frontend/src/.

## Models
### AskChunk
Discriminated union: `text` | `citation` | `done` | `error`

## Services
### ragApi.askStream(question, signal)
POST /api/rag/ask, returns ReadableStream of AskChunk

## Composables
### useRagChat()
{ messages, ask(q), cancel(), isStreaming }

### useSseClient(url, opts)
Low-level SSE; parses events, propagates abort/error

## Environment variables
| Var | Required | Purpose |
|---|---|---|
| VITE_RAG_API_URL | yes | Spring backend base URL |
| VITE_MSAL_CLIENT_ID | yes (auth on) | Entra SPA client id |
| VITE_MSAL_AUTHORITY | yes (auth on) | https://login.microsoftonline.com/<tenant> |
| VITE_MSAL_REDIRECT_URI | yes (auth on) | http://localhost:5173 |
| VITE_API_SCOPE | yes (auth on) | api://<api-client-id>/.default |
```

---

## Phase 03 — Backend scaffold (12 min)

```
Running: 03-backend-scaffold.md
────────────────────────────────

✓ Stack lock check: Kotlin + Spring WebFlux (servlet imports forbidden)
✓ Package-root invariant: com.example.rag.* enforced
✓ Generated backend/build.gradle.kts (spring-boot 3.2, kotlin 1.9, webflux)
✓ Generated backend/settings.gradle.kts
✓ Generated src/main/kotlin/com/example/rag/RagApplication.kt
✓ Generated src/main/resources/application.yml
✓ Generated src/main/resources/application-dev.yml

TDD Loop (9 units + 9b):

─── Unit 1: web/dto/* (AskRequest, AskChunk, Citation) ──
  ❌ FAIL · sealed class AskChunk should serialize all variants
  Implement
  ✅ PASS · 4/4 assertions
  Stage: test(rag-be): dto — TDD green

─── Unit 2: SseEnvelopeMapper ───────────────────────────
  ❌ FAIL · should map raw "data: ..." → AskChunk
  ❌ FAIL · should extract citations from message
  Implement: regex extractor + delta accumulator
  ✅ PASS · 4/4 assertions

─── Unit 3: UserContextBuilder ──────────────────────────
  ❌ FAIL · should map JWT claims → UserContext (oid, name, groups)
  Implement
  ✅ PASS · 3/3 assertions

─── Unit 4: OrchestratorProperties ──────────────────────
  ❌ FAIL · should bind app.orchestrator.url
  ❌ FAIL · should reject blank url at startup
  Implement: @ConfigurationProperties + @Validated
  ✅ PASS · 3/3 assertions

─── Unit 5: OrchestratorClient ──────────────────────────
  ❌ FAIL · should stream SSE chunks via WebClient
  ❌ FAIL · should propagate token in Authorization header (OBO)
  ❌ FAIL · should retry on 5xx with backoff
  Implement: WebClient + Reactor retry
  ✅ PASS · 4/4 assertions

─── Unit 6: SecurityConfig ──────────────────────────────
  ❌ FAIL · /api/rag/** requires JWT
  ❌ FAIL · /actuator/health is permitAll
  ❌ FAIL · CORS allows VITE origin from app.cors.allowed-origins
  Implement: SecurityWebFilterChain + ReactiveJwtDecoder
  ✅ PASS · 4/4 assertions

─── Unit 7: RagController ───────────────────────────────
  ❌ FAIL · POST /api/rag/ask streams Flux<AskChunk>
  ❌ FAIL · should reject missing JWT (401)
  ❌ FAIL · should normalize SSE → JSON envelope
  Implement: @RestController + Flux<ServerSentEvent<AskChunk>>
  ✅ PASS · 4/4 assertions

─── Unit 8: ToolController + CreateTicketTool ───────────
  ❌ FAIL · POST /api/tools/create-ticket returns ticket id
  Implement: ToolRegistry + sample tool
  ✅ PASS · 3/3 assertions

─── Unit 9: (skipped — MCP not opted in) ────────────────

─── Unit 9b: Profile-gated dev-double + OBO ─────────────
  ✓ @DevOnlyBean annotation generated
  ✓ DevDoubleClasspathScanTest (load-bearing layer)
  ✓ DevDoubleGateTest (gating-misfire layer)
  ✓ MockOrchestratorClient.kt (single dev double, gated)
  ✓ JwtTestKit.kt + OboValidationTest.kt
  ✓ SecurityBeansPresentTest.kt (boots real app)
  ❌ FAIL · MockOrchestratorClient must not load when prod profile active
  ✅ PASS · all 5 gate tests green

✅ Phase 03 complete (11m 18s). 32/32 tests passed.
✓ Generated docs/backend-openapi.json
✓ Updated SCAFFOLD_PROGRESS.md
```

Files created (abridged):

```
my-rag-client/backend/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/wrapper/
└── src/
    ├── main/
    │   ├── kotlin/com/example/rag/
    │   │   ├── RagApplication.kt
    │   │   ├── config/
    │   │   │   ├── SecurityConfig.kt
    │   │   │   ├── OrchestratorProperties.kt
    │   │   │   └── annotations/DevOnlyBean.kt
    │   │   ├── dev/MockOrchestratorClient.kt
    │   │   ├── security/UserContextBuilder.kt
    │   │   ├── web/
    │   │   │   ├── RagController.kt
    │   │   │   ├── ToolController.kt
    │   │   │   └── dto/{AskRequest,AskChunk,Citation,UserContext}.kt
    │   │   └── client/
    │   │       ├── OrchestratorClient.kt    (interface)
    │   │       └── SseEnvelopeMapper.kt
    │   └── resources/
    │       ├── application.yml
    │       └── application-dev.yml
    └── test/kotlin/com/example/rag/
        ├── config/{DevDoubleGateTest,DevDoubleClasspathScanTest}.kt
        ├── security/{JwtTestKit,OboValidationTest,SecurityBeansPresentTest}.kt
        ├── client/SseEnvelopeMapperTest.kt
        ├── web/RagControllerTest.kt
        └── ...
```

`backend/src/main/resources/application.yml`:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://login.microsoftonline.com/${app.entra.tenant-id}/v2.0
app:
  orchestrator:
    url: ${ORCHESTRATOR_URL:http://localhost:8000/orchestrator}
    timeout-ms: 60000
  cors:
    allowed-origins: http://localhost:5173
  entra:
    tenant-id: ${ENTRA_TENANT_ID:}
    client-id: ${ENTRA_CLIENT_ID:}
  dev-doubles:
    enabled: false   # production default
```

`backend/src/main/resources/application-dev.yml`:

```yaml
app:
  dev-doubles:
    enabled: true     # MockOrchestratorClient active in dev profile
  orchestrator:
    url: http://localhost:8000/orchestrator   # ignored when mock on
```

---

## Phase 04 — Contract tests + auth hardening (4 min)

```
Running: 04-contract-tests.md
─────────────────────────────

Step 1 — Schema emission
✓ node -e copyFileSync .junie/contracts/sse-events.schema.json → contract-tests/schemas/
✓ node -e copyFileSync .junie/contracts/sse-events.examples.json → contract-tests/fixtures/
✓ R5 invariant check: no inline schema restated ✓

Step 2 — Contract test pack (16 tests)
  ❌ FAIL · backend SSE matches canonical schema
  ❌ FAIL · frontend AskChunk parser accepts schema fixture
  ✓ Implement contract tests against shared schema
  ✅ PASS · 16/16 assertions

Step 3 — Communication fallbacks doc
✓ Generated docs/communication-fallbacks.md (network drop, 401, 503, abort)

Step 4 — Hardened auth delegator (replaces TODO stub)
✓ Generated frontend/src/services/auth.js (delegator, no fallback)
✓ Generated frontend/src/services/auth-stub.js (dev-only, sentinel-bearing)
✓ Single-auth-policy invariant: exactly 2 auth*.js files ✓

Step 5 — Frontend leak test
✓ Generated frontend/contract-tests/leak.spec.js
  - asserts dist bundle contains no STUB tokens / placeholders
  - asserts no localStorage.setItem('*token*') in built JS

Step 6 — MSAL config validator (msalConfig.js)
✓ Generated frontend/src/auth/msalConfig.js
  - validates 4 VITE_MSAL_* vars at startup
  - URL-parses authority + redirect-uri
  - halts at config-error screen if placeholders present

Step 7 — CI invariant scripts copied
✓ scripts/check-auth-policy.mjs    (no localStorage tokens, no STUB fallbacks)
✓ scripts/check-r5-invariant.mjs   (JSON schema rules)
✓ scripts/check-stack-invariant.mjs (WebFlux only, no servlet imports)
✓ tests/invariants/run-harness.mjs (golden bad-fixture suite)

✅ Phase 04 complete (3m 51s). 16/16 contract tests passed.
✓ Updated SCAFFOLD_PROGRESS.md
```

Files added:

```
my-rag-client/
├── contract-tests/
│   ├── schemas/ask-chunk-event.schema.json
│   ├── fixtures/sse-events.examples.json
│   ├── package.json
│   ├── frontend-contract.spec.js
│   ├── backend-contract.spec.js
│   └── leak.spec.js
├── scripts/
│   ├── check-auth-policy.mjs
│   ├── check-r5-invariant.mjs
│   └── check-stack-invariant.mjs
├── tests/invariants/
│   ├── run-harness.mjs
│   └── fixtures/{bad-auth,bad-r5,bad-stack}/
├── frontend/src/services/{auth.js,auth-stub.js}
├── frontend/src/auth/msalConfig.js
└── docs/communication-fallbacks.md
```

---

## Phase 05 — Documentation (8 min)

```
Running: 05-docs-generation.md
──────────────────────────────

Generating 10 guides from completed code + INTEGRATION_PLAN.md ...

✓ docs/README.md          (entry point, cross-links all)
✓ docs/ARCHITECTURE.md    (system design, SSE rationale, proxy pattern)
✓ docs/SETUP.md           (install, env vars, run locally)
✓ docs/DEVELOPMENT.md     (add a feature, TDD examples)
✓ docs/TESTING.md         (Vitest + JUnit patterns, philosophy)
✓ docs/NAMING.md          (conventions from REFERENCE_BRIEF)
✓ docs/TROUBLESHOOTING.md (30+ common issues + fixes)
✓ docs/INTEGRATION-WITH-ORCHESTRATOR.md  (wiring real backend)
✓ docs/SECURITY.md        (auth, OBO flow, leak gates)
✓ docs/DEPLOYMENT.md      (Docker, Container Apps, env)

Total: 1247 lines across 10 guides.

✅ Phase 05 complete (7m 33s).
✓ Updated SCAFFOLD_PROGRESS.md (all 5 phases ✅ DONE)

══════════════════════════════════════════════════════
🎉 Scaffold complete (37m 11s total).

Summary:
  Phase 01 (Preflight)        ✅ DONE  (1m 47s)
  Phase 02 (Frontend)         ✅ DONE  (9m 42s) · 27/27 tests
  Phase 03 (Backend)          ✅ DONE  (11m 18s) · 32/32 tests
  Phase 04 (Contract tests)   ✅ DONE  (3m 51s) · 16/16 tests
  Phase 05 (Documentation)    ✅ DONE  (7m 33s) · 10 guides

  Total tests: 75 green
  Total files: 87 created

Next: cd frontend && pnpm install && pnpm dev
      cd ../backend && ./gradlew bootRun --args='--spring.profiles.active=dev'
══════════════════════════════════════════════════════
```

---

## Final state

```
my-rag-client/
├── .junie/                              ← skill (untouched)
├── INTEGRATION_PLAN.md                  ← spec (untouched)
├── REFERENCE_BRIEF.md                   ← convention source
├── SCAFFOLD_DECISIONS.md                ← audit log (read-only)
├── SCAFFOLD_PROGRESS.md                 ← all 5 ✅
├── frontend/                            ← Vue 3 + Vuetify + Vite
│   ├── package.json · vite.config.js · .env.example
│   └── src/{models,plugins,composables,services,auth,components/rag}
├── backend/                             ← Kotlin + Spring WebFlux
│   ├── build.gradle.kts
│   └── src/{main,test}/kotlin/com/example/rag/
├── contract-tests/                      ← shared schema validation
├── scripts/                             ← 3 invariant scanners
├── tests/invariants/                    ← golden bad-fixture harness
└── docs/                                ← 10 guides + frontend-api + backend-openapi
```

Git log (representative):

```
$ git log --oneline
a3f1c0b docs(rag): generate 10 guides — phase 05
9b4e2d8 test(rag-ct): leak spec + msal config validator — phase 04
7e8a1f3 test(rag-ct): contract pack 16/16 green — phase 04
2c9d6b5 test(rag-be): unit 9b OBO + dev-double gate — TDD green
8f1a4e0 test(rag-be): unit 8 ToolController — TDD green
... (one commit per TDD unit)
3a2c1e9 chore(scaffold): phase 01 — lock decisions
e4f9c8b bootstrap: junie skill v4 + integration plan
```

---

## Verify it works (mocked, no orchestrator)

Two terminals.

**Terminal 1 — backend (dev profile, mock orchestrator on):**

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev'
```

Expected:

```
... INFO  o.s.boot.web.embedded.netty.NettyWebServer  : Netty started on port 8080
... INFO  c.example.rag.RagApplicationKt              : Started RagApplication in 3.241 seconds
... INFO  c.example.rag.dev.MockOrchestratorClient    : [DEV] mock orchestrator active (app.dev-doubles.enabled=true)
```

**Terminal 2 — frontend:**

```bash
cd frontend
cp .env.example .env.local
# edit .env.local: VITE_RAG_API_URL=http://localhost:8080
pnpm install
pnpm dev
```

Expected:

```
  VITE v5.2.0  ready in 412 ms
  ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173`. Type a question → submit. Mock backend streams a fake answer with citations. End-to-end UI works without real orchestrator or auth.

**Run all tests:**

```bash
cd frontend && pnpm test           # 27 green
cd ../backend && ./gradlew test    # 32 green
cd ../contract-tests && pnpm test  # 16 green
```

Total: **75 / 75 green**.

---

## Wire to the real orchestrator

Two terminals (orchestrator + scaffolded app).

**Terminal A — start the GPT-RAG Orchestrator** (this repo):

```bash
cd ~/Dev/gpt-rag-orchestrator
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Minimum .env for local run
cat > .env <<'EOF'
AZURE_APP_CONFIG_ENDPOINT=https://<your-appcfg>.azconfig.io
AGENT_STRATEGY=maf_lite
ALLOW_ANONYMOUS=true     # for first smoke test
APPLICATION_INSIGHTS_CONNECTION_STRING=<from-portal>
EOF

python src/main.py
```

Expected:

```
[Orchestrator] FastAPI Orchestrator API starting on 0.0.0.0:8000
[Orchestrator] AGENT_STRATEGY=maf_lite
[Orchestrator] ALLOW_ANONYMOUS=true (Entra optional)
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

Smoke test directly:

```bash
curl -N -X POST http://localhost:8000/orchestrator \
  -H 'Content-Type: application/json' \
  -d '{"ask":"hello","conversation_id":null}'
```

You should see SSE events stream back.

**Terminal B — flip backend to real mode:**

```bash
cd ~/Dev/my-rag-client/backend

# Edit src/main/resources/application.yml
#   app.orchestrator.url: http://localhost:8000/orchestrator
#   app.dev-doubles.enabled: false

# Run with prod profile (no dev doubles)
./gradlew bootRun
```

Expected:

```
... Started RagApplication in 3.4 seconds
... [INFO] OrchestratorClient bound to http://localhost:8000/orchestrator
# (no MockOrchestratorClient line — gate held)
```

Reload `http://localhost:5173`. Submit a question. Real RAG response streams back from Azure AI Search → Foundry → Spring proxy → Vue.

---

## Configure MSAL (Entra ID auth)

Required only when going from `ALLOW_ANONYMOUS=true` smoke test → real auth.

### Azure side (one-time)

1. Azure Portal → Entra ID → **App registrations** → New registration
   - Name: `my-rag-client-spa`
   - Type: SPA
   - Redirect URI: `http://localhost:5173`
   - Note **Application (client) ID** and **Directory (tenant) ID**
2. Second registration: `my-rag-client-api`
   - Type: Web
   - Expose an API → Add scope `access_as_user`
   - Note **API client ID** → API URI: `api://<api-client-id>/.default`
3. SPA registration → API permissions → add `access_as_user` from the API app → grant admin consent

### Frontend wiring

```bash
cd frontend
# edit .env.local
cat > .env.local <<EOF
VITE_RAG_API_URL=http://localhost:8080
VITE_MSAL_CLIENT_ID=<spa-client-id>
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_API_SCOPE=api://<api-client-id>/.default
EOF
```

`src/auth/msalConfig.js` validates these at startup. Placeholders (`YOUR_CLIENT_ID`, `<tenant-id>`) are rejected — you get a config-error screen, not a half-broken auth flow.

### Backend wiring

```bash
cd ../backend
export ENTRA_TENANT_ID=<tenant-id>
export ENTRA_CLIENT_ID=<api-client-id>
./gradlew bootRun
```

### Orchestrator wiring

In `gpt-rag-orchestrator/.env`:

```
ALLOW_ANONYMOUS=false
OAUTH_AZURE_AD_TENANT_ID=<tenant-id>
OAUTH_AZURE_AD_CLIENT_ID=<api-client-id>
```

Restart orchestrator. OBO flow now active: Vue → Spring (validate JWT) → Orchestrator (re-validate JWT, exchange for downstream token via OBO) → Azure AI Search (permission-trimmed by user identity).

---

## Send a real query end-to-end

1. Open `http://localhost:5173`
2. MSAL redirects to Microsoft login → sign in
3. Type: `What is the company expense policy for Q4?`
4. Submit

Browser DevTools → Network tab → `/api/rag/ask`:

```
< HTTP/1.1 200 OK
< Content-Type: text/event-stream
< 
event: chunk
data: {"type":"text","delta":"Per the FY26 Q4 "}

event: chunk
data: {"type":"text","delta":"expense policy, "}

event: chunk
data: {"type":"text","delta":"per-diem caps are $75/day domestic..."}

event: chunk
data: {"type":"citation","title":"FY26 Expense Policy","url":"https://sharepoint..."}

event: chunk
data: {"type":"done"}
```

UI renders the streaming markdown answer + cited source links.

---

## CI invariants you must keep green

These were copied into the scaffolded repo by Phase 04. Run from repo root:

```bash
node scripts/check-auth-policy.mjs       # no localStorage tokens, no STUB fallbacks
node scripts/check-r5-invariant.mjs      # JSON schema (no oneOf+additionalProperties)
node scripts/check-stack-invariant.mjs   # WebFlux only — no servlet imports
node tests/invariants/run-harness.mjs    # golden bad-fixture regression
```

Add to your CI pipeline (e.g. `.github/workflows/ci.yml`):

```yaml
- run: node scripts/check-auth-policy.mjs
- run: node scripts/check-r5-invariant.mjs
- run: node scripts/check-stack-invariant.mjs
- run: node tests/invariants/run-harness.mjs
- run: cd frontend && pnpm install && pnpm test
- run: cd backend && ./gradlew test
- run: cd contract-tests && pnpm install && pnpm test
```

Breaking any invariant fails the build. Iteration log (`docs/iteration-log/`) shows the 62 rounds it took to harden these — do not weaken them lightly.

---

## Recovery scenarios

### Junie crashes mid-scaffold

`SCAFFOLD_PROGRESS.md` shows last completed checkpoint. Re-run the same command:

```
Follow ../playbooks/create-rag-app.md
```

Junie reads progress file, asks: *"Resume from Phase 03 Unit 4?"* → answer `Y`. Picks up at the last green checkpoint.

### You answered preflight wrong (e.g. picked TS, want JS)

```bash
rm SCAFFOLD_DECISIONS.md SCAFFOLD_PROGRESS.md
rm -rf frontend backend contract-tests docs scripts tests/invariants
```

Re-run `Follow ../playbooks/create-rag-app.md`. Fresh preflight. Skip Step 1 (REFERENCE_BRIEF still valid).

### Test fails during a phase

Junie stops at the failing unit. Read the failing test. Either:
- Fix the test (Junie made a wrong assertion) and ask: *"continue with corrected test"*
- Skip the unit (risky, leaves a gap): *"skip unit X, continue"*

Never edit code while Junie is running — race condition.

### Backend port 8080 in use

```bash
lsof -i :8080
kill <pid>
# OR change port in application.yml: server.port: 8090
```

### Frontend `pnpm install` fails behind corp proxy

```bash
pnpm config set registry https://your-internal-registry/
pnpm install
```

### Orchestrator returns 401 with valid token

Check `OAUTH_AZURE_AD_CLIENT_ID` matches the **API** registration (not SPA). Verify scope `api://<api-client-id>/.default` — the `/.default` suffix is required.

---

## Summary

Skill input: empty repo + `.junie/` + `INTEGRATION_PLAN.md` (+ optional `REFERENCE_BRIEF.md`).

Skill output, ~37 minutes later:
- Vue 3 frontend (9 TDD units, 27 tests)
- Kotlin Spring WebFlux backend (9 + dev-double unit, 32 tests)
- Cross-layer contract tests (16, schema-driven)
- 4 CI invariant scripts (auth, R5, stack, harness)
- 10 documentation guides (~1200 lines)
- Mock orchestrator wired in dev profile (offline-first)
- Hardened MSAL config + auth leak gate

Wire to real orchestrator: change one config value (`app.orchestrator.url`) + flip `app.dev-doubles.enabled: false`. Done.

End-to-end stream: `Vue → Spring (JWT validate) → Orchestrator (OBO → Foundry → AI Search) → SSE → Vue`. Fully agentic, fully audited.
