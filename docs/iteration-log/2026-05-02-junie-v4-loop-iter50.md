# Junie Skill v4 — Iteration 50

**Date:** 2026-05-02
**Loop step:** post-iteration-50 (adversarial)

## Pre-iteration state

Round 50 verdict: **needs-attention** with one **high** finding. Iter-49's bracket-regex fix was correct but the underlying rule list was still too narrow:

- Method-call regex matched only `setItem|getItem|removeItem|clear|key|length`. Arbitrary dot-property writes like `localStorage.jwt = token` and `localStorage.access_token = result.accessToken` slipped past.
- Bracket regex required a quoted key (`['x']`). Dynamic-key writes like `localStorage[JWT_KEY] = token` slipped past.

R6a's actual scope is "no localStorage access at all", and the rules need to match that breadth.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:95-107` — both localStorage rules too narrow. Dynamic keys and dot-property writes bypass.

## Brainstorming summary

- **Method-call rule** broadened from a fixed method-name list to any property identifier: `\blocalStorage\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*`. Subsumes the prior method names + catches `localStorage.jwt`, `localStorage.access_token`. The DEBUG-flag allowlist exception still works because allowlist excerpt matching is the load-bearing precision filter — the rule label changed shape but the allowlist entry binds to the label name and the exact line excerpt.
- **Bracket rule** broadened from quoted-only to any-non-whitespace-token: `\blocalStorage\s*(?:\?\.\s*)?\[\s*\S`. Matches `localStorage[JWT_KEY]` plus the existing quoted-key forms.
- The broader rules MAY false-positive against legitimate uses (e.g. `localStorage.length` probe). The existing alias rule's `(?!\s*\??\s*\.\s*length)` exclusion only applies to alias-side; the api-call rule no longer has a length carve-out. If a future contributor needs `length`, they must allow-anchor it. Acceptable trade-off for the scope.
- Three new fixture lines covering each bypass.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Broaden `localStorage-api-call` to any dot-property | `scripts/check-auth-policy.mjs` | Production scan stays clean (DEBUG-flag allowlist still works; no other access in the playbooks/guides) |
| 2 | Broaden `localStorage-bracket-access` to any non-whitespace key | `scripts/check-auth-policy.mjs` | Dynamic-key writes flagged |
| 3 | Bad-auth fixture +3 lines covering bypass shapes | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 4 | Bump harness count 69 → 72 | `tests/invariants/run-harness.mjs` | 72/72 |

## Changes made

- **`localStorage-api-call` regex.**
  - Old: `\blocalStorage\s*\??\s*\.\s*(setItem|getItem|removeItem|clear|key|length)\b`.
  - New: `\blocalStorage\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*`.
  - `why` updated to mention "ANY localStorage property access (method, arbitrary dot-property, optional-chained)".
- **`localStorage-bracket-access` regex.**
  - Old: `\blocalStorage\s*(?:\?\.\s*)?\[\s*['"]`.
  - New: `\blocalStorage\s*(?:\?\.\s*)?\[\s*\S`.
  - `why` updated to mention "quoted, dynamic-key, or optional-chained".
- **Bad-auth fixture (+3 lines).**
  - `localStorage[JWT_KEY] = token` — dynamic-bracket-key write.
  - `localStorage.jwt = token` — arbitrary dot-property.
  - `window.localStorage.access_token = result.accessToken` — global-qualified dot-property.
- **Harness count 69 → 72.**

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 11 playbook files`).
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 72/72, 25 sentinels).
- Manual round-50 trace: each new fixture line was verified to flag exactly one rule. The pb05 DEBUG-flag allowlist still resolves because the excerpt-matching is binding.

## Remaining gaps (anticipated for next adversarial round)

- Computed property name with template literals (`localStorage[\`jwt-${user}\`]`) starts with a backtick which the `\S` matches; covered.
- Property assignment via square brackets without quotes/identifiers (e.g. `localStorage[0]` — numeric key) is unusual but matches `\[\s*\S` (the `0` is non-whitespace). Caught.
- Reading `localStorage` as a value (e.g. `if (localStorage)`) without subsequent access doesn't match either rule. That's intentional — read-only existence checks are not the bug class R6a targets.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-50 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
