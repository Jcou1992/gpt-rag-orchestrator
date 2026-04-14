# Playbook: Create RAG App — Orchestrator (calls phases 01–05 sequentially)

**Purpose:** Master orchestrator. Calls each phase playbook in sequence, updates `SCAFFOLD_PROGRESS.md` as a live memory checkpoint, allows stopping/resuming.

**Run this playbook inside the target project.**

---

## How it works

This playbook is a **sequencer**, not a scaffolder. It:

1. Runs **01-preflight** — collects all decisions, locks them.
2. Runs **02-frontend-scaffold** — generates Vue 3 code, tests, docs.
3. Runs **03-backend-scaffold** — generates Kotlin/Spring code, tests, docs.
4. Runs **04-contract-tests** — cross-layer validation, mocks, fallbacks.
5. Runs **05-docs-generation** — comprehensive guides for any developer.

Each phase:
- Reads the outputs of prior phases
- Generates code, tests, documentation
- Updates `SCAFFOLD_PROGRESS.md` with a checkpoint
- Returns cleanly so the next phase can start

If Junie is interrupted mid-phase, you can re-run this playbook and it will:
- Detect what's already done (via `SCAFFOLD_PROGRESS.md`)
- Skip completed phases
- Resume at the interrupted phase

---

## Usage

```
Follow .junie/playbooks/create-rag-app.md
```

Junie will then:
1. Check if a prior scaffold is in progress (`SCAFFOLD_PROGRESS.md` exists).
2. If yes, ask: "Resume from phase X, or start fresh?"
3. Run phases sequentially, showing progress after each.
4. Print a final summary with next steps.

---

## Step 1 — Context check

Read `SCAFFOLD_PROGRESS.md` (if exists) to detect prior state.

If prior scaffold in progress:
```
Found prior scaffold in progress:
  Last completed: Phase 02 (Frontend-Scaffold)
  Next: Phase 03 (Backend-Scaffold)

Resume from Phase 03? [Y/n]
  - Y: Skip phases 01–02, start at 03
  - n: Start completely fresh (resets all decisions, deletes code)
```

If no prior scaffold, proceed to Phase 01.

---

## Step 2 — Execute phases sequentially

### Phase 01 — Preflight & Decisions Lock

```
Running: 01-preflight.md
───────────────────────────
(collects decisions, writes SCAFFOLD_DECISIONS.md)
```

After Phase 01 completes, print:
```
✅ Phase 01 complete. Decisions locked.
```

### Phase 02 — Frontend Scaffold

```
Running: 02-frontend-scaffold.md
───────────────────────────────
(generates frontend/, tests, docs/frontend-api.md)
```

Junie should:
- Read `SCAFFOLD_DECISIONS.md` to unlock decisions
- Run the full TDD loop (9 units, red → green)
- Print test results
- Generate docs
- Update `SCAFFOLD_PROGRESS.md`

After Phase 02 completes, print:
```
✅ Phase 02 complete. 27/27 tests passed.
```

### Phase 03 — Backend Scaffold

```
Running: 03-backend-scaffold.md
───────────────────────────────
(generates backend/, tests, docs/backend-openapi.md)
```

Similar to Phase 02, but for Kotlin/Spring.

After Phase 03 completes, print:
```
✅ Phase 03 complete. 32/32 tests passed.
```

### Phase 04 — Contract Tests & Fallbacks

```
Running: 04-contract-tests.md
─────────────────────────────
(generates contract-tests/, mocks, fallback docs)
```

After Phase 04 completes, print:
```
✅ Phase 04 complete. Contract validation: 16/16 passed.
```

### Phase 05 — Comprehensive Documentation

```
Running: 05-docs-generation.md
──────────────────────────────
(generates docs/, 10+ guides, 1200+ lines)
```

After Phase 05 completes, print:
```
✅ Phase 05 complete. Documentation generated: 1200+ lines.
```

---

## Step 3 — Final summary

After all 5 phases, print:

```
═══════════════════════════════════════════════════════
✅ RAG APP SCAFFOLD COMPLETE
═══════════════════════════════════════════════════════

📊 Summary:

Frontend:
  ✅ 27 tests passed, 9 units TDD-green
  ✅ docs/frontend-api.md (API reference)
  ✅ Language: <JS/TS>, MSAL: <now/TODO>

Backend:
  ✅ 32 tests passed, 9 units TDD-green
  ✅ docs/backend-openapi.md (REST API spec)
  ✅ JDK 21, Kotlin 1.9

Cross-layer:
  ✅ Contract tests: 16/16 passed
  ✅ Mock orchestrator (offline dev)
  ✅ Auth fallback (if MSAL deferred)
  ✅ Communication failure docs

Documentation (1200+ lines):
  ✅ README.md (entry point)
  ✅ ARCHITECTURE.md (system design)
  ✅ SETUP.md (install & config)
  ✅ DEVELOPMENT.md (how to modify)
  ✅ TESTING.md (testing practices)
  ✅ NAMING-CONVENTIONS.md (coding standards)
  ✅ TROUBLESHOOTING.md (common fixes)
  ✅ INTEGRATION-WITH-ORCHESTRATOR.md (real backend)
  ✅ COMMUNICATION-FALLBACKS.md (mocks & errors)
  ✅ REPO-STRUCTURE.md (quick reference)

═══════════════════════════════════════════════════════

📂 File counts:

frontend/: 15+ files (components, composables, services, tests, config)
backend/: 20+ files (controllers, services, DTOs, tests, config)
contract-tests/: 5+ files (schemas, tests)
docs/: 10+ files (guides, API refs)

═══════════════════════════════════════════════════════

🚀 Next steps:

1. Read: docs/README.md (complete guide)

2. Run locally:
   Terminal 1: cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev,mock'
   Terminal 2: cd frontend && pnpm dev
   Browser: http://localhost:5173

3. Try it:
   - Submit a query (returns mocked response)
   - Check browser console (no errors)
   - Run tests: cd frontend && pnpm test (should all pass)

4. When ready to integrate real orchestrator:
   - Set ORCHESTRATOR_URL and API_KEY in backend/application.yml
   - Or follow docs/INTEGRATION-WITH-ORCHESTRATOR.md

5. Modify & extend:
   - See docs/DEVELOPMENT.md (TDD-first)
   - See docs/NAMING-CONVENTIONS.md (coding standards)
   - Run tests after every change (keep them green)

═══════════════════════════════════════════════════════

🔗 Key resources:

- INTEGRATION_PLAN.md ← authoritative design (read if you want to understand the "why")
- SCAFFOLD_DECISIONS.md ← your scaffolding choices (read-only)
- docs/README.md ← complete onboarding guide
- docs/TROUBLESHOOTING.md ← common issues & fixes

═══════════════════════════════════════════════════════

❓ Questions?

Check docs/TROUBLESHOOTING.md or file an issue.

Good luck! 🎉
```

---

## Step 4 — Update SCAFFOLD_PROGRESS.md final summary

After all phases, append:

```markdown
═══════════════════════════════════════════════════════

## FINAL STATUS: ✅ COMPLETE

**Timestamp:** <datetime>
**Total duration:** <X minutes>
**All phases completed:** YES

---

## What was generated

### Code (59+ tests, all passing)
- frontend/: Vue 3 + Vuetify, 27 tests
- backend/: Kotlin + Spring Boot, 32 tests
- contract-tests/: cross-layer validation

### Documentation (1200+ lines, fool-proof)
- Setup guide (installation, config, dev environment)
- Architecture guide (design decisions, tech stack)
- Development guide (how to modify, TDD patterns)
- Testing guide (philosophy, practices, examples)
- Naming conventions (variables, classes, files)
- Troubleshooting (common issues, fixes, recovery)
- API references (auto-generated from code)
- Integration guide (how to connect real orchestrator)

### Decisions (locked in SCAFFOLD_DECISIONS.md)
- Language: <JS/TS>
- Package manager: <pnpm/npm/yarn>
- MSAL auth: <now/TODO>
- Add-ons: <list or none>
- Testing framework: <Vitest/Jest>
- Reference project: <used Y/N>

---

## You can now:

✅ Run the app locally (with mocks, no orchestrator needed)
✅ Understand the architecture (ARCHITECTURE.md)
✅ Make changes confidently (TDD-first, DEVELOPMENT.md)
✅ Write tests (TESTING.md with examples)
✅ Debug issues (TROUBLESHOOTING.md)
✅ Onboard new team members (docs are self-contained)
✅ Extend the backend with new tools (ToolRegistry pattern)
✅ Integrate real orchestrator later (INTEGRATION-WITH-ORCHESTRATOR.md)

---

## Next steps (from INTEGRATION_PLAN.md §8):

- **Phase 2 Hardening** — rate limiting, resilience, caching
- **Phase 3 Agentic** — implement real tools (database, CRM, etc.)
- **Phase 4 MCP** — optional, multi-client tool sharing

---

## Code quality metrics

- Test coverage: 85%+ (frontend), 80%+ (backend)
- Lint: 0 errors
- Tests: all passing (0 skipped)
- Documentation: 100% of major components
- Naming conventions: applied throughout

---

## Session info

- Playbooks run: 01, 02, 03, 04, 05
- Files created: 59+
- Commits: 18+ (one per TDD unit)
- Total decisions locked: 9 (A–I from preflight)

---

**Scaffold is ready. Happy coding!** 🚀
```

---

## Resumption logic

If `SCAFFOLD_PROGRESS.md` already exists and indicates prior completion:

```
Prior scaffold detected (completed <timestamp>).

Rerun? Options:
(1) Start fresh (deletes SCAFFOLD_DECISIONS.md, frontend/, backend/, contract-tests/, docs/)
(2) Resume from Phase 01 (re-collect decisions, regenerate everything)
(3) Exit and make manual edits

Choice? (default: 3 — exit, let user decide)
```

---

## Guardrails

- **Never silently overwrite decisions.** Always ask before proceeding if SCAFFOLD_DECISIONS.md exists.
- **Each phase is recoverable.** If Junie crashes mid-phase, `SCAFFOLD_PROGRESS.md` shows what was done; re-run and it resumes.
- **Memory checkpoints matter.** `SCAFFOLD_PROGRESS.md` is the single source of truth for progress state.
- **All phases must pass.** Do not proceed to Phase N+1 if Phase N tests don't pass.
