# Playbook: 01 — Preflight & Decisions Lock

**Purpose:** Gather all scaffolding decisions upfront, validate environment, write audit log. One-shot, blocking.

**Input:** `REFERENCE_BRIEF.md` (optional), [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md), git status.

**Output:** `SCAFFOLD_DECISIONS.md` (audit log), `SCAFFOLD_PROGRESS.md` initialized.

---

## Step 1 — Context check

Read in order (if they exist):
- `REFERENCE_BRIEF.md` (from Phase 1 extraction)
- `SCAFFOLD_DECISIONS.md` (if restarting — show user what was decided, ask to continue or override)
- [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md)
- Git status (any uncommitted changes?)
- Existing `frontend/` and `backend/` dirs.

If `SCAFFOLD_DECISIONS.md` exists:
> Previous scaffolding decisions found (from <timestamp>). Continue with those, or start fresh?
> - Continue: uses prior decisions, skips A–I below, outputs updated `SCAFFOLD_PROGRESS.md`.
> - Fresh: clears history, runs full preflight.

If restarting fresh, warn:
> ⚠️ This will reset all prior decisions. Git-committed code is safe; uncommitted changes may be lost if conflict policy is "sibling-dir" or "merge". Commit first? [Y/n]

Wait for answer before continuing.

## Step 2 — Grouped preflight question (one message)

Ask the user in **one** message:

```
Ready to scaffold the RAG app. Answer all of the following:

A. REFERENCE_BRIEF
   Detected: <path or "none">
   Use as source of truth for conventions? [Y/n]  (default: Y if found, N if missing)

B. CONFLICT POLICY
   frontend/ exists: <yes/no>
   backend/ exists: <yes/no>
   If conflicts, I should: [abort / sibling-dir / merge-configs-only]? (default: abort)

C. PACKAGE MANAGER (frontend)
   Reference suggests: <pnpm@9 / npm / yarn>
   Use same? [Y/n]  If n, choose: [pnpm / npm / yarn] (default: pnpm)

D. NODE VERSION
   Reference suggests: <20.x / 22.x>
   Use same? [Y/n]  If n, specify: [18 / 20 / 22] (default: 20)

E. JDK + KOTLIN (backend)
   Reference suggests: JDK <21>, Kotlin <1.9.x>
   Use same? [Y/n]  If n, specify JDK: [17 / 21 / 23], Kotlin: [1.9.x / 2.0.x]
   (default: JDK 21, Kotlin 1.9)

F. VERSION BUMPS
   I found newer stable versions. Keep reference or bump?
   - vue:          <ref> → <latest>    [keep / bump]
   - vuetify:      <ref> → <latest>    [keep / bump]
   - vite:         <ref> → <latest>    [keep / bump]
   - pinia:        <ref> → <latest>    [keep / bump]
   - spring-boot:  <ref> → <latest>    [keep / bump]
   - kotlin:       <ref> → <latest>    [keep / bump]
   (default: keep all. reply only with overrides.)

G. MSAL / ENTRA ID AUTH (frontend)
   Options:
   (1) Scaffold MSAL now — requires SPA client ID, tenant ID, API scope
   (2) Leave as TODO — generates failing test + stub. You wire it later.
   (default: 2)

H. FRONTEND LANGUAGE
   Options:
   (1) JavaScript — .js files, <script setup>, JSDoc for hints (team standard)
   (2) TypeScript — .ts + <script setup lang="ts">, tsconfig.json, stricter
   (default: 1)

I. OPTIONAL ADD-ONS (pick any, space-separated):
   - vue-router (SPA routing)
   - vue-i18n (i18n support)
   - playwright-e2e (end-to-end testing)
   - storybook (component gallery)
   - testcontainers (BE integration tests with real DB/Search)
   - mcp-server (MCP protocol bridge — Phase 4)
   (default: none)
```

If no `REFERENCE_BRIEF.md`, warn once:
> No REFERENCE_BRIEF.md found. Using plan defaults (Vue 3.5, Vuetify 3.7, Vite 5, Spring Boot 3.3, Kotlin 1.9, JDK 21, pnpm, JavaScript). Continue? [Y/n/abort-and-run-extraction-first]

**Do not proceed until all A–I are answered or confirmed as default.**

## Step 3 — Validate answers

If the user chose:
- **G = MSAL now:** ask for SPA client ID, tenant ID, API scope. Do not proceed without these.
- **I = testcontainers:** note that you'll need Docker running during backend tests.
- **Version bumps with breaking changes:** call out known issues (e.g., Vue 3.6 requires Vue Router >= 4.9). Require explicit opt-in.

## Step 4 — Write SCAFFOLD_DECISIONS.md

At repo root, write (overwrite if exists):

```markdown
# Scaffold Decisions Log

**Started:** <timestamp>
**Status:** LOCKED (do not edit manually; rerun playbook to change)

## Answers

| Key | Decision | Rationale |
|---|---|---|
| A | Reference: <Y/N> | <from user answer> |
| B | Conflict policy: <abort/sibling-dir/merge> | <from user answer> |
| C | Package manager: <pnpm/npm/yarn> | <from user answer> |
| D | Node: <18/20/22> | <from user answer> |
| E | JDK: <17/21/23>, Kotlin: <1.9/2.0> | <from user answer> |
| F | Version bumps: <list of changes> | <from user answer> |
| G | MSAL: <now/TODO> | <from user answer> + (if now: client ID, tenant, scope) |
| H | Language: <JS/TS> | <from user answer> |
| I | Add-ons: <list or none> | <from user answer> |

## Environment

- Git status: <clean / has uncommitted changes>
- Existing dirs: frontend=<yes/no>, backend=<yes/no>
- Reference brief found: <yes/no>
- Plan version: [INTEGRATION_PLAN.md](../../INTEGRATION_PLAN.md) snapshot

---

## Next steps

Phase 02-Frontend-Scaffold will use these decisions. Do not change this file unless rerunning this playbook.
```

## Step 5 — Initialize SCAFFOLD_PROGRESS.md

At repo root, write (overwrite if exists):

```markdown
# Scaffold Progress — Live Status

**Started:** <timestamp>
**Last updated:** <timestamp>
**Phase:** 01-Preflight ✅ DONE
**Next:** 02-Frontend-Scaffold

---

## Summary

| Phase | Status | Tests | Docs | Notes |
|---|---|---|---|---|
| 01-Preflight | ✅ DONE | N/A | N/A | Decisions locked |
| 02-Frontend-Scaffold | ⏳ PENDING | — | — | Will start next |
| 03-Backend-Scaffold | ⏳ PENDING | — | — | After frontend |
| 04-Contract-Tests | ⏳ PENDING | — | — | Cross-layer validation |
| 05-Docs-Generation | ⏳ PENDING | — | — | Comprehensive guides |

---

## Decision snapshot

- Language: <JS/TS>
- Package manager: <pnpm/npm/yarn>
- MSAL: <now/TODO>
- Add-ons: <list or none>
- Reference: <used Y/N>

See [SCAFFOLD_DECISIONS.md](SCAFFOLD_DECISIONS.md) for full audit log.

---

## Memory checks

**Q: How do I resume if interrupted?**
A: All decisions are locked in `SCAFFOLD_DECISIONS.md`. Re-run any playbook and it will auto-detect progress.

**Q: How do I change a decision?**
A: Delete `SCAFFOLD_DECISIONS.md` and re-run 01-preflight.md (or edit it directly, but you're on your own for consistency).

**Q: What if frontend/ or backend/ exists?**
A: Conflict policy from SCAFFOLD_DECISIONS.md applies (abort/sibling-dir/merge).

---

## Blockers / issues

(None yet)
```

## Step 6 — Handoff

Print to user:

```
✅ Preflight complete. Decisions locked in SCAFFOLD_DECISIONS.md.

Next: Run playbook 02-Frontend-Scaffold to begin code generation.

> "Follow .junie/playbooks/02-frontend-scaffold.md"

This will:
- Generate frontend/ tree (components, composables, services)
- Write tests TDD-first (red → green per unit)
- Generate API documentation
- Update SCAFFOLD_PROGRESS.md

Estimated time: 10–15 minutes. Watch for test results.
```

---

## Guardrails

- **Never write decisions alone without preflight.** All scaffolding depends on A–I. No defaults without user confirmation.
- **Idempotency:** If restarting, detect prior `SCAFFOLD_DECISIONS.md` and offer to reuse or reset. Do not silently overwrite.
- **Git safety:** Warn if uncommitted changes exist and conflict policy isn't "abort".
- **No partial answers:** Block on all A–I. If the user says "just use defaults," still ask them to confirm.
