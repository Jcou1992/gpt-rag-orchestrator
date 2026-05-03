# Junie Skill v4 — Iteration 61

**Date:** 2026-05-02
**Loop step:** post-iteration-61 (adversarial)

## Pre-iteration state

Round 61 verdict: **needs-attention** with one **high** finding. The iter-60 scanner only matched `=\s*localStorage` shapes. Trivial parenthesized RHS bypasses:

- `holder.tokenStore = (localStorage)`
- `holder.tokenStore = (window.localStorage)`
- `this.cache = ((globalThis.localStorage))`

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:251` — RHS regex doesn't accept optional parens around the qualified expression.

## Brainstorming summary

- Update `rhsRe` to `=\s*\(*\s*(?:(?:window|globalThis|self)\s*\??\s*\.\s*)?localStorage\b`. `\(*` accepts zero or more opening parens. We don't require matching `)` because the scanner uses the `=` position only for the LHS walk.
- 3 fixture lines covering single, qualified, and double-paren forms.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Scanner RHS regex accepts optional `(` before localStorage | `scripts/check-auth-policy.mjs` | Parenthesized RHS flagged |
| 2 | Bad-auth fixture +3 lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 3 | Bump harness count 107 → 110 | `tests/invariants/run-harness.mjs` | 110/110 |

## Changes made

- **Scanner RHS regex** widened from `=\s*localStorage\b` form to `=\s*\(*\s*localStorage\b`-style.
- **Bad-auth fixture +3 parenthesized lines.**
- **Harness count 107 → 110.**

## Verification

- All three invariant scripts clean.
- Harness 3/3 PASS (auth-policy 110/110, 28 sentinels).

## Remaining gaps (anticipated for next adversarial round)

- Scanner doesn't handle `holder.x = /* comment */ localStorage` if comment is between `=` and `localStorage`. Comments are stripped before the scanner runs, so this should already be covered. Verified by spec.
- Block expressions `holder.x = { return localStorage }` — invalid JS, skipped.
- Tagged templates / proxies / Reflect / eval still uncovered (out of scanner scope).
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-61 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
