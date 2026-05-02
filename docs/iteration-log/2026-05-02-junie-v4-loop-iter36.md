# Junie Skill v4 — Iteration 36

**Date:** 2026-05-02
**Loop step:** post-iteration-36 (adversarial)

## Pre-iteration state

Round 36 adversarial verdict: **needs-attention** with one **high** finding. Iteration 35's function-expression catch regex anchored too tightly: it required `function` to appear immediately after the optional `async` keyword. Three real JS shapes slipped past:

- `.catch((function () { ... }))` — parenthesized function expression
- `.catch(/* fallback */ function () { ... })` — block comment between `(` and `function`
- `.catch(async /* fallback */ function () { ... })` — comment between `async` and `function`

Codex verified the live regex returned `false` for all three.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:100-104` — function-expression regex too narrow. Three real JS shapes bypass.

## Brainstorming summary

- The fix is to widen the gap between `.catch(` and `function` to tolerate any character set that does NOT close the paren or open a curly. `[^){}]*?` matches whitespace, `async`, comments, parenthesization, and combinations — but stops at `)` (would close the catch) or `{`/`}` (would suggest crossing into a function body or unrelated block).
- This regex is permissive in the gap but tight on the function-expression body shape (`\)\s*\{[\s\S]*?\}`). False-positive risk minimal because `.catch` followed by `function` in the same paren expression is always a substitute fallback in our scope.
- Fixture additions: three lines covering each variant. Counts: each fixture line triggers exactly one new violation (the regex matches once per `.catch( ... function ...)` even though the gap is permissive — `g` flag advances past the closing brace).

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Widen function-expression regex to `[^){}]*?` gap before `function` | `scripts/check-auth-policy.mjs` | Production scan still clean; new shapes flagged |
| 2 | Add 3 fixture lines (parenthesized, commented, async-commented) | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each triggers exactly one violation |
| 3 | Bump auth-policy `expectedViolations` 31 → 34 | `tests/invariants/run-harness.mjs` | Harness PASS |

## Changes made

- **`catch-fn-substitute` regex widened.**
  - Old: `\.catch\s*\(\s*(?:async\s+)?function\b[\s\S]*?\)\s*\{[\s\S]*?\}`.
  - New: `\.catch\s*\(\s*[^){}]*?\bfunction\b[\s\S]*?\)\s*\{[\s\S]*?\}`.
  - The `(?:async\s+)?` head was replaced with `[^){}]*?` which subsumes `async`, comments, and extra parens. The lazy quantifier still terminates at the first `function` keyword.
  - 14-line comment block above the rule enumerates every shape the regex now covers (whitespace, async, block comment, line comment, parenthesization, combinations) and explains the `[^){}]` exclusion list.
- **Bad-auth fixture extended with 3 lines:**
  - `.catch((function () { return makeDevToken(); }))` — parenthesized.
  - `.catch(/* fallback */ function () { return makeDevToken(); })` — block comment.
  - `.catch(async /* fallback */ function () { return makeDevToken(); })` — async + comment.
- **Harness count bumped 31 → 34.** Comment notes which round each delta came from for traceability.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 34/34).
- Manual round-36 bypass exercise: each of the three new shapes was tested in isolation against the production scan via a temp playbook copy; all three flagged. Reverted; clean.

## Remaining gaps (anticipated for next adversarial round)

- The widened gap `[^){}]*?` could theoretically match across an `if (...)` expression that happens to live inside `.catch()` — but Codex flagged neither this case nor any related false-positive risk. Adding such a pattern to the playbooks is also vanishingly rare given that `.catch` exists in the playbooks only inside the auth-stub / leak-test code paths.
- The regex still doesn't catch externally-defined function references like `.catch(handleAuthError)` — that's an AST-level analysis problem; Codex hasn't pushed on it because no PR could realistically introduce it without also defining `handleAuthError` in the same file (which would itself be flagged elsewhere or by review).
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-36 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
