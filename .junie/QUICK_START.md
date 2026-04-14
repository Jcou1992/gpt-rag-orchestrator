# Junie Skill — Complete Quick Start (0 to Working App)

**Goal:** Use the Junie skill to scaffold a complete Vue 3 + Spring Boot RAG app from nothing, recover from failures, and verify it works.

**Audience:** Anyone. No prior context required.

---

## Prerequisites (5 minutes)

Before you start, confirm you have:

- [ ] **JetBrains IDE** (IntelliJ IDEA, WebStorm, PyCharm, etc.)
- [ ] **Junie plugin** installed and signed in (Settings → Plugins → search "Junie")
- [ ] **Git repo** cloned and open in your IDE
- [ ] **Terminal** (inside or outside IDE) ready for commands
- [ ] **Node.js 20+** installed (`node --version`)
- [ ] **JDK 21+** installed (`java -version`)
- [ ] **Git status clean** (no uncommitted changes, or commit them first)

**Optional but recommended:**
- [ ] A reference project (another Vue/Spring codebase) checked out locally → we'll extract its conventions

---

## Real Scenario: Complete Walkthrough

Let's scaffold a RAG app from zero. Follow along exactly.

### Step 1: Open repo in Junie (2 minutes)

1. **Open your IDE** with the empty/target project.
   - Verify `.junie/` folder exists with playbooks
   - Verify [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md) is at repo root

2. **Open Junie** (usually top-right corner of IDE or via keyboard shortcut).

3. You should see Junie's chat interface. Good.

### Step 2: Optional — Extract reference project conventions (5 minutes)

Skip this if you have no reference project. Otherwise:

1. **Open a second IDE window** with your reference project.

2. **In Junie (in the reference project window),** send exactly:

```
Follow .junie/playbooks/extract-reference-brief.md and write REFERENCE_BRIEF.md to the repo root.
Treat this as the reference project for conventions.
```

3. **Junie will ask one grouped question:**

```
Ready to extract. Please confirm:

A. Reference brief detected: frontend/, backend/, docs/
   Use as reference? [Y/n]

B. Layers to extract? (frontend / backend / tooling / all) [default: all]

C. Capture naming patterns, test frameworks, deps? [Y/n]
```

4. **Answer** (example):
```
A: Y
B: all
C: Y
```

5. **Wait** for Junie to read the codebase (30–60 seconds).

6. **Junie prints:**
```
✅ REFERENCE_BRIEF.md written to repo root.

Captured:
- Frontend: Vue 3.4, Vitest + @vue/test-utils, PascalCase components
- Backend: Spring Boot 3.2, JUnit 5 + Mockito, Request/Response DTO suffixes
- Conventions: [list]

Next: Copy REFERENCE_BRIEF.md to target project.
```

7. **Copy the file:**
```bash
cp REFERENCE_BRIEF.md <path-to-target-project>/REFERENCE_BRIEF.md
```

8. **Switch to target project IDE window.** Continue below.

### Step 3: Kick off the scaffolder (now the main event)

1. **In target project, in Junie, send exactly:**

```
Follow .junie/playbooks/create-rag-app.md
```

2. **Junie responds** (may take 10–30 seconds to read context):

```
Scaffolding RAG app...

Reading: INTEGRATION_PLAN.md, REFERENCE_BRIEF.md (if present), git status...

Ready to proceed. One question:
```

Then Junie asks the **grouped preflight question (A–I).** This is the only time you have to answer.

### Step 4: Answer the preflight question

Junie asks:

```
Ready to scaffold. Please confirm or override:

A. REFERENCE_BRIEF
   Detected: /path/to/REFERENCE_BRIEF.md
   Use as source of truth for conventions? [Y/n]

B. CONFLICT POLICY
   frontend/ exists: no
   backend/ exists: no
   Policy if conflicts: [abort / sibling-dir / merge-configs-only]? (default: abort)

C. PACKAGE MANAGER (frontend)
   Reference suggests: pnpm@9
   Use same? [Y/n]  If n, choose: [pnpm / npm / yarn]

D. NODE VERSION
   Reference suggests: 20.x
   Use same? [Y/n]  If n, specify: [18 / 20 / 22]

E. JDK + KOTLIN (backend)
   Reference suggests: JDK 21, Kotlin 1.9
   Use same? [Y/n]  If n, specify JDK: [17 / 21 / 23], Kotlin: [1.9 / 2.0]

F. VERSION BUMPS
   I found newer stable versions. Keep reference or bump?
   - vue: 3.4 → 3.5 [keep / bump]
   - vuetify: 3.6 → 3.7 [keep / bump]
   - spring-boot: 3.2 → 3.3 [keep / bump]
   (and 3 more...)

G. MSAL / ENTRA ID AUTH
   Options:
   (1) Scaffold MSAL now (requires SPA client ID, tenant ID, scope)
   (2) Leave as TODO (generates failing test, you wire it later)

H. FRONTEND LANGUAGE
   (1) JavaScript (.js files, <script setup>, JSDoc)
   (2) TypeScript (.ts files, <script setup lang="ts">)

I. OPTIONAL ADD-ONS (pick any)
   [ ] vue-router [ ] vue-i18n [ ] playwright-e2e [ ] storybook
   [ ] testcontainers [ ] mcp-server
```

**Example answer** (safe defaults):

```
A: Y
B: abort
C: Y
D: Y
E: Y
F: (press Enter to keep all defaults)
G: 2 (leave MSAL as TODO)
H: 1 (JavaScript, team standard)
I: (none selected, press Enter)
```

5. **Send the answer.**

### Step 5: Wait for scaffold to complete (30–40 minutes total)

Junie will now run **Phases 01–05 sequentially**. This is automated.

**Phase 01 — Preflight (2 minutes):**
```
Running: 01-preflight.md
─────────────────────────

Reading REFERENCE_BRIEF.md, locking decisions...

✅ Phase 01 complete. Decisions locked in SCAFFOLD_DECISIONS.md.

Next: Phase 02 (Frontend)
```

**Phase 02 — Frontend (10 minutes):**
```
Running: 02-frontend-scaffold.md
────────────────────────────────

Generating frontend/ structure...
Test framework: Vitest (from REFERENCE_BRIEF)
Language: JavaScript

TDD Loop:
─────────

Unit 1: models/rag.js
  ❌ FAILING TEST: should export AskChunk union type
  
  (Junie writes the test)
  
  ✅ TEST PASSING: AskChunk exported correctly
  
  Commit: test(rag-fe): models — TDD green

Unit 2: plugins/markdown.js
  ❌ FAILING TEST: should sanitize XSS input
  
  ✅ TEST PASSING: XSS sanitized with dompurify
  
  Commit: test(rag-fe): markdown — TDD green

... (Units 3–9, same pattern)

✅ Phase 02 complete. 27/27 tests passed.

Files created:
- frontend/package.json
- frontend/vite.config.js
- frontend/src/models/rag.js
- frontend/src/plugins/markdown.js
- frontend/src/composables/useRagChat.js
- frontend/src/composables/useSseClient.js
- frontend/src/services/ragApi.js
- frontend/src/services/auth.js (MSAL status: TODO)
- frontend/src/components/rag/ (4 components)
- frontend/src/ (config, tests, etc.)

Docs: docs/frontend-api.md generated

Next: Phase 03 (Backend)
```

**Phase 03 — Backend (12 minutes):**
```
Running: 03-backend-scaffold.md
───────────────────────────────

Generating backend/ structure...
Test framework: JUnit 5 + MockK (from REFERENCE_BRIEF)
JDK: 21, Kotlin: 1.9

TDD Loop:

Unit 1: DTOs
  ❌ FAILING TEST: AskChunk.Chunk serializes with type discriminator
  
  ✅ TEST PASSING: discriminator present on serialization
  
  Commit: test(rag-be): DTOs — TDD green

... (Units 2–9, same pattern)

✅ Phase 03 complete. 32/32 tests passed.

Files created:
- backend/build.gradle.kts
- backend/src/main/kotlin/com/example/rag/RagApplication.kt
- backend/src/main/kotlin/com/example/rag/config/ (3 classes)
- backend/src/main/kotlin/com/example/rag/web/ (controllers, DTOs)
- backend/src/main/kotlin/com/example/rag/service/ (3 services)
- backend/src/main/kotlin/com/example/rag/tools/ (registry + sample)
- backend/src/test/kotlin/ (test files for all units)

Docs: docs/backend-openapi.md generated

Next: Phase 04 (Contracts)
```

**Phase 04 — Contract Tests (4 minutes):**
```
Running: 04-contract-tests.md
──────────────────────────────

Generating JSON-schema contracts...
Generating mock orchestrator...
Generating fallback docs...

✅ Phase 04 complete. Contract validation: 16/16 passed.

Files created:
- contract-tests/schemas/ask-chunk-event.schema.json
- contract-tests/ (test files)
- docs/communication-fallbacks.md (offline dev, error scenarios)

Next: Phase 05 (Docs)
```

**Phase 05 — Docs (8 minutes):**
```
Running: 05-docs-generation.md
──────────────────────────────

Generating comprehensive documentation...

✅ Phase 05 complete. 1200+ lines of docs generated.

Files created:
- docs/README.md (main entry point)
- docs/ARCHITECTURE.md (design & decisions)
- docs/SETUP.md (installation & config)
- docs/DEVELOPMENT.md (how to modify)
- docs/TESTING.md (testing philosophy)
- docs/NAMING-CONVENTIONS.md (coding standards)
- docs/TROUBLESHOOTING.md (common issues & fixes)
- docs/INTEGRATION-WITH-ORCHESTRATOR.md (real backend)
- docs/REPO-STRUCTURE.md (quick reference)
- docs/frontend-api.md (auto-extracted)
- docs/backend-openapi.md (auto-extracted)

═════════════════════════════════════════════════════════
✅ RAG APP SCAFFOLD COMPLETE
═════════════════════════════════════════════════════════

📊 Summary:

Frontend: 27 tests passed, 9 units TDD-green, docs generated
Backend: 32 tests passed, 9 units TDD-green, docs generated
Contracts: 16 tests passed, schemas + mocks + docs
Docs: 1200+ lines (setup, architecture, development, testing, troubleshooting)

📂 Files created: 59+
✅ Tests: 59/59 passing
✅ Decisions: SCAFFOLD_DECISIONS.md locked
✅ Progress: SCAFFOLD_PROGRESS.md updated

🚀 Next steps:

1. Run locally (offline, with mocks):
   Terminal 1: cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev,mock'
   Terminal 2: cd frontend && pnpm dev
   Browser: http://localhost:5173

2. Read docs:
   Start here: docs/README.md (comprehensive guide)

3. Verify it works:
   - Submit a query in the UI
   - Should get a mocked response (no orchestrator needed)
   - Check frontend tests: cd frontend && pnpm test (all green)
   - Check backend tests: cd backend && ./gradlew test (all green)

4. When ready to integrate real orchestrator:
   See: docs/INTEGRATION-WITH-ORCHESTRATOR.md

═════════════════════════════════════════════════════════
```

Done! 🎉

### Step 6: Verify it works (5 minutes)

The app is now fully scaffolded and tested. Let's verify it actually runs.

#### 6A: Run locally (with mocks)

**Terminal 1 — Backend:**
```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=dev,mock'
```

Expected output (30 seconds):
```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| ._ |_| |_|_| |_|\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::        (v3.3.0)

2026-04-14 16:30:00.000  INFO 12345 --- [           main] com.example.rag.RagApplication       : Starting RagApplication
...
2026-04-14 16:30:05.000  INFO 12345 --- [           main] com.example.rag.RagApplication       : Started RagApplication in 4.523 seconds (JVM running for 5.012)

Tomcat started on port 8080 with context path ''
Application started successfully
```

Leave this running.

**Terminal 2 — Frontend:**
```bash
cd frontend
pnpm install    # if not already done
pnpm dev
```

Expected output (15 seconds):
```
  VITE v5.4.0  ready in 567 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

#### 6B: Open browser

1. Visit `http://localhost:5173`
2. You should see the **RagChat UI** — a chat interface with an input box
3. Type: "What is the meaning of life?"
4. Click submit (or press Enter)
5. **Expected:** Mocked response appears (because orchestrator is mocked):
   ```
   This is a mocked response to: "What is the meaning of life?"
   ```

Success! ✅

#### 6C: Run tests to confirm everything is green

**Terminal 3 — Frontend tests:**
```bash
cd frontend
pnpm test
```

Expected:
```
 ✓ src/models/rag.spec.js (1)
 ✓ src/plugins/markdown.spec.js (2)
 ✓ src/composables/useSseClient.spec.js (4)
 ✓ src/services/ragApi.spec.js (3)
 ✓ src/composables/useRagChat.spec.js (5)
 ✓ src/components/rag/RagCitation.spec.js (1)
 ✓ src/components/rag/RagMessage.spec.js (2)
 ✓ src/components/rag/RagInput.spec.js (2)
 ✓ src/components/rag/RagChat.spec.js (2)

Test Files  9 passed (9)
     Tests  27 passed (27)
```

**Terminal 4 — Backend tests:**
```bash
cd backend
./gradlew test
```

Expected:
```
BUILD SUCCESSFUL

> Task :test

com.example.rag.web.dto.AskChunkTest > AskChunk.Chunk serializes with type discriminator PASSED
... (31 more tests)

59 tests passed in 12.345s
```

All green! ✅

---

## When Things Go Wrong (Recovery Guide)

### Scenario A: Junie crashes mid-scaffold (Phase 03 fails)

**Symptoms:**
```
Running: 03-backend-scaffold.md
───────────────────────────────

Generating backend/ structure...
Test framework: JUnit 5 + MockK

Unit 1: DTOs
  ❌ FAILING TEST: ...
  
  ✅ TEST PASSING: ...
  
  Commit: test(rag-be): DTOs — TDD green

Unit 2: SseEnvelopeMapper
  ❌ FAILING TEST: ...
  
  [ERROR] Junie connection lost / timeout
```

**Recovery:**

1. **Check SCAFFOLD_PROGRESS.md:**
```bash
cat SCAFFOLD_PROGRESS.md
```

Shows:
```
## Phase 02 — Frontend-Scaffold ✅ DONE
...
## Phase 03 — Backend-Scaffold ⏳ PENDING (INTERRUPTED at Unit 2)
...
```

2. **Tell Junie:**
```
Follow .junie/playbooks/create-rag-app.md
```

3. **Junie detects prior progress:**
```
Prior scaffold detected (from 2026-04-14 16:30):
  Completed: Phase 01, Phase 02
  Interrupted: Phase 03 (at Unit 2 — SseEnvelopeMapper)

Resume from Phase 03? [Y/n]
```

4. **Answer:**
```
Y
```

5. **Junie resumes:**
- Skips Phase 01 & 02 (already done, code exists)
- Resumes Phase 03 at Unit 2
- Continues through Units 2–9
- Completes Phase 04 & 05
- Prints final summary

**No lost work. No re-running completed phases.**

---

### Scenario B: You answer the preflight wrong (picked TypeScript, but team uses JavaScript)

**Symptoms:**

After Phase 02 completes, you realize:
```
Files created:
- frontend/src/models/rag.ts    ← WRONG, should be .js
- frontend/tsconfig.json        ← WRONG
- frontend/src/components/rag/RagChat.vue with <script setup lang="ts">  ← WRONG
```

**Recovery:**

1. **Delete SCAFFOLD_DECISIONS.md:**
```bash
rm SCAFFOLD_DECISIONS.md
```

2. **Also delete generated code** (or keep for reference):
```bash
rm -rf frontend/ backend/ contract-tests/ docs/
```

3. **Tell Junie:**
```
Follow .junie/playbooks/create-rag-app.md
```

4. **Junie detects no prior state** (SCAFFOLD_DECISIONS.md gone):
```
No prior scaffold found. Starting fresh.
```

5. **Answer the preflight differently:**
- H: Choose (1) JavaScript instead of (2) TypeScript

6. **Scaffold runs again from 01–05** with correct language.

**Cost:** ~40 minutes (full scaffold again). But better than shipping TypeScript when team uses JS.

---

### Scenario C: Tests fail during Phase 02

**Symptoms:**
```
Unit 5: useRagChat
  ❌ FAILING TEST: should emit submit event on Enter key
  
  (Junie writes the test)
  
  ❌ TEST STILL FAILING after implementation
  
  Error: Cannot read property 'messages' of undefined
```

**Recovery:**

1. **Junie will NOT proceed to the next unit** (TDD discipline enforced).
2. **Junie debugs:**
   - Checks test syntax (correct?)
   - Checks implementation (complete?)
   - Prints the actual error
3. **Junie asks you:**
```
Test is still failing. Debug options:
(a) Ignore and skip this unit (⚠️ risky, leaves gap)
(b) Let me rewrite the test
(c) Let me rewrite the implementation
(d) Abort Phase 02, you fix it manually
```

4. **Choose (b) or (c):**
```
b (rewrite the test)
```

5. **Junie rewrites the test** and tries again. If it passes, continues.

**If still failing after 2 attempts:**
Junie aborts and tells you:
```
I can't get this unit to pass. Manual intervention needed.

To fix manually:
1. Check: frontend/src/composables/useRagChat.spec.js (the test)
2. Check: frontend/src/composables/useRagChat.js (the implementation)
3. Run: cd frontend && pnpm test useRagChat.spec.js
4. Fix the issue locally
5. When fixed, run: cd frontend && pnpm test (all green)
6. Then resume scaffold with: Follow .junie/playbooks/create-rag-app.md (Phase 02 will resume)
```

**Key:** TDD ensures tests pass before moving on. If a unit is broken, Junie won't hide it.

---

### Scenario D: Port 8080 (backend) is already in use

**Symptoms:**
When you run `./gradlew bootRun`, you get:
```
ERROR in ConfigServletWebServerApplicationContext: ServletWebServerFactory bean creation error
Web server failed to start. Port 8080 is already in use
```

**Recovery:**

1. **Find what's using port 8080:**
```bash
lsof -i :8080    # macOS/Linux
netstat -ano | findstr :8080  # Windows
```

2. **Kill it or choose a different port:**

Option A: Kill the process:
```bash
kill <PID>    # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

Option B: Use a different port:
```bash
./gradlew bootRun -P args='--server.port=8081'
```

3. **Update frontend to point to new port** (if using 8081):
```bash
export VITE_RAG_API_URL=http://localhost:8081
pnpm dev
```

**Recovery is manual** (nothing Junie can do mid-run), but quick.

---

### Scenario E: MSAL is TODO, but you want to test auth

**Symptoms:**
You run the frontend, and `auth.js` has:
```javascript
export async function getToken() {
  throw new Error('auth not wired');
}
```

And the test asserts this:
```
✅ should throw "auth not wired" when MSAL not configured
```

**Recovery:**

This is intentional. Auth is stubbed + discoverable via a failing test in CI.

**To wire MSAL:**

1. **Read:** docs/SETUP.md → "Configuring MSAL auth"
2. **Create app registrations** in Azure Entra ID (SPA + API types)
3. **Get:** Client ID, Tenant ID, Scope
4. **Edit:** `frontend/src/services/auth.js` → implement real `getToken()` using `@azure/msal-browser`
5. **Test:** `cd frontend && pnpm test` → should pass with real MSAL
6. **Run:** `pnpm dev` → login screen appears, then chat

**Junie left a scaffold + failing test to guide you.** Not silent.

---

## When to ask Junie for help

**These situations are recoverable. Do them:**
- ❌ Test fails during scaffold → tell Junie "unit 5 test is failing, debug or abort"
- ❌ Interrupted mid-phase → re-run playbook, resume from checkpoint
- ❌ Port conflict → fix manually, restart backend
- ❌ Git merge conflict → fix manually, `git add`, tell Junie "resume"

**These need a bug report. Do them:**
- ❌ Junie generates syntactically invalid code (e.g., `<script setups>` typo)
- ❌ Junie loses progress (SCAFFOLD_PROGRESS.md corrupted or deleted)
- ❌ A test passes but is clearly wrong (tests bad behavior)

---

## Post-scaffold: Extending the app

After scaffolding, you have a working foundation. Next steps:

### Adding a feature

**Example: Add a "clear chat" button**

1. **Read:** docs/DEVELOPMENT.md → "Adding a new feature" (includes TDD example)

2. **TDD first:**
   ```bash
   cd frontend
   
   # Write failing test
   # (see docs/DEVELOPMENT.md for template)
   
   # See it fail
   pnpm test useRagChat.spec.js
   
   # Implement
   # (write minimum code)
   
   # See it pass
   pnpm test useRagChat.spec.js
   
   # Commit
   git commit -m "feat(rag-chat): add clearChat() method — TDD green"
   ```

3. **Wire into component**
   ```bash
   # Edit frontend/src/components/rag/RagChat.vue
   # Import { clearChat } from composable
   # Add button @click="clearChat"
   
   # Test
   pnpm test RagChat.spec.js
   ```

4. **Verify in browser**
   ```bash
   # pnpm dev already running
   # Visit http://localhost:5173
   # Click "Clear" button
   # Chat history should clear
   ```

5. **Commit**
   ```bash
   git commit -m "feat(rag-chat): add clear button UI — TDD green"
   ```

**Key:** Follow TDD. Keep tests green. Reference docs/DEVELOPMENT.md for patterns.

### Adding a backend tool

**Example: Add a "search knowledge base" tool**

1. **Read:** docs/DEVELOPMENT.md → "Adding a backend tool"

2. **TDD first:**
   ```bash
   cd backend
   
   # Write failing test (SearchToolTest.kt)
   # Implement SearchTool.kt
   # Register in ToolRegistry.kt
   
   # See tests pass
   ./gradlew test -k SearchToolTest
   ```

3. **Verify schema**
   ```bash
   cd contract-tests
   pnpm test
   # Should still pass (no contract changes)
   ```

4. **Commit**
   ```bash
   git commit -m "feat(rag-tools): add SearchKB tool — TDD green"
   ```

**Key:** Tools are extensible via ToolRegistry. No orchestrator code changes needed.

### Integrating real orchestrator

When you have a real RAG orchestrator running:

1. **Read:** docs/INTEGRATION-WITH-ORCHESTRATOR.md

2. **Get:** Orchestrator URL, API key

3. **Update backend config:**
   ```bash
   # backend/application-dev.yml
   orchestrator:
     mock-enabled: false    # disable mock
     url: https://your-orchestrator.azurecontainers.io
     api-key: <shared-secret>
   ```

4. **Restart backend**
   ```bash
   # Kill old process, restart
   ./gradlew bootRun --args='--spring.profiles.active=dev'
   ```

5. **Test**
   ```bash
   # Frontend still at http://localhost:5173
   # Submit a query
   # Real orchestrator responds (not mocked)
   ```

**Key:** Mock orchestrator is disabled. Real responses stream through the same SSE channel.

---

## Checklists

### Pre-scaffold checklist

- [ ] Git status clean
- [ ] Node 20+ installed
- [ ] JDK 21+ installed
- [ ] IDE open with target repo
- [ ] Junie plugin installed & signed in
- [ ] INTEGRATION_PLAN.md at repo root
- [ ] .junie/ folder with playbooks present
- [ ] (Optional) REFERENCE_BRIEF.md copied from reference project

### Post-scaffold checklist

- [ ] SCAFFOLD_DECISIONS.md created (read-only, check your answers)
- [ ] SCAFFOLD_PROGRESS.md created (shows all phases ✅ DONE)
- [ ] frontend/ folder created with 15+ files
- [ ] backend/ folder created with 20+ files
- [ ] contract-tests/ folder created
- [ ] docs/ folder created with 10+ guides
- [ ] All 59+ tests passing (verify with `pnpm test` and `./gradlew test`)
- [ ] Backend starts without errors (`./gradlew bootRun --args='...'`)
- [ ] Frontend starts without errors (`pnpm dev`)
- [ ] UI loads at http://localhost:5173
- [ ] Mocked query works (submit → get response)
- [ ] docs/README.md is readable and clear

### Integration checklist (when connecting real orchestrator)

- [ ] Orchestrator running and accessible
- [ ] API key obtained
- [ ] application.yml updated with real endpoint
- [ ] Mock disabled (`mock-enabled: false`)
- [ ] Backend restarted
- [ ] Real query tested (may take longer than mock)
- [ ] No hardcoded credentials in code (only env vars / Key Vault)

---

## Key files to know

| File | Purpose |
|---|---|
| **INTEGRATION_PLAN.md** | Authoritative system design (read if confused about "why") |
| **SCAFFOLD_DECISIONS.md** | Your build-time choices (read-only audit log) |
| **SCAFFOLD_PROGRESS.md** | Live status of scaffolding (auto-updated, shows checkpoints) |
| **docs/README.md** | Main entry point, cross-links all other docs |
| **docs/DEVELOPMENT.md** | How to add features (TDD examples included) |
| **docs/TESTING.md** | How to write tests (patterns for both layers) |
| **docs/TROUBLESHOOTING.md** | Common issues & fixes |
| **.junie/guidelines.md** | Standing rules (always-on context) |
| **.junie/SKILL_USAGE.md** | Usage reference (similar to this doc) |
| **.junie/playbooks/*.md** | The 5 modular playbooks (don't edit unless extending) |

---

## Common pitfalls (and how to avoid them)

| Pitfall | How to avoid |
|---|---|
| Running `pnpm install` in backend/ | Package manager is only for frontend. Backend uses `./gradlew` |
| Running `npm install` when you chose pnpm | Check SCAFFOLD_DECISIONS.md for your package manager choice. Stick with it |
| Modifying code during scaffold | Let Junie finish all 5 phases. Then modify. If you interrupt and edit, risk merge conflicts |
| Answering preflight question wrong | You can re-scaffold. Delete SCAFFOLD_DECISIONS.md, run playbook again |
| Ignoring failing tests | Don't. TDD discipline is enforced. Fix the test or skip the unit (risky) |
| Running tests in wrong directory | Frontend: `cd frontend && pnpm test`. Backend: `cd backend && ./gradlew test`. Not the other way |
| Forgetting to start both backend & frontend | Two terminals needed. Backend on 8080, frontend on 5173 |
| Hardcoding secrets in code | Use env vars (VITE_* for frontend, application.yml for backend, or Key Vault in prod) |
| Not reading docs after scaffold | docs/ is worth 30 minutes. Answers most questions |

---

## Support

**If something goes wrong:**

1. **Check TROUBLESHOOTING.md** (docs/TROUBLESHOOTING.md) — covers 30+ common issues
2. **Check DEVELOPMENT.md** (docs/DEVELOPMENT.md) — covers how to modify code
3. **Check TESTING.md** (docs/TESTING.md) — covers testing patterns
4. **Re-read this guide** — scroll up to "When Things Go Wrong"
5. **File an issue** — describe the problem, attach SCAFFOLD_PROGRESS.md + error output

---

## Summary

You now have:
- ✅ Fully scaffolded Vue 3 + Spring Boot app
- ✅ 59+ tests, all TDD-green
- ✅ Mock orchestrator (run offline, no network needed)
- ✅ 1200+ lines of foolproof docs
- ✅ Clear recovery path if interrupted
- ✅ Foundation for extending with new features/tools

**Time to fully working app:** ~40 minutes (scaffolding) + 5 minutes (verification) = ~45 minutes from zero.

**You own the product.** All code is yours. All tests are yours. All docs explain your decisions. Go build! 🚀
