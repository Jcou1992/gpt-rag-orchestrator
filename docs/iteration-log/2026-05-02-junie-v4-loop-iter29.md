# Junie Skill v4 — Iteration 29

**Date:** 2026-05-02
**Loop step:** post-iteration-29 (adversarial)

## Pre-iteration state

Round 29 adversarial verdict: **needs-attention**. Iteration 28 closed the same-line anchor bypass for the line being scanned, but the allowlist *resolution* path (the backwards walk) still used the loose `ALLOW_ANCHOR_RE`. A mixed line like `<!-- auth-policy-allow:foo --> harmless prose` would now be scanned (good — it would FAIL if it contained a forbidden token), but if the NEXT line carried a forbidden token, the walk-back would find the mixed line, see it matches the anchor regex, and silently authorize the violation. Same drift class, different code path.

## Codex adversarial review — single finding

1. **[medium]** `scripts/check-auth-policy.mjs:147-153` — `isAllowed()` resolves allowlist via `prev.match(ALLOW_ANCHOR_RE)`, not via the strict standalone form. A non-standalone anchor on the previous non-blank line still authorizes a forbidden token on the current line. The fix is symmetric to round-28's per-line skip: require `STANDALONE_ANCHOR_RE.test(prev.trim())` for the previous line to be considered a valid anchor.

## Brainstorming summary

- The semantic the script wants: an anchor must be ENTIRELY an anchor — no leading/trailing text, no merged content. That holds at two distinct points: (a) the line being scanned (closed in round 28), (b) the previous-line lookup during allowlist resolution (still open).
- Single-call fix: in `isAllowed`, after walking past blank lines, run `STANDALONE_ANCHOR_RE.test(trimmed)` against the candidate previous line. If false, reject the allowlist entirely (return `false`, do NOT continue walking — a non-anchor non-blank line means there is no anchor for the current line). If true, then run `ALLOW_ANCHOR_RE.exec(trimmed)` to extract the id and check `ALLOWLIST`.
- Regression test: append three lines to a playbook — a mixed anchor line (anchor + suffix), a line with a forbidden token. The script should report TWO violations: the mixed anchor line (because the anchor id contains `dummy-token`) AND the next forbidden-token line (because the previous-line lookup rejects the mixed anchor).

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Tighten `isAllowed` to require standalone previous-line anchor | `scripts/check-auth-policy.mjs` | Mixed-anchor regression test produces 2 violations; clean run still passes |

## Changes made

- **`isAllowed` now requires a standalone anchor on the previous non-blank line.**
  - Walk-back loop unchanged in shape: skip blank lines, look at first non-blank.
  - New early-out: `if (!STANDALONE_ANCHOR_RE.test(trimmed)) return false;` — a non-blank line that is not an anchor (anything else, including a mixed anchor + text) means there is no anchor for the current line, period.
  - After the standalone check, `ALLOW_ANCHOR_RE.exec(trimmed)` extracts the id and the existing `ALLOWLIST` membership check fires.
  - Six-line comment block above the helper explicitly cites round-29 as the closed drift class so future contributors don't "simplify" the helper back.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 7 playbook files`).
- Manual regression test: appended a mixed-anchor line followed by a forbidden-token line:
  ```
  <!-- auth-policy-allow:pb02-step3-no-dummy-token --> some harmless suffix
  Generate a dummy-token auth.js fallback.
  ```
  Re-ran the script; result was `FAIL — 2 violation(s)`:
    - the mixed-anchor line itself (because the anchor id contains `dummy-token` AND the standalone-skip no longer matches — round-28 closed this for the same reason),
    - the forbidden-token line (because the previous-line lookup REJECTED the mixed anchor — round-29 close).
  Reverted both lines; script clean.

## Remaining gaps (anticipated for next adversarial round)

- The two failure paths now mirror each other (per-line skip + previous-line lookup both require `STANDALONE_ANCHOR_RE`). If a future iteration adds a third path that uses `ALLOW_ANCHOR_RE` more loosely (e.g., scanning ahead instead of backwards), the same drift class can recur. Backlog candidate: factor a single `findStandaloneAnchorAt(line)` helper that all three paths call so the strictness is inherited rather than re-derived.
- The walk-back stops at the first non-blank line. If a comment block ends with the anchor and is preceded by a comment block matching `ALLOW_ANCHOR_RE` loosely, the strict walk catches it correctly. But edge case: a `<!--` opening comment followed by `auth-policy-allow:foo` on a separate line followed by `-->` on yet another line would not match the single-line standalone form. That's intentional — multi-line comment-anchor stylings are not supported. Backlog if Codex flags it.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-29 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
