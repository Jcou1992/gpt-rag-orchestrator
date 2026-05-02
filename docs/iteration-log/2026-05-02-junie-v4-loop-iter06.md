# Junie Skill v4 — Iteration 06

**Date:** 2026-05-02
**Loop step:** post-iteration-6

## Pre-iteration state

Codex round 6 grade: **needs-attention** ("No-ship") with 1 high + 1 medium finding.

## Codex review — key findings (round 6)

1. **[high]** Step ordering inside Unit 9b: Step F generates `MockOrchestratorClient.kt`, but Step C (DevDoubleGateTest) and Step E (OboValidationTest) reference the mock by import. A reader executing the playbook sequentially creates phase-03 tests before the mock class exists — same compile-time ordering bug iteration 5 claimed to fix at the playbook-to-playbook level but not at the step-to-step level.
2. **[medium]** `MockOrchestratorClient` import for `AskChunk`: Step F imports `com.example.rag.service.AskChunk`, but the playbook's package tree (line 58) and Unit 1 file list (line 107) place `AskChunk.kt` under `web/dto`. Mock fails to compile from these instructions even though the import is explicit.

## Brainstorming summary

- Finding 1 — relocate the mock-generation block earlier in Unit 9b. Since execution order is by step-letter, moving the content from Step F to a new Step C (before all tests) puts the mock on the classpath before any test references it.
- Finding 2 — fix the `AskChunk` import path: `service.AskChunk` → `web.dto.AskChunk`. Add an inline note to "Import-resolution sanity check" that imports must match the package tree shown earlier in this playbook.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Move mock generation block from Step F → new Step C | `.junie/playbooks/03-backend-scaffold.md` | Step letters re-flow A→B→C(mock)→D(gate test)→E(SecurityConfig)→F(OBO test)→G(commits)→H(verification) |
| 2 | Fix `AskChunk` import path | `.junie/playbooks/03-backend-scaffold.md` | Zero `service.AskChunk` imports; one `web.dto.AskChunk` import |
| 3 | Update commit pattern (Step G) to match new order, add per-commit step-letter annotations | `.junie/playbooks/03-backend-scaffold.md` | Mock commit (#3) listed BEFORE any test commit |
| 4 | Update narrative cross-refs ("DevDoubleGateTest (Step C)" → "(Step D)") | `.junie/playbooks/03-backend-scaffold.md` | No stale step-letter references in prose |

## Changes made

- **`.junie/playbooks/03-backend-scaffold.md`:**
  - Deleted old Step F (MockOrchestratorClient generation) block.
  - Inserted the same content as a new **Step C — Generate `MockOrchestratorClient.kt` (must land BEFORE the gate tests below)**, positioned immediately before the existing gate-test step.
  - Renumbered: old C → D (Two-layer dev-double gate test), old D → E (OBO JWT validation in SecurityConfig), old E → F (JwtTestKit + OboValidationTest).
  - Steps G (commits) and H (verification) unchanged.
  - **Fixed `AskChunk` import** in the mock template: `com.example.rag.service.AskChunk` → `com.example.rag.web.dto.AskChunk`. Annotated the import line with "(DTO, Unit 1 file list line 107)" so the source of truth is visible.
  - Strengthened the **Import-resolution sanity check** prose to call out that import paths MUST match the package tree at the top of the playbook, not just be "explicit."
  - Updated narrative cross-references — `DevDoubleGateTest (Step C)` → `Step D`, `SecurityBeansPresentTest (Step C)` → `Step D` — in two prose paragraphs (lines 154 and 176).
  - Rewrote **Step G commit pattern** to align with the new step order: 12 commits with per-commit step-letter annotations. Mock orchestrator generation is commit #3 (immediately after meta-annotation + properties, BEFORE all tests). Also added per-commit `(Step X)` annotations so the commit-to-step mapping is unambiguous.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- Step header order: A (170) → B (231) → C [mock] (252) → D [gate test] (301) → E [SecurityConfig] (636) → F [OBO test] (711) → G [commits] (944) → H [verification] (961). Mock comes before any test.
- AskChunk import: 1 occurrence at `com.example.rag.web.dto.AskChunk`; zero occurrences at `service.AskChunk`.
- No stale "(Step C)" references for tests that now live in Step D.

## Remaining gaps (anticipated for next loop)

- Mock template still references `OrchestratorProperties` constructor argument with `val properties: ...`. Codex did not flag this but if `OrchestratorProperties` has required init args, the mock's primary-constructor `(val properties: OrchestratorProperties)` may fail to autowire if the test slice doesn't include `OrchestratorProperties`. Latent risk; Codex didn't flag yet.
- The "Unit 7 output" / "Unit 5/6 output" annotations in import comments are based on inferred earlier-unit content. If the actual earlier units place types differently, those comments mislead. Acceptable for v4; Codex round 7 will surface if so.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-6 changes.
- Re-run Codex adversarial review.
- Compare grade. Target A+.
