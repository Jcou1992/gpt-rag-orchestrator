# Junie Skill v4 — Iteration 57

**Date:** 2026-05-02
**Loop step:** post-iteration-57 (adversarial)

## Pre-iteration state

Round 57 verdict: **needs-attention** with one **high** finding. Iter-56's bracket access step required a quoted string key (`['key']`). Computed identifier keys slipped past:

- `holder[keyName] = localStorage`
- `this[storageKey] = window.localStorage`
- `state[\`prefix-${suffix}\`] = globalThis.localStorage`

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:157` — bracket-step regex requires quoted string; computed key bypass.

## Brainstorming summary

- Replace `\[\s*['"][^'"]*['"]\s*\]` with `\[[^\]]+\]`. Matches any bracket containing at least one non-`]` character — quoted strings, identifiers, template literals, expressions. Same shape used by the object-literal computed-key alternation in round 56, applied to property-assign LHS.
- 3 fixture lines covering bare-identifier key, identifier-from-this, and template-literal key.
- This is the 5th localStorage-related round (iter 51-57). Codex has now flagged the regex-treadmill twice. Adding regex variants is increasingly diminishing-return; the AST refactor is overdue.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Property-assign bracket step accepts any computed expression | `scripts/check-auth-policy.mjs` | Computed-bracket LHS flagged |
| 2 | Bad-auth fixture +3 lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 3 | Bump harness count 95 → 98 | `tests/invariants/run-harness.mjs` | 98/98 |

## Changes made

- **Property-assign bracket-step alternation** widened from `\[\s*['"][^'"]*['"]\s*\]` to `\[[^\]]+\]`.
- **Bad-auth fixture +3 lines** (identifier key, this-bracket-identifier, template-literal key).
- **Harness count 95 → 98.**

## Verification

- All three invariant scripts clean.
- Harness 3/3 PASS (auth-policy 98/98, 28 sentinels).

## Remaining gaps (anticipated for next adversarial round)

- AST-based scanner is the only complete answer. The regex set has now grown to 12 localStorage-related rules across 7 rounds, each closing a JS variant. Recommend pivoting to an AST scanner (Acorn or Babel) that traverses fenced JS code blocks and flags any `localStorage` reference used as a value, member target, or destructure source. Backlog for v4.1.
- Spread/rest patterns, Proxy traps, eval-based access still uncovered. Out of scope for regex.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-57 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
