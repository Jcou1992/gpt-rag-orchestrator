# Junie Skill v4 — Iteration 09

**Date:** 2026-05-02
**Loop step:** post-iteration-9

## Pre-iteration state

Codex round 9 grade: **B** (target: A+).

## Codex review — key findings (round 9)

1. **[high]** `DevDoubleGateTest.kt` at `.junie/playbooks/03-backend-scaffold.md:293-315, 377-428` — positive registration test (`dev-double beans DO register when app dev-doubles enabled is true`) registers `MockOrchestratorClient::class.java` via `withUserConfiguration(...)` but `MockOrchestratorClient` constructor-injects `OrchestratorProperties` (line 313-315). `ApplicationContextRunner` does NOT auto-register `@ConfigurationProperties` beans, so the test slice fails to start with an unsatisfied dependency rather than proving the gate works — vacuous-pass for the wrong reason.
2. **[medium]** `.junie/playbooks/04-contract-tests.md:19, 24, 32-33` — playbook explicitly claims Windows portability (line 19 explains avoiding `cp`) but retains POSIX-only `mkdir -p` (L24) and `test -s` (L32-33). Direct contradiction.
3. **[low]** `.junie/playbooks/04-contract-tests.md:133` — Step 3 references `MockOrchestratorClient` as "generated in playbook 03 Unit 9b Step F". Actually generated in Step C (03-backend-scaffold.md:253). Stale cross-ref.

Round-8 findings confirmed CLOSED by Codex:
- AssertJ assertion parens — closed (witnessed at L391-397, L409-417, L676-683, L689-696).
- `@Bean`-method scan in `DevDoubleClasspathScanTest` — closed (L557-590).

## Brainstorming summary

- Finding 1 — `ApplicationContextRunner` only loads explicitly listed `@Configuration` classes; it does not enable `@ConfigurationProperties` binding. Cleanest fix: emit a tiny `@TestConfiguration` class carrying `@EnableConfigurationProperties(OrchestratorProperties::class)` and register it in `withUserConfiguration(...)` ahead of `MockOrchestratorClient`. Pair with `withPropertyValues(...)` so the binding actually receives values. Document the prefix-key alignment requirement so a Unit-4 rename never silently drops the test back into vacuous-pass.
- Finding 2 — replace `mkdir -p` with `node -e "fs.mkdirSync(..., {recursive:true})"` and `test -s` with `node -e "if(!fs.statSync(...).size) process.exit(1)"`. Both work on cmd.exe, PowerShell, and POSIX shells. Update the narrative to note this is the cross-shell pattern, not a workaround.
- Finding 3 — flip `Step F` → `Step C` for the MockOrchestratorClient cross-ref, and update the `DevDoubleGateTest` cross-ref in the same paragraph from "Step C" → "Step D" (which is the test's actual location now, per the playbook's TOC at L332).

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Make `DevDoubleGateTest` Spring slice satisfy the `OrchestratorProperties` ctor dep without booting a full context | `.junie/playbooks/03-backend-scaffold.md` | New `@TestConfiguration` + `@EnableConfigurationProperties` class; `withPropertyValues` lists `orchestrator.url` + `orchestrator.api-key` |
| 2 | Replace POSIX `mkdir -p` / `test -s` with cross-shell Node equivalents | `.junie/playbooks/04-contract-tests.md` | grep `mkdir -p` / `test -s` returns 0 inside fenced bash blocks |
| 3 | Fix stale cross-refs in playbook 04 Step 3 | `.junie/playbooks/04-contract-tests.md` | Step refs match playbook 03 reality (`Step C` for MockOrchestratorClient, `Step D` for DevDoubleGateTest) |

## Changes made

- **`DevDoubleGateTest` slice now wires `OrchestratorProperties`** —
  - Added imports: `OrchestratorProperties`, `EnableConfigurationProperties`, `TestConfiguration`.
  - New nested `class TestPropsConfig` annotated with `@TestConfiguration` + `@EnableConfigurationProperties(OrchestratorProperties::class)`. Comment block above it explains *why* it exists (vacuous-pass risk) and the alignment requirement with Unit-4 prefix keys.
  - `contextRunner` now calls `withPropertyValues("orchestrator.url=http://localhost:0/orchestrator", "orchestrator.api-key=devdouble-gate-test-stub")` and adds `TestPropsConfig::class.java` to `withUserConfiguration(...)` ahead of `MockOrchestratorClient`.
  - Negative assertions are unaffected: `matchIfMissing = false` keeps `MockOrchestratorClient` un-registered when `app.dev-doubles.enabled` is unset, so the constructor never runs and the dep is never resolved on the negative path. Positive path resolves the dep cleanly.
- **Cross-shell Node copy commands** —
  - Replaced `mkdir -p contract-tests/schemas contract-tests/fixtures` with one `node -e` line invoking `fs.mkdirSync(..., {recursive:true})` for each subdir.
  - Replaced `test -s ... && echo` lines with `node -e "const s=require('fs').statSync(...); if(!s.size) process.exit(1); console.log(...);"`. Same exit-code semantics on Windows + POSIX. Lead-in narrative updated to surface the constraint explicitly.
- **Cross-references in playbook 04 Step 3** —
  - "playbook 03 Unit 9b Step F" → "playbook 03 Unit 9b Step C" (where `MockOrchestratorClient` is actually generated).
  - "playbook 03 Unit 9b Step C" → "playbook 03 Unit 9b Step D" inside the single-gate-invariant block (where `DevDoubleGateTest` actually lives).

## Verification

- `node scripts/check-r5-invariant.mjs` → `R5 invariant: clean (0 violations across 7 playbook files).`
- `node scripts/check-stack-invariant.mjs` → `Stack invariant: clean (0 violations across 7 playbook files). Locked stack: Vue 3 + Vite 5+ + Kotlin + Spring Boot WebFlux. No servlet imports allowed.`
- `grep -E '\.(isNotEmpty|isEmpty|isTrue|isFalse|isOk|isUnauthorized|isForbidden)$' .junie/playbooks/03-backend-scaffold.md` → 0 matches (round-8 fix preserved).
- `grep -nE 'mkdir -p|test -s' .junie/playbooks/04-contract-tests.md` → only narrative mentions remain (lines 21, 29) — both explicitly note the absence; zero occurrences inside fenced ` ```bash ` blocks.
- New imports present in `DevDoubleGateTest`: `OrchestratorProperties`, `EnableConfigurationProperties`, `TestConfiguration`.
- New `TestPropsConfig` nested class present.
- `withPropertyValues` carrying both `orchestrator.url` and `orchestrator.api-key` present in the contextRunner builder chain.
- Step cross-refs updated: 1× `Step F` → `Step C`, 1× `Step C` → `Step D` inside the single-gate-invariant paragraph.

## Remaining gaps (anticipated for next loop)

- `withPropertyValues` keys are hardcoded to `orchestrator.url` / `orchestrator.api-key`. If Unit 4 ever renames the prefix or fields, the test silently slips back into bind-failure mode. Mitigation: explicit comment in the playbook tells the scaffolder to mirror Unit-4 keys verbatim. A stronger guard would require static analysis of Unit 4's `@ConfigurationProperties` declaration — out of scope for this iteration.
- Nested `class TestPropsConfig` is non-`private` (Kotlin default visibility = public) so Spring's `register(Class)` can reflect on it. Keeping it `internal class` would also work but reads less idiomatically; deliberately left as `class`.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-9 changes.
- Re-run Codex adversarial review (round 10).
- Compare grade. Target A+.
