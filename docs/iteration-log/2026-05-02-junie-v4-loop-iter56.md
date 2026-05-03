# Junie Skill v4 — Iteration 56

**Date:** 2026-05-02
**Loop step:** post-iteration-56 (adversarial)

## Pre-iteration state

Round 56 verdict: **needs-attention** with one **high** finding. Iter-55's two new rules covered identifier object-literal keys (`{ ls: ... }`) and dot-access property-assigns (`holder.ls = ...`), but missed:

- Quoted-string keys: `{ 'ls': localStorage }`, `{ "ls": ... }`.
- Computed keys: `{ [key]: localStorage }`.
- Bracket property-assigns: `holder['ls'] = localStorage`, `this['storage'] = localStorage`.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:144-154` — alias rules cover only identifier keys / dot-access. Quoted/computed/bracket forms slip past.

## Brainstorming summary

- **Object-literal**: extend the key shape to accept identifier OR `'string'` OR `"string"` OR `[expr]`. Single regex character class at the alternation.
- **Property-assign**: extend each access step to accept `.ident` OR `['key']` OR `["key"]`. Use `(?:\.IDENT|\[QUOTED\])+` for one-or-more access steps.
- Codex (twice now) recommends "switch to AST". That's the right long-term move. Backlog as a v4.1 candidate; for round 56 keep extending the regex set since the surface is still narrow.
- 6 fixture lines: 3 object-literal variants + 3 property-assign bracket variants.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Extend object-literal regex to accept quoted-string + computed keys | `scripts/check-auth-policy.mjs` | New shapes flagged |
| 2 | Extend property-assign regex to accept `['key']` access steps | `scripts/check-auth-policy.mjs` | Bracket assigns flagged |
| 3 | Bad-auth fixture +6 lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 4 | Bump harness count 89 → 95 | `tests/invariants/run-harness.mjs` | 95/95 |

## Changes made

- **Object-literal regex** key alternation: `(?:[A-Za-z_$][\w$]*|'[^']*'|"[^"]*"|\[[^\]]*\])`.
- **Property-assign regex** access-step alternation: `(?:\.[A-Za-z_$][\w$]*|\[\s*['"][^'"]*['"]\s*\])`.
- **Bad-auth fixture +6 lines** covering all six new forms.
- **Harness count 89 → 95.**

## Verification

- All three invariant scripts clean.
- Harness 3/3 PASS (auth-policy 95/95, 28 sentinels).

## Remaining gaps (anticipated for next adversarial round)

- AST-based scanning is the only complete answer. Regex enumeration is a treadmill: round 51 (global destructure), 52 (multi-line), 53 (sibling rule multiline), 54 (`$` identifier), 55 (object-literal + property-assign), 56 (quoted/computed/bracket). Each round adds a JS variant. Backlog: replace the regex set with a small Babel/Acorn parser pass over fenced JS code blocks that flags any `localStorage` reference used as a value or member target.
- Template-literal computed keys `{ [\`prefix-${name}\`]: localStorage }` — `[expr]` matches because `[^]]*` is greedy enough. Verified.
- Spread / rest patterns `const { ...rest } = window` then `rest.localStorage` — exotic; not currently covered.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-56 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
