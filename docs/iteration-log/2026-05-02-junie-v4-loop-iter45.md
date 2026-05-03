# Junie Skill v4 — Iteration 45

**Date:** 2026-05-02
**Loop step:** post-iteration-45 (adversarial)

## Pre-iteration state

Round 45 verdict: **needs-attention** with one **high** finding. Iter-44's four substring rules matched the v3 PROSE wording but not the corresponding code patterns. A scaffold/code-block regression like `localStorage.setItem('jwt', token)` slipped past every rule.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:76-79` — phrase-only matches let `localStorage.setItem('access_token', ...)`, `localStorage.getItem('jwt')`, `localStorage['access_token']` regress with CI green.

## Brainstorming summary

- Two structural regex rules cover both API shapes:
  - `\blocalStorage\s*\.\s*(setItem|getItem|removeItem|clear|key|length)\b` — method-call form.
  - `\blocalStorage\s*\[\s*['"]` — bracket-access form (string-keyed).
- Both rules ban any `localStorage` API access in the scanned surface by default. This is a stricter posture than "ban only token-context access" — the playbook surface should not use `localStorage` at all in the auth/api boundary, and any legitimate non-token use needs an explicit allow-anchor (mirrors the `pb04-retry-noop-catch` allowlist pattern).
- Existing legitimate use: pb05 documents a browser-console DEBUG flag (`localStorage.setItem('DEBUG', 'rag:*')`). Add `pb05-debug-flag-localstorage` anchor immediately above the line and a corresponding ALLOWLIST entry.
- Fixture: 6 new code-level lines in `bad-auth/dummy-token-fallback.md` covering setItem (jwt + access_token), getItem, removeItem, bracket-access (assignment + read).
- Harness count: +6 from new fixture lines → 49.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add 2 structural regex rules to `FORBIDDEN_REGEX` | `scripts/check-auth-policy.mjs` | Method + bracket forms flagged; existing pb05 DEBUG line caught (then allowlisted) |
| 2 | Anchor + allowlist the legitimate pb05 DEBUG line | `.junie/playbooks/05-docs-generation.md`, `scripts/check-auth-policy.mjs` | Production scan clean |
| 3 | Extend bad-auth fixture with 6 new code-shape lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers exactly one rule |
| 4 | Bump harness count + sentinels | `tests/invariants/run-harness.mjs` | 49/49; 22 sentinels |

## Changes made

- **2 new structural regex rules in `FORBIDDEN_REGEX`.**
  - `localStorage-api-call` matches `localStorage.{setItem,getItem,removeItem,clear,key,length}`.
  - `localStorage-bracket-access` matches `localStorage['` or `localStorage["`.
  - Comment block names round-45 closure and explains the default-deny posture for the auth surface.
- **Allowlist for the legitimate pb05 DEBUG flag.**
  - Anchor `<!-- auth-policy-allow:pb05-debug-flag-localstorage -->` placed immediately above the existing `localStorage.setItem('DEBUG', 'rag:*')` line.
  - New ALLOWLIST entry: `'pb05-debug-flag-localstorage:localStorage-api-call'`.
- **Bad-auth fixture extension (6 lines).**
  - 4 method-call shapes: setItem(jwt), setItem(access_token), getItem(jwt), removeItem(access_token).
  - 2 bracket-access shapes: assignment + read.
  - Each line triggers exactly one rule (method or bracket); no overlap.
- **Harness updates.**
  - `expectedViolations: 43 → 49`.
  - Sentinels gain `localStorage-api-call` + `localStorage-bracket-access` so removing either rule fails the harness.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 11 playbook files`).
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 49/49, 22 sentinels).
- Manual round-45 bypass exercise: temporarily added `localStorage.setItem('jwt', x)` to a temp fixture → flagged by `localStorage-api-call`. Removed the rule → harness FAIL with count drop.

## Remaining gaps (anticipated for next adversarial round)

- The regex doesn't catch indirect access through aliasing: `const ls = localStorage; ls.setItem('jwt', x);`. Aliasing is a niche bypass — Codex hasn't flagged it; backlog candidate.
- `sessionStorage` is treated as benign (it's the documented hardened cache location for MSAL). If `sessionStorage` were ever used as a token store directly outside MSAL's wrapper, the invariant would not catch it. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-45 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
