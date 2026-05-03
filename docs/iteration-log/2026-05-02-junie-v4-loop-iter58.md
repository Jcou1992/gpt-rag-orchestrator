# Junie Skill v4 — Iteration 58

**Date:** 2026-05-02
**Loop step:** post-iteration-58 (adversarial)

## Pre-iteration state

Round 58 verdict: **needs-attention** with one **high** finding. Iter-57's `\[[^\]]+\]` bracket pattern was flat — it stops at the first `]`. Nested computed expressions like `holder[keys[0]] = localStorage` end at the inner `]` and the outer `]` blocks the rest of the regex from matching.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:157` — flat bracket pattern misses one level of nesting. Codex (third time) recommends AST refactor over continued regex extension.

## Brainstorming summary

- Replace `\[[^\]]+\]` with `\[(?:[^\[\]]|\[[^\]]*\])+\]`. Matches a bracket whose content is either non-bracket chars OR a single nested `[...]`. Handles one level of nesting; two-or-more levels still bypass.
- 7 rounds in a row of regex-treadmill closes (51→58). Every iteration adds a JS variant. Codex has flagged the AST switch in rounds 53, 56, 58 — three consecutive.
- Iter 58 closes the immediate finding; the iter-58 doc names AST refactor as an explicit v4.1 backlog item, not a "maybe someday" candidate.
- 3 fixture lines covering one-level-nested bracket forms.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Property-assign bracket pattern handles one level of nesting | `scripts/check-auth-policy.mjs` | Nested bracket LHS flagged |
| 2 | Bad-auth fixture +3 lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 3 | Bump harness count 98 → 101 | `tests/invariants/run-harness.mjs` | 101/101 |

## Changes made

- **Property-assign bracket pattern** widened to `\[(?:[^\[\]]|\[[^\]]*\])+\]` (one-level balanced).
- **Bad-auth fixture +3 lines**: `holder[keys[0]] = localStorage`, `state[getKey(parts[0])] = window.localStorage`, `this[\`prefix-${parts[0]}\`] = globalThis.localStorage`.
- **Harness count 98 → 101.**

## Verification

- All three invariant scripts clean.
- Harness 3/3 PASS (auth-policy 101/101, 28 sentinels).

## Remaining gaps (anticipated for next adversarial round)

- **AST refactor is now overdue.** Three-level nesting (`holder[a[b[c]]]`) bypasses. The right fix is a small Acorn or Babel pass over fenced JS code blocks that traverses AssignmentExpression nodes whose RHS is a `MemberExpression` resolving to `localStorage` (with or without global qualifier), Identifier resolving to `localStorage`, or Property whose value is `localStorage`. Estimated effort: ~150 LOC + one npm dep.
- The auth-policy script has now grown to 12 localStorage-related rules. Maintainability is decreasing; AST is a one-rule replacement that's easier to audit.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-58 changes.
- If round 59 still finds a regex bypass: switch to AST (acorn-based) scanner instead of adding more regex levels.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
