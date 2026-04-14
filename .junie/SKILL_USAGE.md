# Junie Skill — GPT-RAG App Scaffolder (Usage Guide)

A two-phase Junie skill that scaffolds the Vue 3 + Spring Boot app described in [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md), while staying consistent with an existing reference project.

---

## What the skill contains

| File | Role |
|---|---|
| [guidelines.md](guidelines.md) | Always-on project rules loaded by Junie every turn. Pointers to playbooks. Keep this thin. |
| [playbooks/extract-reference-brief.md](playbooks/extract-reference-brief.md) | Run **inside a reference project** to produce `REFERENCE_BRIEF.md`. |
| [playbooks/create-rag-app.md](playbooks/create-rag-app.md) | Run **inside this (target) project** to scaffold `frontend/` + `backend/` TDD-first. |

---

## Prerequisites

- JetBrains IDE (IntelliJ IDEA, WebStorm, PyCharm, etc.) with the **Junie** plugin installed and signed in.
- A reference project checked out locally (optional but strongly recommended — without it the scaffolder falls back to plan defaults).
- This repo checked out, with [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) at the repo root.

---

## Two-phase usage

### Phase 1 — Extract the reference brief

Purpose: capture the stack, versions, and conventions of a project you want to stay consistent with.

1. Open the **reference project** in your JetBrains IDE.
2. Copy [playbooks/extract-reference-brief.md](playbooks/extract-reference-brief.md) into that project at `.junie/playbooks/extract-reference-brief.md` (or keep it anywhere Junie can read — the path just needs to be explicit).
3. Open Junie and send:

   > Follow `.junie/playbooks/extract-reference-brief.md`. Treat this project as the reference. Write the output to `REFERENCE_BRIEF.md` at the repo root.

4. Answer Junie's single grouped question (which layers matter: frontend / backend / tooling / all).
5. Junie writes `REFERENCE_BRIEF.md` in the reference project root.
6. **Copy that file into this (target) repo root:**

   ```bash
   cp <reference-project>/REFERENCE_BRIEF.md <this-repo>/REFERENCE_BRIEF.md
   ```

Skip this phase only if you have no reference project. You'll get plan defaults (Vue 3.5, Vuetify 3.7, Vite 5, **JavaScript** frontend, Spring Boot 3.3, Kotlin 1.9, JDK 21, pnpm).

### Phase 2 — Scaffold the app

1. Open **this repo** in your JetBrains IDE.
2. Confirm these files exist:
   - [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) at repo root
   - `REFERENCE_BRIEF.md` at repo root (optional but recommended)
   - [.junie/guidelines.md](guidelines.md)
   - [.junie/playbooks/create-rag-app.md](playbooks/create-rag-app.md)
3. Open Junie and send:

   > Follow `.junie/playbooks/create-rag-app.md`.

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

5. Junie writes `SCAFFOLD_DECISIONS.md` capturing your answers, then runs a strict **TDD loop** per unit: red → green → refactor → commit. You'll see failing tests before any implementation appears.

6. When done, Junie prints:
   - All created file paths (grouped by frontend / backend / root)
   - Green test counts per layer
   - Any TODOs you explicitly deferred
   - The next suggested phase from [INTEGRATION_PLAN.md §8](../INTEGRATION_PLAN.md)

---

## Invocation cheatsheet

```text
# Phase 1 (inside reference project)
Follow .junie/playbooks/extract-reference-brief.md and write REFERENCE_BRIEF.md at the repo root.

# Phase 2 (inside this target project)
Follow .junie/playbooks/create-rag-app.md.

# Re-run with different answers
Re-run .junie/playbooks/create-rag-app.md. Use sibling-dir conflict policy and bump Vue to latest.

# Partial scaffolds
Follow .junie/playbooks/create-rag-app.md but skip the backend — frontend only for now.
```

Junie does not have true slash commands; invocation is plain English referencing the playbook path. Be explicit.

---

## Expected outputs

After Phase 2 completes successfully you should have:

```
.
├── INTEGRATION_PLAN.md           # pre-existing
├── REFERENCE_BRIEF.md            # from Phase 1
├── SCAFFOLD_DECISIONS.md         # audit log written by Phase 2
├── README.md                     # (re)generated
├── frontend/                     # matches INTEGRATION_PLAN.md §4.2
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/...
├── backend/                      # matches INTEGRATION_PLAN.md §4.1
│   ├── build.gradle.kts
│   └── src/main/kotlin/...
├── contract-tests/               # JSON-schema-driven cross-layer tests
├── .junie/                       # this folder
└── (optionally) docker-compose.yml, Makefile, .github/workflows/ci.yml
```

---

## Troubleshooting

**Junie says it can't find the playbook.** Pass the path explicitly: `.junie/playbooks/create-rag-app.md` (relative from repo root). If you opened a subfolder, either reopen the repo root or give an absolute path.

**Junie starts coding without asking the preflight question.** Stop it and re-send: *"Before any file writes, ask the Step 1 preflight question from the playbook."* The playbook is explicit that Step 1 must block on user input.

**Junie skips failing tests and jumps to implementation.** Remind it: *"TDD is mandatory per guidelines.md. Show the failing test first, then implement."* If it persists, capture the deviation in `SCAFFOLD_DECISIONS.md`.

**Existing `frontend/` or `backend/` gets overwritten.** Shouldn't happen — the playbook requires conflict policy confirmation in Step 1.B. If it did, you can recover from git; file an issue in this repo's issue tracker with the Junie transcript.

**No `REFERENCE_BRIEF.md` and you want Phase 2 to pause.** Include *"Abort if REFERENCE_BRIEF.md is missing"* in your invocation message.

**Version bumps broke something.** `SCAFFOLD_DECISIONS.md` records every version choice. Roll back via git, re-run with `keep` for the offending dep.

---

## Customizing the skill

- **Change standing rules:** edit [guidelines.md](guidelines.md). It's loaded every Junie turn in this project, so keep it under ~50 lines. Anything longer belongs in a playbook.
- **Change defaults** (Vue/Vuetify/Spring versions, package manager): edit the defaults listed in [playbooks/create-rag-app.md](playbooks/create-rag-app.md) Step 1.
- **Add a new phase or add-on:** extend Step 1.H options and add the corresponding scaffold step. Keep the TDD loop structure.
- **Share across projects:** copy the `.junie/` folder into any repo that needs the same scaffolder. The playbooks are self-contained; only the link to `INTEGRATION_PLAN.md` is project-specific.

---

## Design notes (why the skill is built this way)

- **Playbooks, not `guidelines.md` bloat.** Junie loads `guidelines.md` every turn — putting a 400-line scaffolder there would cost tokens on every future edit. Playbooks stay cold until invoked by name.
- **Two phases, not one.** Junie can't read files outside the current project, so the reference project must produce a portable `REFERENCE_BRIEF.md` the scaffolder can consume.
- **One grouped preflight question.** Multiple back-and-forth questions waste turns and let the model drift. Answer all decisions up front, written to `SCAFFOLD_DECISIONS.md` as an audit log.
- **TDD enforced, MSAL-deferral discoverable.** If you skip MSAL, the generated `getToken()` throws and a test asserts that — so the gap is visible in CI, not hidden behind silent `// TODO`.
