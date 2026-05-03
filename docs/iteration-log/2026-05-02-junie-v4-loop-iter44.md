# Junie Skill v4 — Iteration 44

**Date:** 2026-05-02
**Loop step:** post-iteration-44 (adversarial)

## Pre-iteration state

Round 44 verdict: **needs-attention** with one **high** finding. Iter-43 expanded the auth-policy scan to `.junie/guides/**/*.md` AFTER the v3 phrases were already removed from the guide. The forbidden-token list never gained matchers for the actual phrases — `localStorage-backed JWT`, `stub JWT in localStorage`, etc. A future contributor could re-introduce the same wording and CI would stay green.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:49-70` — forbidden-token list does not match the localStorage-backed JWT class that triggered round 43.

## Brainstorming summary

- Add explicit substring rules for the v3 phrases: `localStorage-backed JWT`, `stub JWT in localStorage`, `JWT in localStorage`, `token in localStorage`. Substring match is appropriate — these are full noun phrases unlikely to false-positive in legitimate prose (the playbooks/guides describe `sessionStorage` for the MSAL `cacheLocation`, not `localStorage`-with-JWT).
- Extend `bad-auth/dummy-token-fallback.md` with the four v3 phrasings the rule list now matches verbatim. Each fixture line triggers at least one rule; some lines hit multiple rules because phrases overlap (e.g., a line containing both "stub JWT in localStorage" AND "localStorage-backed JWT" matches twice).
- Bump harness `expectedViolations` from 37 to 43 (the new fixture content adds 6 violations across 4 lines). Add the 4 new rule labels as sentinels so removing any of the new rules silently is caught.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add 4 substring rules for localStorage-backed JWT phrases | `scripts/check-auth-policy.mjs` | Production scan still clean (the guides have no offending phrasing after iter-43) |
| 2 | Extend bad-auth fixture with the 4 phrasings | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers the corresponding rule |
| 3 | Harness counts + sentinels | `tests/invariants/run-harness.mjs` | 43/43 violations; 4 new sentinels |

## Changes made

- **4 new substring rules in `FORBIDDEN`.**
  - `localStorage-backed JWT` — catches "Auth fallback uses a localStorage-backed JWT when MSAL fails".
  - `stub JWT in localStorage` — catches "Frontend auth fallback (stub JWT in localStorage)".
  - `JWT in localStorage` — generic.
  - `token in localStorage` — generic alternative phrasing ("persist the token in localStorage").
  - Each rule's `why` cites R6a explicitly so a CI failure points contributors at the right invariant.
- **4 new fixture lines in `bad-auth`.**
  - Each is the v3 wording verbatim so a future regression hits it. Their phrasing overlap means some lines fire 2 rules; the harness count assertion verifies the total stays at 43.
- **Harness updates.**
  - `expectedViolations: 37 → 43` (delta of 6 = 4 new fixture lines, with 2 lines triggering 2 rules each because phrases overlap).
  - 4 new sentinels added: each new rule's full pattern string. Removing any of the 4 rules drops the corresponding sentinel from output and fails the harness.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 11 playbook files`).
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 43/43, 20 sentinels).
- Manual round-44 bypass exercise: temporarily appended `localStorage-backed JWT fallback` to `.junie/guides/REFACTORING_SUMMARY.md` → production scan flagged it. Reverted.

## Remaining gaps (anticipated for next adversarial round)

- The new rules are exact substrings; a paraphrase like "we keep the JWT in `localStorage`" with a code-formatted `localStorage` would not match (because of the backticks). Substring matching is line-content-aware but doesn't strip Markdown formatting. Backlog: add a Markdown-aware preprocessor.
- A contributor wanting to bypass could write "Storage-locally backed JWT" or "client-side persisted JWT" — but Codex didn't flag those as plausible drift. The current rules cover the actual round-43 wording verbatim, which is the explicit scope of the closure.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-44 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
