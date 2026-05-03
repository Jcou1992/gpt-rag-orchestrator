# Junie Skill v4 — Iteration 60

**Date:** 2026-05-02
**Loop step:** post-iteration-60 (adversarial)

## Pre-iteration state

Round 60 verdict: **needs-attention** with one **high** finding. Iter-59 explicitly noted "3+ levels still bypass"; Codex confirmed `holder[keys[parts[indexes[0]]]] = localStorage` slips past. Codex (5th time, rounds 53/56/58/59/60) demanded the AST/scanner switch.

This iteration commits to the architectural shift: replace the property-assign regex with a balanced-bracket scanner that handles arbitrary depth.

## Codex adversarial review — single finding

1. **[high]** `scripts/check-auth-policy.mjs:151-160` — depth-bounded regex hits its ceiling. AST/scanner refactor required.

## Brainstorming summary

- **Approach**: write a small balanced-bracket scanner in plain JS (zero npm deps). For each `= localStorage` (with optional global qualifier), walk backwards from the `=` position counting `]` / `)` / `[` / `(` to determine LHS bounds. Skip bare-identifier LHS (alias rule covers it), skip `const|let|var` declarations, flag any LHS containing `.` or `[`.
- This handles ANY nesting depth because it counts brackets directly rather than encoding depth in the regex.
- Integrate via new `FORBIDDEN_SCANNERS` array. Each entry has `{ scan(text), label, why }`. The whole-file scan loop iterates scanners alongside multiline regex rules. Allowlist resolution shared (file + anchor + label + excerpt match).

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `FORBIDDEN_SCANNERS` array; implement `localStorage-property-assign` scanner with balanced-bracket walk | `scripts/check-auth-policy.mjs` | Existing fixture (1- and 2-level) still flagged at same count |
| 2 | Wire scanners into the multiline scan loop with allowlist resolution | `scripts/check-auth-policy.mjs` | `node scripts/check-auth-policy.mjs` clean |
| 3 | Remove `localStorage-property-assign` from `FORBIDDEN_REGEX` | `scripts/check-auth-policy.mjs` | No double-counting |
| 4 | Bad-auth fixture +3 lines covering 3-level / 4-level / arbitrary nesting | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Scanner catches each |
| 5 | Bump harness count 104 → 107 | `tests/invariants/run-harness.mjs` | 107/107 |

## Changes made

- **`FORBIDDEN_SCANNERS` array introduced** with one entry: `localStorage-property-assign`.
  - Scanner function: walks `\b(?:const|let|var)`-aware backwards from each `= localStorage` match, balancing brackets/parens, returning `{ index, lineNumber, lhs, full }` for any LHS that contains member access AND isn't a bare identifier AND isn't preceded by `const|let|var`.
  - Comment block names round-60 closure and explains why this can't be a regex.
- **Multiline scan loop** extended to iterate `FORBIDDEN_SCANNERS` after `FORBIDDEN_REGEX`. Same allowlist resolution.
- **`localStorage-property-assign` regex removed** from `FORBIDDEN_REGEX` (replaced by the scanner); comment block above documents the round-55→60 evolution.
- **Bad-auth fixture +3 lines** for 3-level (`indexes[0]`), 4-level (`lookup[0]`), and 5+-level (`a[b[c[d[0]]]]`) nesting.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 107/107, 28 sentinels).
- Manual round-60 trace: each new fixture line was verified to trigger the scanner. Scanner correctly skips legitimate cases (allowlist-anchored DEBUG flag still works; bare-identifier LHS like `const ls = localStorage` is left to the alias rule).

## Remaining gaps (anticipated for next adversarial round)

- Scanner skips boundary characters (`,`, `;`, `{`, `}`, `\n`) at top level, so multi-statement lines like `foo(); holder[x] = localStorage` correctly capture only the LHS after the `;`. Verified by inspection.
- Reflect / Function-constructor / eval still uncovered (out of regex/scanner scope). Codex hasn't pushed.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-60 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
