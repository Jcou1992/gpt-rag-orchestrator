# Junie Skill v4 — Iteration 46

**Date:** 2026-05-02
**Loop step:** post-iteration-46 (adversarial)

## Pre-iteration state

Round 46 verdict: **needs-attention** with TWO **high** findings:

1. ALLOWLIST keyed by `<anchorId>:<label>` was reusable — copying `<!-- auth-policy-allow:pb05-debug-flag-localstorage -->` before `localStorage.setItem('jwt', token)` (anywhere in any file) bypassed the rule.
2. The structural localStorage rules from iter-45 caught direct method calls and direct bracket access, but missed indirection: `const ls = localStorage; ls.setItem(...)`, destructuring `const { setItem } = localStorage`, and global-scope bracket lookup `globalThis['localStorage'].setItem(...)`.

## Codex adversarial review — findings

1. **[high]** Reusable allow anchor → universal bypass.
2. **[high]** Structural rules miss alias / destructure / bracket indirection.

## Brainstorming summary

- **Allowlist hardening**: convert the `Set<string>` to an array of objects: `{ file, anchorId, label, excerpt }`. The `excerpt` field is a substring of the protected line that must appear verbatim in the violating line for the exception to fire. Copying the anchor to a different file fails the `file` match; copying it to the same file but before different code (e.g. `localStorage.setItem('jwt', token)` instead of `localStorage.setItem('DEBUG', 'rag:*')`) fails the `excerpt` match.
- **Indirection rules**: three new regexes.
  - `localStorage-alias`: `\b(const|let|var)\s+\w+\s*=\s*localStorage\b` — flags `const ls = localStorage`. Excludes `.length` reads (`(?!\s*\.\s*length)`) so a count probe is allowed.
  - `localStorage-destructure`: `\b(const|let|var)\s*\{[^}]*\}\s*=\s*localStorage\b` — flags `const { setItem } = localStorage`.
  - `localStorage-bracket-indirect`: `\['"]localStorage['"]\s*\]` — flags `globalThis['localStorage']`, `window["localStorage"]`, etc.
- The existing direct-call rule (`\blocalStorage\s*\.\s*(setItem|...)\b`) ALREADY catches `globalThis['localStorage'].setItem(...)` because `\b` matches between `]` and `.` ... actually no, `\blocalStorage` requires the literal "localStorage" identifier in the source. So `globalThis['localStorage'].setItem(...)` has no bare `localStorage`. The new bracket-indirect rule is what catches it.
- Manual regression test: append a copied-anchor + token-write line to a non-pb05 file → `file` mismatch, violation reports.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Convert ALLOWLIST to file+anchor+label+excerpt object array | `scripts/check-auth-policy.mjs` | All existing exceptions resolve via the new shape |
| 2 | Add 3 indirection regex rules | `scripts/check-auth-policy.mjs` | Production scan stays clean |
| 3 | Update `isAllowed` (line-scoped) and the multiline allowlist resolution to use the new ALLOWLIST | `scripts/check-auth-policy.mjs` | Same allowlist semantics across both scan paths |
| 4 | Extend bad-auth fixture with 9 indirection lines | `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each line triggers the corresponding rule; harness counts updated |

## Changes made

- **ALLOWLIST shape: `Set<string>` → object array `{ file, anchorId, label, excerpt }`.**
  - Each existing entry rewritten with the file path (relative to repo root) it lives in and a substring of the protected line. The substrings are distinctive enough that a copy-paste regression elsewhere in the same file would not match (e.g. `pb02-step3-no-dummy-token` requires "does NOT generate a dummy-JWT" which is unique to that paragraph).
  - The pb05 DEBUG-flag entry uses the FULL DEBUG line as excerpt: `localStorage.setItem('DEBUG', 'rag:*')`. Any other localStorage call under the same anchor in the same file fails the excerpt check.
- **Three new structural regex rules.**
  - `localStorage-alias` — alias variable declaration. Excludes `.length` to allow probe reads if needed.
  - `localStorage-destructure` — destructured method bindings.
  - `localStorage-bracket-indirect` — `[ "localStorage" ]` and `[ 'localStorage' ]` bracket-keyed lookup.
- **`isAllowed` and multiline allowlist resolution rewritten.**
  - Both scan paths now compute the relative file path once and pass it (alongside the line text) to a unified allowlist lookup that checks `e.file === fileRel && e.anchorId === id && e.label === label && lineText.includes(e.excerpt)`.
- **Bad-auth fixture extension (9 lines).**
  - 3 alias declarations (`const ls = localStorage`, `let storage = localStorage`, `var s = localStorage`).
  - 2 destructuring bindings (`const { setItem } = localStorage`, `let { getItem, removeItem } = localStorage`).
  - 4 bracket-indirect lines: 2 declarations of bracket access (one `globalThis['localStorage']`, one `window["localStorage"]`) each chained to a `.setItem(...)` call. Each line triggers BOTH the bracket-indirect rule AND the direct-call rule because the `.setItem(` after the bracket pattern still matches `\blocalStorage\s*\.\s*setItem` — wait, actually the source has `]['localStorage'].setItem` so there IS a `localStorage].setItem`... the `\b` between `]` and `l`? `]` is non-word, `l` is word → boundary present. So `\blocalStorage\.setItem` matches `'localStorage'].setItem`? No — between `'` and `localStorage` there is a `'` which is non-word, then `l` word — boundary at `'l`. So regex `\blocalStorage\.setItem` would attempt to match starting at `localStorage` inside the string literal `'localStorage'`. After the quoted `localStorage`, the source is `']`. So substring `localStorage]` — no `.setItem` directly after. Match fails. So bracket-indirect lines DON'T match the direct-call rule. Only the bracket-indirect rule matches. So 4 lines × 1 rule = 4. Plus the 3 + 2 = 5 from alias/destructure. = 9 new violations. Old count 49 → 58.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 11 playbook files`).
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 58/58, 25 sentinels).
- **Manual round-46 finding-1 regression**: appended `<!-- auth-policy-allow:pb05-debug-flag-localstorage -->` + `localStorage.setItem('jwt', token);` to playbook 04 → production scan FAILED with the offending line surfaced (file mismatch caused the allowlist to skip the entry; default-deny rule fired). Reverted; clean.
- **Manual round-46 finding-2 regression**: each indirection shape was tested in isolation against the production scan via temp-file appends; all flagged. Reverted.

## Remaining gaps (anticipated for next adversarial round)

- The `excerpt` field is hand-curated. If a contributor edits the protected line, the excerpt may stop matching and the production scan will start failing — which is the right posture (force a manual review of the exception). Backlog: a `npm run audit:auth-policy-anchors` script that lists every anchor + its expected excerpt + the current line content to ease audits.
- The indirection rules don't cover Reflect-style access (`Reflect.get(globalThis, 'localStorage').setItem(...)`) or Function constructor evals. Both are exotic and were not flagged by Codex; backlog if pushed.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-46 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
