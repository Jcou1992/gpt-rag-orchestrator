# Junie Skill v4 — Iteration 05

**Date:** 2026-05-02
**Loop step:** post-iteration-5

## Pre-iteration state

Codex round 5 grade: **needs-attention** ("No-ship") with 2 high findings — both about phase ordering between playbooks 03 and 04.

## Codex review — key findings (round 5)

1. **[high]** Phase ordering: playbook 03 Unit 9b emits `DevDoubleGateTest` and `OboValidationTest` that reference `com.example.rag.dev.MockOrchestratorClient`, but the mock class is generated in playbook 04 Step 3 — which runs AFTER playbook 03. Phase 03 fails to compile.
2. **[high]** Mock orchestrator template uses bare type names (`OrchestratorProperties`, `OrchestratorClient`, `UserContext`, `AskChunk`) without imports. After the realignment to `com.example.rag.dev`, the mock cannot resolve those types from sibling packages without explicit imports.

## Brainstorming summary

- Finding 1 — phase realignment:
  - Move `MockOrchestratorClient.kt` generation from playbook 04 Step 3 → playbook 03 Unit 9b Step F. This puts mock creation in the same phase as the tests that reference it.
  - Renumber existing Step F (Commit pattern) → G; existing Step G (Verification) → H.
  - Playbook 04 Step 3 narrative now says "the mock was generated in 03 Unit 9b — this step only sets up `application-mock.yml`."
- Finding 2 — explicit imports in mock template:
  - Add 5 explicit imports: `OrchestratorProperties` (config package), `OrchestratorClient` + `AskChunk` (service package), `UserContext` (web.dto), `DevOnlyBean` (config.annotations).
  - Add an "Import-resolution sanity check" paragraph instructing future maintainers to update import lines verbatim if a previous unit places types in a different package.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add Step F to playbook 03 Unit 9b emitting `MockOrchestratorClient.kt` with explicit imports | `.junie/playbooks/03-backend-scaffold.md` | Mock code block present in playbook 03 with `package com.example.rag.dev`; 5 explicit imports |
| 2 | Strip mock code block from playbook 04 Step 3; replace with cross-reference | `.junie/playbooks/04-contract-tests.md` | Zero `package com.example.rag.dev` declarations in playbook 04 |
| 3 | Renumber Steps G/H and update commit pattern (10 commits, mock generation FIRST) | `.junie/playbooks/03-backend-scaffold.md` | Step F < Step G < Step H ordering preserved |
| 4 | Add `MockOrchestratorClient.kt` to Files list under `src/main/kotlin/com/example/rag/dev/` | `.junie/playbooks/03-backend-scaffold.md` | File listed in Unit 9b Files |

## Changes made

- **`.junie/playbooks/03-backend-scaffold.md`:**
  - Inserted new **Step F — Generate MockOrchestratorClient.kt**. Code block carries:
    - `package com.example.rag.dev`
    - 5 explicit imports: `com.example.rag.config.OrchestratorProperties`, `com.example.rag.config.annotations.DevOnlyBean`, `com.example.rag.service.AskChunk`, `com.example.rag.service.OrchestratorClient`, `com.example.rag.web.dto.UserContext`. Plus standard Kotlin coroutines + `org.springframework.stereotype.Component`.
    - `@DevOnlyBean @Component` class-level annotations.
    - "Import-resolution sanity check" prose telling future maintainers to update import lines verbatim if package layouts shift in earlier units.
  - Renumbered: previous Step F (Commit pattern) → G; previous Step G (Verification) → H.
  - Commit pattern (Step G) expanded from 7 to 10 commits, with explicit ordering note that `MockOrchestratorClient` MUST land in commit 1 (before the gate tests in commits 3-6).
  - Added `MockOrchestratorClient.kt` to Unit 9b Files list under `src/main/kotlin/com/example/rag/dev/`.

- **`.junie/playbooks/04-contract-tests.md` Step 3:**
  - Removed the entire `MockOrchestratorClient.kt` code block.
  - Replaced with a 3-bullet narrative: (1) confirm mock was generated in 03 Unit 9b Step F, (2) generate `application-mock.yml`, (3) document the dev runner invocation.
  - Single-gate invariant prose preserved.
  - `application-mock.yml` block preserved verbatim.
  - "DevDoubleGateTest already includes MockOrchestratorClient in withUserConfiguration" note preserved (no changes needed in this phase).

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `MockOrchestratorClient.kt` declaration in playbook 03 → 1 (was 0).
- `package com.example.rag.dev` in playbook 04 → 0 (mock code block removed; only narrative refs remain).
- All 5 explicit imports present in mock template (1 each).
- Step F → Step G → Step H header ordering: lines 895 / 944 / 959 in playbook 03.
- `MockOrchestratorClient.kt` in Files list (count = 3 — Files entry + Step F filename comment + commit pattern reference).

## Remaining gaps (anticipated for next loop)

- The 5 import paths (`com.example.rag.{config,service,web.dto}`) are inferred from the playbook's earlier-unit prose. If earlier Units 4-7 actually place these types in different packages, the imports break. This is the same risk class Codex Finding 2 identified — accepted for this iteration with the explicit "update import lines verbatim" instruction. Next loop may surface this if Codex re-audits the earlier-unit package layout.
- `RagApplication.kt` itself is not generated by Unit 9b — it's assumed to exist from earlier units. If RagApplication is at a different package than `com.example.rag`, the SecurityBeansPresentTest's `@SpringBootTest` won't boot the right context. Documented but not catch-tested.
- Unit 7b (real-target Junie scaffold) still deferred. Same as prior iterations.

## Next loop actions

- Commit + push iteration-5 changes.
- Re-run Codex adversarial review.
- Compare grade. Target A+.
