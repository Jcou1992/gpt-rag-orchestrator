# Junie Skill v4 — Iteration 35

**Date:** 2026-05-02
**Loop step:** post-iteration-35 (adversarial)

## Pre-iteration state

Round 35 adversarial verdict: **needs-attention** with one **high** finding. Iteration 34's structural regex caught arrow-function `.catch(... => ...)` shapes (including async + multi-line), but missed function-expression catch handlers (`.catch(function () { return makeDevToken(); })`). This is a routine JS shape; a generated template using it bypasses the auth-policy invariant entirely.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:91` — arrow-only structural regex misses `.catch(function () { return X; })`, `.catch(function (err) { return X; })`, `.catch(async function () { return X; })`. Codex verified the regex returns false for these shapes against the live script.

## Brainstorming summary

- Adding a second multiline regex specifically for function expressions is the right shape: arrow-handler regex stays as-is; new regex matches `.catch(... function ...) { ... }`. Both fire alongside each other; same allowlist semantics.
- The function-expression regex should match: `(async)? function (name)? (args) { body }`. Body content doesn't matter — any function handler is a substitute fallback in spirit and must be allow-listed if legitimate.
- New rule label: `catch-fn-substitute` (mirrors the existing `catch-and-substitute` label so the harness sentinel list adds one entry, not two coupling).

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add second multiline `FORBIDDEN_REGEX` entry for function-expression catch handlers | `scripts/check-auth-policy.mjs` | Production scan still clean; multiline scan path picks up the new rule via the `multiline: true` flag |
| 2 | Extend bad-auth fixture with three function-expression catch lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Three new violations, each from the new rule; existing rules unaffected |
| 3 | Update harness `expectedViolations` and add `catch-fn-substitute` sentinel | `tests/invariants/run-harness.mjs` | All 3 cases PASS |

## Changes made

- **New `catch-fn-substitute` rule.**
  - Regex `/\.catch\s*\(\s*(?:async\s+)?function\b[\s\S]*?\)\s*\{[\s\S]*?\}/g`. Matches every `.catch(function ...)` and `.catch(async function ...)` shape regardless of body.
  - Tagged `multiline: true` so the same whole-file scan path round-34 added handles it. Same allowlist semantics.
  - Comment names round-35 as the closed bypass class. Future contributors with a legitimate function-expression catch must add an explicit allow-anchor.
- **Bad-auth fixture extension.**
  - Three new lines: `.catch(function () { return makeDevToken(); })`, `.catch(function (err) { return fallbackTokenFor(err); })`, `.catch(async function () { return makeDevToken(); })`. Each is one line, each triggers exactly one `catch-fn-substitute` violation.
- **Harness counts + sentinels.**
  - `expectedViolations` for auth-policy: 28 → 31 (+3 function-expression lines, no rule overlap with the arrow regex so each is single-counted).
  - `sentinels` gains `'catch-fn-substitute'` so the new rule's emission is explicitly asserted.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy now 31/31, stack 27/27, R5 1/1).
- Manual round-35 bypass exercise: appended `.catch(function () { return 'BAD'; })` to a temp playbook; production scan flagged it (`catch-fn-substitute` regex match). Reverted; clean.

## Remaining gaps (anticipated for next adversarial round)

- A `.catch` callback that takes an externally-defined function (not an arrow, not an inline function expression) — e.g., `.catch(handleAuthError)` where `handleAuthError` returns a fallback token — still slips past both regexes. Requires AST-level knowledge of what `handleAuthError` returns; out of scope for a regex-based scanner. Backlog candidate.
- Generator function catch handlers (`.catch(function * () { yield X; })`) are uncommon but technically would slip past the current `\bfunction\s*` start anchor; the regex matches `function*` because `\b` is between `function` (word) and `*` (non-word). Backlog candidate if it surfaces.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-35 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
