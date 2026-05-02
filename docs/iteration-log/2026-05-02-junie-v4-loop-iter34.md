# Junie Skill v4 — Iteration 34

**Date:** 2026-05-02
**Loop step:** post-iteration-34 (adversarial)

## Pre-iteration state

Round 34 adversarial verdict: **needs-attention**. Two new mediums — both real bypass classes that the iteration-33 hardening did not anticipate:

1. Auth-policy structural catch-substitute regex was line-scoped and didn't accept `async` arrow heads. `.catch(async () => makeDevToken())` and a multi-line `.catch(\n  () => fallback\n)` both slipped past.
2. Stack invariant's FQN regex rules covered concrete class names but not wildcard package imports. `import org.springframework.security.config.annotation.web.builders.*` followed by simple-type usage of `HttpSecurity` re-introduces the servlet stack without ever emitting any of the FQNs the script matches.

## Codex adversarial review — findings

1. **[medium]** `scripts/check-auth-policy.mjs:89` — line-scoped regex misses `async` arrow heads and multi-line catch bodies.
2. **[medium]** `scripts/check-stack-invariant.mjs:39-59` — concrete-FQN-only rules permit wildcard imports of every banned servlet package.

## Brainstorming summary

- For (1): the regex must (a) accept `async\s+` before the arrow head, (b) match across newlines (use `[\s\S]`), and (c) be applied to the file content as one string rather than per-line. Easiest implementation: tag the rule with `multiline: true` and run it through a separate scan path that operates on the whole file.
- For (2): add ten new FORBIDDEN regex entries — one per banned package — each ending in `\.\*`. They co-exist with the FQN rules; a wildcard import line matches the wildcard rule (and, for `jakarta.servlet.*`/`javax.servlet.*`, also the existing `\bjakarta.servlet\b` rule because the prefix is a substring of the wildcard).
- Multi-line scan path needs allowlist support for the same anchor protocol the line-scoped path uses. Walk backwards from the line of the match (derived by counting `\n` up to `match.index`) over blank lines, expect a STANDALONE anchor, check `ALLOWLIST.has(anchorId:label)`. Mirrors the line-scoped helper.
- Counts:
  - Stack expected: 15 (round-33) + 12 (10 wildcard lines, of which 2 double-match the existing `\bjakarta.servlet\b` / `\bjavax.servlet\b` rules) = 27.
  - Auth-policy expected: 25 (round-33) + 3 new fixture lines (`async () => makeDevToken()`, multi-line `() => fallbackToken`, multi-line `async (err) => retryWithDev(err)`) = 28.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add 10 wildcard-import regex rules to stack FORBIDDEN | `scripts/check-stack-invariant.mjs` | Production clean; harness still PASS |
| 2 | Add `async` + `[\s\S]` support to catch-substitute regex via `multiline: true` flag | `scripts/check-auth-policy.mjs` | Multiline regex applied to whole-file text; line-scoped path skips multiline rules |
| 3 | New whole-file scan path in `check-auth-policy.mjs` with anchor-resolved allowlist | `scripts/check-auth-policy.mjs` | Multi-line `.catch(\n  () => x\n)` is caught; legitimate prose mentions still allow-listable |
| 4 | Extend `bad-stack` and `bad-auth` fixtures | `tests/invariants/fixtures/bad-stack/servlet-import.md`, `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | New fixture lines exercise async + multi-line catch + wildcard imports |
| 5 | Update harness `expectedViolations` and rationale comments | `tests/invariants/run-harness.mjs` | All 3 cases PASS at new counts |

## Changes made

- **Stack wildcard-import rules.**
  - 10 new entries appended to `FORBIDDEN`, one per banned package: `org.springframework.security.config.annotation.web.builders.*`, `org.springframework.security.web.*`, `org.springframework.security.config.annotation.web.configuration.*`, `org.springframework.security.oauth2.jwt.*`, `org.springframework.test.web.servlet.*`, `org.springframework.test.web.servlet.request.*`, `org.springframework.test.web.servlet.result.*`, `org.springframework.boot.test.autoconfigure.web.servlet.*`, `jakarta.servlet.*`, `javax.servlet.*`.
  - Comment block above the section names round-34 as the closed bypass class.
- **Auth-policy multiline catch-substitute.**
  - The structural regex tagged `multiline: true`, accepts `(?:async\s+)?` before the arrow head, uses `[\s\S]` so newlines match, has the `g` flag so `exec` can iterate.
  - `scanFile` body extended with a dedicated multiline scan loop after the per-line loop. It iterates `regex.exec(text)` against the whole file content; for each match, derives the line number from `text.slice(0, match.index).split('\n').length` and runs the same backwards-walk allowlist resolution (with the same STANDALONE anchor strictness from round 29).
  - Per-line loop now skips rules tagged `multiline: true`.
- **Fixtures.**
  - `bad-stack/servlet-import.md` gains a new Kotlin block with all 10 wildcard imports plus a `class BadWildcardConsumer` to anchor them.
  - `bad-auth/dummy-token-fallback.md` gains 3 new `.catch(... =>)` lines: `async () => makeDevToken()`, `.catch(\n  () => fallbackToken,\n)`, `.catch(async (err) =>\n  retryWithDev(err),\n)`.
- **Harness.**
  - `expectedViolations`: stack 15 → 27, auth-policy 25 → 28. Comments enumerate the breakdown so a future contributor adding a fixture line knows exactly which rule(s) fire and how the count splits.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (R5 1/1; stack 27/27; auth-policy 28/28).
- Manual round-34 bypass exercise:
  - `import org.springframework.security.config.annotation.web.builders.*` followed by simple `class C { fun f(http: HttpSecurity) {} }` flagged by the wildcard rule. Reverted.
  - Multi-line `.catch(\n  () => fallback\n)` in a JS code block flagged by the multi-line scan. Reverted.
  - `.catch(async () => fallback)` in a JS block flagged by the regex (now accepts `async\s+` prefix). Reverted.

## Remaining gaps (anticipated for next adversarial round)

- Wildcard imports that reach servlet types via re-export packages (e.g., a hypothetical `org.springframework.security.web.server.*` mistakenly thought to be servlet but actually reactive — false positive risk in the opposite direction). Mitigation: rules are scoped to known servlet packages; reactive packages are not in the list. Backlog if a rename lands in Spring 7+.
- The multi-line catch regex is greedy across `[\s\S]*?`. A `.catch(...) => /* comment with ) */ value)` could confuse the lazy-match boundary. Edge case; backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-34 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
