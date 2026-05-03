# Junie Skill v4 — Iteration 55

**Date:** 2026-05-02
**Loop step:** post-iteration-55 (adversarial)

## Pre-iteration state

Round 55 verdict: **needs-attention** with one **medium** finding. Three new bypass shapes:

- `const holder = { ls: localStorage }; holder.ls.setItem('jwt', token);` — object-literal value.
- `holder.ls = localStorage; holder.ls.setItem(...)` — property assignment.
- `this.storage = localStorage; this.storage.setItem(...)` — class-field assignment.

The alias rule only matches `const|let|var <ident> = localStorage`; the destructure rules only match `{...} = localStorage`. None match the assignment-to-already-bound-property shapes.

## Codex adversarial review — single finding

1. **[medium]** `scripts/check-auth-policy.mjs:124-126` — alias rule misses object-literal values and property/class-field assignments.

## Brainstorming summary

- Two new rules:
  - `localStorage-object-literal-value`: `[{,]\s*[A-Za-z_$][\w$]*\s*:\s*(...)?localStorage\b`. Matches `{ ls: localStorage }` and `, ls: localStorage`.
  - `localStorage-property-assign`: `[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*=\s*(...)?localStorage\b`. Requires AT LEAST ONE dot in LHS to distinguish from the simple-ident alias rule (which already covers `const ls = localStorage`).
- Both tagged `multiline: true` for consistency.
- 5 fixture lines: 2 object-literal + 3 property-assign.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add object-literal + property-assign rules | `scripts/check-auth-policy.mjs` | Production scan stays clean |
| 2 | Bad-auth fixture +5 lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one of the new rules |
| 3 | Bump harness count 84 → 89; new sentinels | `tests/invariants/run-harness.mjs` | 89/89 |

## Changes made

- **Two new `FORBIDDEN_REGEX` rules** placed before `localStorage-global-destructure` so they're checked first in the multi-line scan.
- **Bad-auth fixture +5 lines** covering both object-literal and property-assign shapes (including `this.storage = localStorage`).
- **Harness count + 2 new sentinels.**

## Verification

- All three invariant scripts clean.
- Harness 3/3 PASS (auth-policy 89/89, 28 sentinels).
- Manual round-55 trace: `const ls = localStorage` (alias rule, single match) confirmed not double-counted by the new property-assign rule because the LHS has no dot.

## Remaining gaps (anticipated for next adversarial round)

- Computed property names: `const holder = { [keyName]: localStorage }`. The current object-literal rule requires `: localStorage` after a bare identifier, not after a `[...]` computed key. Backlog candidate.
- Tuple/array bindings: `const [a, b] = [localStorage, otherStuff]`. Backlog.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-55 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
