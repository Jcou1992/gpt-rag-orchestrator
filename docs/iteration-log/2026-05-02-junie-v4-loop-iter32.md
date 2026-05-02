# Junie Skill v4 — Iteration 32

**Date:** 2026-05-02
**Loop step:** post-iteration-32 (adversarial)

## Pre-iteration state

Round 32 adversarial verdict: **needs-attention**. Iteration 31's harness asserted ONE sentinel per fixture (e.g., `STUB-JWT` for auth-policy). Codex constructed a partial-removal bypass: a contributor can delete every other rule from the script while keeping the one rule the harness checks for, and the harness still passes. The narrow assertion lets multi-rule scripts silently shrink as long as the one signal-rule stays.

## Codex adversarial review — single finding

1. **[medium]** `tests/invariants/run-harness.mjs:31-49` — sentinel-per-fixture is too coarse. Auth-policy has ~14 forbidden classes; stack has ~12; the harness only checks one each. Future PRs can drop arbitrary subsets of rules while leaving the one sentinel rule intact, and CI passes. The auth/template regression class the harness was added to prevent can still merge silently.

## Brainstorming summary

- Two complementary fixes:
  - **Sentinel-list per case**: every forbidden rule that the fixture triggers gets its own sentinel substring; the harness asserts every sentinel appears in the output. Catches removal of any single rule whose unique substring vanishes from the violation report.
  - **Exact violation-count assertion**: parse the script's `FAIL — N violation(s)` line, compare against an `expectedViolations` constant baked into the case. Catches removal of any single rule whose unique substring overlaps with another (e.g., `MockMvc` substring is shared by `MockMvcRequestBuilders` rule's output).
- Sentinel substrings overlap: `MockMvc` is a prefix of `MockMvcRequestBuilders`. Removing the dedicated `MockMvc` rule still leaves the substring in `MockMvcRequestBuilders` output, so the sentinel check alone passes — but the count drops by 1 and the count check fires. The two checks together cover the gap.
- Required scripting work:
  1. Expand fixtures to include every forbidden pattern in each script's FORBIDDEN list. `bad-stack` gains imports + annotations covering all 12 stack rules; `bad-auth` adds the catch-substitute variants and the env-var rules.
  2. Standardize the R5 script's failure header to match the `FAIL — N violation(s)` shape the other two scripts use, so the harness can parse all three with one regex.
  3. Add `expectedViolations` per case + parse + compare in the harness body.
- Manual self-check: temporarily remove ONE rule (the dedicated `MockMvc` import rule) from `check-stack-invariant.mjs`, run the harness, observe FAIL with explicit "violation count mismatch" message. Restore and re-verify.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Expand `bad-stack` and `bad-auth` fixtures to trigger every entry in their respective FORBIDDEN/FORBIDDEN_REGEX lists | `tests/invariants/fixtures/bad-stack/servlet-import.md`, `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | All forbidden patterns represented; production scripts still clean |
| 2 | Standardize R5 failure header to `FAIL — N violation(s) in M files` | `scripts/check-r5-invariant.mjs` | Header matches the regex `/FAIL[^\n]*?(\d+)\s+violation\(s\)/` |
| 3 | Update harness with `expectedViolations` + sentinel array + dual-assertion logic | `tests/invariants/run-harness.mjs` | All 3 cases PASS; manual rule-removal test FAILS with count-mismatch message |

## Changes made

- **Fixture expansion.**
  - `bad-stack/servlet-import.md` rewritten with four Kotlin/Java code blocks covering every entry in the script's FORBIDDEN list: servlet security imports + `@EnableWebSecurity`, servlet JWT decoders, full servlet test stack (`MockMvc`, `@AutoConfigureMockMvc`, `MockMvcRequestBuilders`, `MockMvcResultMatchers`, plus the `AutoConfigureMockMvc` import), and both `jakarta.servlet` / `javax.servlet` imports. 13 violation lines total (one per token; `@AutoConfigureMockMvc` has both an import line AND an annotation usage line).
  - `bad-auth/dummy-token-fallback.md` extended with: existing `STUB-JWT` catch-substitute + four new variants (`'stub-...`, `"STUB-...`, `'auth-stub-...`, `"auth-stub-...`), narrative line containing `dummy JWT` + `dummy-token` + `mocked getToken` / `mocked \`getToken` / `mock getToken`, and the existing bash block listing all three obsolete env-var names. 16 violation lines total.
- **R5 header standardization.**
  - `scripts/check-r5-invariant.mjs` failure line: `R5 invariant: VIOLATIONS FOUND` → `R5 invariant: FAIL — ${count} violation(s) in ${fileCount} playbook file(s).` Same wording shape as the stack and auth-policy scripts. The harness now parses all three with one regex.
- **Harness dual-assertion logic.**
  - Each `case` gained `expectedViolations: <int>` (1 for R5, 13 for stack, 16 for auth-policy).
  - `case.sentinel` (single string) replaced with `case.sentinels` (array). The harness asserts EVERY sentinel substring appears at least once.
  - Per-case body now: (a) parse `FAIL — N violation(s)` from output; if no match, fail-with-message; (b) assert `actualViolations === expectedViolations`; mismatched counts fail with explicit "violation count mismatch" message including the diff and the first 30 lines of output; (c) assert every sentinel present.
  - Pass message updated to print both the count and the sentinel total: `(violations: 13/13; 11 sentinels present)`.
- **Iteration log preserves the manual self-check trace.**
  - Removed one rule from `check-stack-invariant.mjs` (`'import org.springframework.test.web.servlet.MockMvc'` entry). Harness ran: count dropped from 13 to 12 → FAIL with the new "violation count mismatch" message clearly attributing the failure to a removed rule.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS, 0 FAIL.
- Fixture coverage: stack fixture triggers 13 violations (matches expected); auth fixture triggers 16 (matches expected); R5 fixture triggers 1.
- Manual rule-removal trace (verified before commit): removed the `MockMvc` import rule from stack script's FORBIDDEN list; harness FAILED with `violation count mismatch. Expected: 13 / Got: 12`. Restored; harness PASS.
- The dual assertion catches both removal classes:
  - Removing a rule whose sentinel substring is unique → sentinel check fails.
  - Removing a rule whose sentinel substring overlaps with another (e.g., `MockMvc` ⊂ `MockMvcRequestBuilders`) → count check fails.

## Remaining gaps (anticipated for next adversarial round)

- `expectedViolations` is hand-maintained alongside the fixtures. Adding a new forbidden pattern requires updating the fixture, the script, and the harness count. A future iteration could derive the count automatically by parsing the FORBIDDEN list and the fixture together. Backlog candidate.
- The harness still assumes the violation-count regex shape `FAIL — N violation(s)`. A future invariant script that uses different phrasing would slip past parsing and fail the harness with "could not parse violation count". That's the desired direction (any drift in output shape fails closed) but if Codex flags it as fragility, factor a `formatViolationHeader(n, m)` helper into a shared module.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-32 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
