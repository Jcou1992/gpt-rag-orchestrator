# Junie Skill — Complete Reference Manual

**Purpose:** Authoritative reference documentation for the Junie scaffolding skill. Covers architecture, all options, playbooks, configuration, and edge cases.

**This is the COMPLETE REFERENCE GUIDE.** If you prefer a real-world scenario walkthrough with step-by-step commands and expected output, see [QUICK_START.md](QUICK_START.md) instead.

**Both documents describe the same skill.** Use them together:
- **SKILL_USAGE.md** (this file) → Understand the full architecture, all options, what's possible
- **QUICK_START.md** → Walk through a concrete example, see what output to expect, recover from failures

See [NAVIGATION.md](NAVIGATION.md) for guidance on which to read first.

---

## What this skill does

Scaffolds a complete Vue 3 + Spring Boot RAG app described in [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md), honoring conventions from an optional reference project.

**Key features:**
- ✅ 5 modular phases (preflight, frontend, backend, contracts, docs)
- ✅ TDD enforced at every layer (59+ tests, all green)
- ✅ Fool-proof documentation (1200+ lines)
- ✅ Recoverable checkpoints (SCAFFOLD_PROGRESS.md)
- ✅ Offline-first development (mock orchestrator included)
- ✅ Reference project integration (adopt conventions, versions)

---

---

## Files in this skill

| File | Role |
|---|---|
| [guidelines.md](guidelines.md) | Always-on project rules (thin ~50 lines, loaded every Junie turn) |
| [../playbooks/extract-reference-brief.md](../playbooks/extract-reference-brief.md) | **Reference extraction** — run in reference project, produces `REFERENCE_BRIEF.md` |
| [../playbooks/create-rag-app.md](../playbooks/create-rag-app.md) | **Orchestrator** — calls 5 sub-playbooks sequentially (01-05) |

---

## The 5 Modular Playbooks

When you invoke `create-rag-app.md`, it calls these sub-playbooks in sequence. Each is self-contained and can resume independently if interrupted.

| # | File | Purpose | Input | Output | Duration |
|---|---|---|---|---|---|
| **01** | [01-preflight.md](../playbooks/01-preflight.md) | Lock all decisions upfront (language, package manager, MSAL, versions, add-ons) | (none) | `SCAFFOLD_DECISIONS.md`, `SCAFFOLD_PROGRESS.md` | 2 min |
| **02** | [02-frontend-scaffold.md](../playbooks/02-frontend-scaffold.md) | Generate Vue 3 frontend TDD-first (9 units, 27 tests) | `SCAFFOLD_DECISIONS.md`, `REFERENCE_BRIEF.md` (optional) | `frontend/`, `docs/frontend-api.md`, test report | 10 min |
| **03** | [03-backend-scaffold.md](../playbooks/03-backend-scaffold.md) | Generate Kotlin/Spring backend TDD-first (9 units, 32 tests) | `SCAFFOLD_DECISIONS.md`, `REFERENCE_BRIEF.md` (optional) | `backend/`, `docs/backend-openapi.md`, test report | 12 min |
| **04** | [04-contract-tests.md](../playbooks/04-contract-tests.md) | Cross-layer validation, mocks, fallback docs | Completed `frontend/` + `backend/` | `contract-tests/`, `docs/communication-fallbacks.md`, 16 tests | 4 min |
| **05** | [05-docs-generation.md](../playbooks/05-docs-generation.md) | Generate 10+ comprehensive guides (1200+ lines) | Completed `frontend/` + `backend/` + `contract-tests/` | `docs/` (README, ARCHITECTURE, SETUP, DEVELOPMENT, TESTING, NAMING, TROUBLESHOOTING, etc) | 8 min |

**Each phase reads outputs from prior phases.** Phase 02 reads `SCAFFOLD_DECISIONS.md` to unlock decisions. Phase 03 reads both. Phase 04 reads completed code. All are independent & resumable.

---

## Running individual phases (advanced)

Normally you invoke `create-rag-app.md` (the orchestrator) which calls 01-05 sequentially.

But you can also run phases independently:

```bash
# Run just Phase 02 (frontend) without running 01-04
Follow .junie/../playbooks/02-frontend-scaffold.md
# Requires: SCAFFOLD_DECISIONS.md (from Phase 01)

# Run just Phase 03 (backend)
Follow .junie/../playbooks/03-backend-scaffold.md
# Requires: SCAFFOLD_DECISIONS.md (from Phase 01)
```

**Use case:** If you already scaffolded frontend and only need to regenerate backend with different settings.

---

## Prerequisites

- JetBrains IDE (IntelliJ IDEA, WebStorm, PyCharm, etc.) with the **Junie** plugin installed and signed in.
- A reference project checked out locally (optional but strongly recommended — without it the scaffolder falls back to plan defaults).
- This repo checked out, with [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) at the repo root.

---

## Three-step workflow

### Step 1 — Extract the reference brief (optional, ~5 minutes)

Purpose: capture the stack, versions, and conventions of a project you want to stay consistent with.

1. Open the **reference project** in your JetBrains IDE.
2. Copy [../playbooks/extract-reference-brief.md](../playbooks/extract-reference-brief.md) into that project at `.junie/../playbooks/extract-reference-brief.md` (or keep it anywhere Junie can read — the path just needs to be explicit).
3. Open Junie and send:

   > Follow `.junie/../playbooks/extract-reference-brief.md`. Treat this project as the reference. Write the output to `REFERENCE_BRIEF.md` at the repo root.

4. Answer Junie's single grouped question (which layers matter: frontend / backend / tooling / all).
5. Junie writes `REFERENCE_BRIEF.md` in the reference project root.
6. **Copy that file into this (target) repo root:**

   ```bash
   cp <reference-project>/REFERENCE_BRIEF.md <this-repo>/REFERENCE_BRIEF.md
   ```

Skip this step only if you have no reference project. You'll use plan defaults (Vue 3.5, Vuetify 3.7, Vite 5, **JavaScript** frontend, Spring Boot 3.3, Kotlin 1.9, JDK 21, pnpm).

### Step 2 — Scaffold the app (modular, ~30 minutes total)

This step runs 5 phases sequentially. Each phase is self-contained and can be resumed if interrupted.

1. Open **this repo** in your JetBrains IDE.
2. Confirm these files exist:
   - [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) at repo root
   - `REFERENCE_BRIEF.md` at repo root (optional but recommended)
   - [.junie/guidelines.md](guidelines.md)
   - [.junie/../playbooks/create-rag-app.md](../playbooks/create-rag-app.md)
3. Open Junie and send:

   > Follow `.junie/../playbooks/create-rag-app.md`.

4. Answer the **one grouped preflight question** Junie asks. It covers:

   | Key | What you decide |
   |---|---|
   | A | Use `REFERENCE_BRIEF.md` as source of truth? |
   | B | Conflict policy if `frontend/` or `backend/` already exists: abort / sibling-dir / merge-configs-only |
   | C | Package manager (pnpm / npm / yarn) |
   | D | Node version |
   | E | JDK + Kotlin versions |
   | F | Version bumps per dependency (keep reference vs. bump to latest) |
   | G | MSAL auth: scaffold now vs. leave as TODO (with a failing test so it's discoverable) |
   | H | Frontend language: **JavaScript** (default, carried from Vue 2 codebase) or TypeScript |
   | I | Optional add-ons: vue-router, vue-i18n, Playwright, Storybook, Testcontainers, MCP server |

5. Junie locks decisions in `SCAFFOLD_DECISIONS.md`, then runs **Phase 01 (Preflight) ✅ done**.

6. **Phase 02 (Frontend-Scaffold):** Junie generates `frontend/` with a TDD loop (9 units, red → green per unit, 27 tests total). You'll see failing tests before implementation. Takes ~10 minutes.

7. **Phase 03 (Backend-Scaffold):** Junie generates `backend/` with TDD loop (9 units, 32 tests). Takes ~10 minutes.

8. **Phase 04 (Contract-Tests):** Junie generates JSON-schema contracts, mocks, fallback docs, cross-layer tests. Takes ~3 minutes.

9. **Phase 05 (Docs-Generation):** Junie generates 10+ comprehensive guides (1200+ lines) covering setup, architecture, development, testing, troubleshooting, naming conventions. Takes ~5 minutes.

10. When all phases are done, Junie prints:
    - ✅ Summary: 59+ tests passed, 1200+ lines of docs
    - 📂 File counts (frontend, backend, contract-tests, docs)
    - 🚀 Next steps (how to run locally, integrate real orchestrator)
    - 🔗 Key resources (INTEGRATION_PLAN.md, docs/README.md, troubleshooting)

---

## Live progress tracking

Throughout the scaffold, Junie updates **`SCAFFOLD_PROGRESS.md`** as a memory checkpoint:
- Phase status (✅ DONE / ⏳ PENDING)
- Test counts per unit
- What's next
- Any blockers or notes

If Junie is interrupted mid-phase:
- Restart: "Follow .junie/../playbooks/create-rag-app.md"
- Junie detects `SCAFFOLD_PROGRESS.md` and asks: "Resume from Phase X?"
- Resumes without re-running completed phases
- No lost work

---

## Invocation cheatsheet

**Note on naming:** 
- "Phase 1" = extraction step (reference project only)
- "Phases 01-05" = modular scaffolding steps (called sequentially by orchestrator)

### Standard workflow

```bash
# Step 1: Extract reference (optional, inside reference project)
Follow .junie/../playbooks/extract-reference-brief.md
# Output: REFERENCE_BRIEF.md

# Copy the brief to target project
cp REFERENCE_BRIEF.md <target-project>/

# Step 2: Scaffold app (inside target project, calls phases 01-05 sequentially)
Follow .junie/../playbooks/create-rag-app.md
# Orchestrator runs: 01-preflight → 02-frontend → 03-backend → 04-contracts → 05-docs
```

### Advanced usage

```bash
# Resume if interrupted (Junie detects progress, asks which phase to resume from)
Follow .junie/../playbooks/create-rag-app.md
# Junie: "Resume from Phase 03?" → [Y] → skips 01-02, continues 03-05

# Re-run with different preflight answers (reset decisions)
# Delete: rm SCAFFOLD_DECISIONS.md
Follow .junie/../playbooks/create-rag-app.md
# Fresh preflight question, re-scaffold with new choices

# Run just Phase 02 (frontend only, requires Phase 01 to have run first)
Follow .junie/../playbooks/02-frontend-scaffold.md

# Run just Phase 03 (backend only)
Follow .junie/../playbooks/03-backend-scaffold.md
```

**Invocation style:** Junie does not have slash commands. Use plain English: `Follow .junie/../playbooks/create-rag-app.md`. Be explicit with the path.

---

## Expected outputs

After all 5 phases complete (01-05), you should have:

```
.
├── INTEGRATION_PLAN.md                    # pre-existing
├── REFERENCE_BRIEF.md                     # (if extracted in Phase 1)
├── SCAFFOLD_DECISIONS.md                  # audit log (locked after Phase 01)
├── SCAFFOLD_PROGRESS.md                   # live status checkpoints (updated per phase)
├── README.md                              # (re)generated
├── frontend/                              # Vue 3 app (Phase 02)
│   ├── package.json
│   ├── vite.config.js                     # (or .ts if TypeScript chosen)
│   ├── jsconfig.json                      # (or tsconfig.json if TypeScript)
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── components/rag/                # 4 components (RagChat, RagMessage, RagCitation, RagInput)
│       ├── composables/                   # useRagChat, useSseClient
│       ├── services/                      # ragApi, auth
│       ├── models/                        # rag.js (JS mode) or types/rag.ts (TS mode)
│       ├── plugins/                       # markdown
│       └── *.spec.js                      # 27 tests (all TDD-green)
├── backend/                               # Kotlin + Spring Boot (Phase 03)
│   ├── build.gradle.kts
│   ├── src/main/kotlin/com/example/rag/
│   │   ├── RagApplication.kt
│   │   ├── config/                        # SecurityConfig, WebClientConfig, OrchestratorProperties
│   │   ├── web/                           # RagController, ToolController, DTOs
│   │   ├── service/                       # OrchestratorClient, SseEnvelopeMapper, UserContextBuilder
│   │   └── tools/                         # ToolRegistry, CreateTicketTool
│   ├── src/test/kotlin/                   # 32 tests (all TDD-green)
│   └── application.yml                    # config (includes mock orchestrator by default)
├── contract-tests/                        # Cross-layer validation (Phase 04)
│   ├── schemas/
│   │   └── ask-chunk-event.schema.json
│   ├── contract.spec.js                   # frontend tests (8 tests)
│   └── contract.kt                        # backend tests (8 tests)
├── docs/                                  # Comprehensive guides (Phase 05, 1200+ lines)
│   ├── README.md                          # Main entry point, cross-links all
│   ├── ARCHITECTURE.md                    # System design, decisions, tech stack
│   ├── SETUP.md                           # Installation, config, quickstart
│   ├── DEVELOPMENT.md                     # How to add features (TDD examples)
│   ├── TESTING.md                         # Testing philosophy & practices
│   ├── NAMING-CONVENTIONS.md              # Coding standards
│   ├── TROUBLESHOOTING.md                 # Common issues, fixes, recovery
│   ├── INTEGRATION-WITH-ORCHESTRATOR.md   # How to connect real backend
│   ├── COMMUNICATION-FALLBACKS.md         # Mocks, error scenarios, offline dev
│   ├── REPO-STRUCTURE.md                  # Quick reference
│   ├── frontend-api.md                    # Auto-extracted (Services, Composables, Models)
│   └── backend-openapi.md                 # Auto-extracted (REST API spec)
├── .junie/                                # Skill files (this folder)
└── (optionally) docker-compose.yml, Makefile, .github/workflows/ci.yml
```

**Key notes:**
- **Language:** JavaScript by default (`.js`, `jsconfig.json`). TypeScript (`.ts`, `tsconfig.json`) only if chosen in Phase 01.
- **Tests:** 27 frontend + 32 backend + 16 contract = **59 total, all passing**
- **Docs:** 10+ files generated automatically (not hand-written)
- **Checkpoints:** `SCAFFOLD_DECISIONS.md` (read-only audit log), `SCAFFOLD_PROGRESS.md` (live status, auto-updated per phase)

---

## Troubleshooting

**For step-by-step recovery scenarios with real output examples, see [QUICK_START.md — "When Things Go Wrong"](QUICK_START.md#when-things-go-wrong-recovery-guide).**

QUICK_START.md covers these concrete scenarios:
- Junie crashes mid-Phase 03 → Resume from checkpoint
- You answered preflight wrong → Re-scaffold with correct choices
- Tests fail during Phase 02 → Junie debugs or aborts
- Port 8080 already in use → Use different port
- MSAL is TODO → How to wire it later

### Quick reference (common issues)

**Playbook not found:**
- Pass path explicitly: `.junie/../playbooks/create-rag-app.md` (relative from repo root)
- If subfolder open, reopen repo root or give absolute path

**Junie skips preflight question:**
- Tell Junie: *"Before any file writes, ask the preflight question (A–I)"*
- Preflight is blocking; should lock decisions before code generation

**Junie skips failing tests:**
- Remind Junie: *"TDD is mandatory per guidelines.md. Show failing test first."*
- Tests are blockers; implementation only after red → green

**Existing frontend/ or backend/ gets overwritten:**
- Shouldn't happen (conflict policy is asked in preflight)
- If it did, recover from git; file issue with Junie transcript

**REFERENCE_BRIEF.md not found, but you want to use defaults:**
- Junie will warn once; you can proceed with plan defaults
- Or run Phase 1 extraction first: `Follow .junie/../playbooks/extract-reference-brief.md`

**Version bump broke the build:**
- `SCAFFOLD_DECISIONS.md` records every choice
- Roll back via git, re-run with `keep` for offending dep, or delete SCAFFOLD_DECISIONS.md and re-scaffold

---

## Customizing the skill

- **Change standing rules:** edit [guidelines.md](guidelines.md). It's loaded every Junie turn in this project, so keep it under ~50 lines. Anything longer belongs in a playbook.
- **Change defaults** (Vue/Vuetify/Spring versions, package manager): edit the defaults listed in [../playbooks/create-rag-app.md](../playbooks/create-rag-app.md) Step 1.
- **Add a new phase or add-on:** extend Step 1.H options and add the corresponding scaffold step. Keep the TDD loop structure.
- **Share across projects:** copy the `.junie/` folder into any repo that needs the same scaffolder. The playbooks are self-contained; only the link to `INTEGRATION_PLAN.md` is project-specific.

---

## Design notes (why the skill is built this way)

- **Playbooks, not `guidelines.md` bloat.** Junie loads `guidelines.md` every turn — putting a 400-line scaffolder there would cost tokens on every future edit. Playbooks stay cold until invoked by name.
- **Two phases, not one.** Junie can't read files outside the current project, so the reference project must produce a portable `REFERENCE_BRIEF.md` the scaffolder can consume.
- **One grouped preflight question.** Multiple back-and-forth questions waste turns and let the model drift. Answer all decisions up front, written to `SCAFFOLD_DECISIONS.md` as an audit log.
- **TDD enforced, MSAL-deferral discoverable.** If you skip MSAL, the generated `getToken()` throws and a test asserts that — so the gap is visible in CI, not hidden behind silent `// TODO`.
