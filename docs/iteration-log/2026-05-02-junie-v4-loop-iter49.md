# Junie Skill v4 — Iteration 49

**Date:** 2026-05-02
**Loop step:** post-iteration-49 (adversarial)

## Pre-iteration state

Round 49 verdict: **needs-attention** with one **high** finding. Iter-48's optional-chaining tolerance was correct for `?.method()` and `?.identifier` but WRONG for bracket access. JS optional bracket syntax is `?.[expr]` (the dot between `?` and `[` is required); the iter-48 regex `\??\s*\[` matched `?[` (without the dot) and missed the actual JS form. The fixture line `localStorage?.['jwt'] = token` was silently uncaught while the harness count rose by exactly the number of OTHER round-48 lines, masking the miss.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:103` — bracket-access regex shape doesn't match JS optional bracket. `localStorage?.['jwt']` slips past.

## Brainstorming summary

- Replace `\??\s*\[` with `(?:\?\.\s*)?\[`. The non-capturing optional group matches the literal `?.` sequence (dot required by JS spec) plus optional whitespace. Bare `localStorage[` still matches because the entire group is optional.
- Codex also suggested adding a per-line presence assertion to the harness so each fixture line is verified to actually trigger a rule. That would have caught this exact bug. Backlog as a future harness hardening; for round 49 the count delta now correctly reflects the additional match.
- Verify count: pre-fix harness reported 68 with one fixture line silently missed; post-fix the count rises to 69. The +1 delta confirms the previously-uncaught line now flags.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Fix bracket-access regex shape: `\??\s*\[` → `(?:\?\.\s*)?\[` | `scripts/check-auth-policy.mjs` | `localStorage?.['jwt']` now matches |
| 2 | Bump harness count 68 → 69 | `tests/invariants/run-harness.mjs` | 69/69 |

## Changes made

- **`localStorage-bracket-access` regex shape corrected.**
  - Old: `\blocalStorage\s*\??\s*\[\s*['"]` (matched `localStorage?[` — non-existent JS shape).
  - New: `\blocalStorage\s*(?:\?\.\s*)?\[\s*['"]` (matches `localStorage[`, `localStorage?.[`, plus whitespace variants).
  - Comment block names round-49 closure and the JS spec reference.
- **Harness `expectedViolations` 68 → 69** to reflect the fixture line that previously slipped past now being correctly flagged.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 69/69, 25 sentinels).
- Manual round-49 trace: harness count delta of exactly 1 confirms the round-48 silent miss is now flagged. Removing the new regex shape (reverting to the iter-48 regex) drops the count to 68; harness fails with "violation count mismatch" pointing at the regression.

## Remaining gaps (anticipated for next adversarial round)

- The harness still asserts a total count, not per-fixture-line presence. A fixture line that silently fails to match any rule would only be caught if the count delta reveals it. Adding a `requiredMatches` array per fixture line would close this; backlog candidate ("harness self-test gap" finding from Codex).
- Optional-chaining-with-spaces `localStorage   ?.   ['jwt']` matches because the regex accepts `\s*` between elements. Verified via spec-compliant whitespace handling.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-49 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
