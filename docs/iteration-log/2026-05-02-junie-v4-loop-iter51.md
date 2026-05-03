# Junie Skill v4 — Iteration 51

**Date:** 2026-05-02
**Loop step:** post-iteration-51 (adversarial)

## Pre-iteration state

Round 51 verdict: **needs-attention** with one **high** finding. Iter-50 broadened the localStorage rules to any property/bracket access, but Codex constructed yet another indirection: destructuring `localStorage` ITSELF out of a global object.

```js
const { localStorage: storage } = window;
storage.jwt = token;  // bypasses every regex anchored on `localStorage`
```

The destructured binding is named `storage`, so neither the api-call regex nor the bracket regex sees `localStorage`. The existing destructure regex matched `... = localStorage` (RHS is localStorage), but here the RHS is `window`.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:118-126` — destructuring `localStorage` out of a global object slips past every existing regex.

## Brainstorming summary

- New rule: `\b(?:const|let|var)\s*\{[^}]*\blocalStorage\b[^}]*\}\s*=\s*(?:window|globalThis|self)\b`. Matches a destructure block on the LHS containing the literal `localStorage` (with or without `: alias`), assigned from any of `window`/`globalThis`/`self`.
- Doesn't false-positive against benign `const { setItem } = window.localStorage` (round-46) because in that shape the RHS is `window.localStorage` not just `window`. The new rule's RHS anchor is `(window|globalThis|self)\b` (word boundary stops at `.`).
- 3 fixture lines: `const { localStorage: storage1 } = window`, `const { localStorage } = globalThis`, `let { localStorage: ls3 } = self`.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `localStorage-global-destructure` regex | `scripts/check-auth-policy.mjs` | Production scan stays clean |
| 2 | Bad-auth fixture +3 lines covering global-destructure shapes | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 3 | Bump harness count 72 → 75; new sentinel `localStorage-global-destructure` | `tests/invariants/run-harness.mjs` | 75/75 |

## Changes made

- **New `localStorage-global-destructure` rule** in `FORBIDDEN_REGEX`. Comment block names round-51 closure and explicitly cites the bypass shape it catches.
- **Bad-auth fixture extension** with three global-destructure variants (window/globalThis/self).
- **Harness count + sentinel update**.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 75/75, 26 sentinels).
- Manual round-51 trace: each new fixture line was verified to flag the new rule. Existing destructure rule still fires for `const { setItem } = window.localStorage` shape (RHS = `window.localStorage`).

## Remaining gaps (anticipated for next adversarial round)

- Indirect via `Reflect.get(window, 'localStorage')` or `Object.getOwnPropertyDescriptor(window, 'localStorage').value` is exotic; Codex hasn't pushed.
- Property-spread `const merged = { ...window }` then `merged.localStorage.setItem(...)` would bypass — `merged.localStorage.setItem` matches the api-call regex (`\blocalStorage\.setItem`) at the call site. So that's actually caught.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-51 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
