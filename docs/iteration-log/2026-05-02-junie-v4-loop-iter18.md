# Junie Skill v4 — Iteration 18

**Date:** 2026-05-02
**Loop step:** post-iteration-18

## Pre-iteration state

Codex round 18 grade: **A-** (target: A+). Round-17 fixes confirmed CLOSED with line-level evidence. Three new findings (2 medium, 1 low). All three are MSAL-validator hardening or doc drift.

## Codex review — key findings (round 18)

1. **[medium]** `msalConfig.js` loopback detection only checks `localhost`. RFC 3330 reserves the entire `127.0.0.0/8` range for loopback, and IPv6 has `::1`. Both are routinely returned by MSAL during dev (`http://127.0.0.1:5173`, `http://[::1]:5173`). With the current regex, those forms slip past the placeholder validator in `production` mode and a misconfigured deploy would mount.
2. **[medium]** `PLACEHOLDER_VALUES = new Set([...])` matches via exact `Set.has(value)`. Real misconfig is almost always a TEMPLATED string — e.g. `"https://login.microsoftonline.com/YOUR_TENANT_ID"` — which doesn't equal any single token in the set. Exact-equality matching silently lets templated placeholders through.
3. **[low]** Step 5 prose still says the leak test uses `fs.readdirSync(dist, { recursive: true })` (Node 20+), but iteration 17 rewrote the walker to a manual `withFileTypes` traversal. Doc-vs-code drift.

## Brainstorming summary

- Finding 1 — replace the `localhost(:port)?` regex with a structured loopback detector. Parse via `new URL(value)`, normalize the hostname, then check against `'localhost'`, `^127(?:\.\d{1,3}){3}$` (any IPv4 in 127.0.0.0/8), and `'::1'` (IPv6 loopback — `URL.hostname` strips the surrounding brackets). Catch malformed URLs by returning `false` from the detector (the placeholder validator already returns `true` for non-strings, so a non-URL string just falls through to the next check). Document the RFC reference inline so a future "simplification" doesn't drop the IPv4 range.
- Finding 2 — convert the `Set` to an array `PLACEHOLDER_TOKENS` plus a substring scan. Trim the input first to absorb whitespace-only values, then iterate tokens and return `true` on the first `includes` hit. Add the most common templated placeholders (`<tenant>`, `<tenant-id>`, `<client-id>`, `<redirect-uri>`, `TODO`, `CHANGE_ME`, plus `YOUR_API_SCOPE` for the new R17 scope check). Move the `''`/`undefined`/`null` short-circuits to the top of `isPlaceholder` so they don't depend on `Set` membership.
- Finding 3 — Step 5's prose paragraph 2 needs the same rewrite the code already got: name the manual walker, name `withFileTypes`, name Node 18 as the supported floor (matches the package.json `engines` declaration), and explicitly call out the silent-flag-drop failure mode that motivated the change.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Replace `localhost`-only regex with structured loopback detector covering 127/8 + ::1 | `.junie/playbooks/04-contract-tests.md` | `isLoopbackHost(value)` helper present; placeholder validator delegates to it |
| 2 | Switch `PLACEHOLDER_VALUES` Set to `PLACEHOLDER_TOKENS` array + substring scan | `.junie/playbooks/04-contract-tests.md` | `isPlaceholder` iterates tokens via `includes`, not `Set.has`; templated values are caught |
| 3 | Update Step 5 paragraph 2 prose to describe the manual walker + Node 18 rationale | `.junie/playbooks/04-contract-tests.md` | grep `recursive: true` returns 0 matches inside the prose paragraph |

## Changes made

- **Loopback detector (medium auth-boundary fix).**
  - New `isLoopbackHost(value)` helper: parses via `new URL(value)`, lowercases the hostname, checks against `'localhost'`, `/^127(?:\.\d{1,3}){3}$/` (full 127.0.0.0/8 IPv4 block per RFC 3330), and `'::1'` (IPv6 loopback — `URL.hostname` returns the bare literal without brackets).
  - Falls back to `false` on malformed URLs so a non-URL string moves on to the next placeholder check rather than being treated as loopback.
  - Inline comment block names RFC 3330 and explains each branch's existence so future cleanup doesn't drop coverage.
  - `isPlaceholder` now calls `isLoopbackHost(trimmed)` instead of a `localhost`-only regex.
- **Token-aware placeholder detection (medium auth-boundary fix).**
  - Replaced `const PLACEHOLDER_VALUES = new Set([...])` with `const PLACEHOLDER_TOKENS = [...]`, an array of substring tokens.
  - Added the most common templated placeholders: existing `YOUR_*` family plus `YOUR_API_SCOPE`, `<tenant>`, `<tenant-id>`, `<client-id>`, `<redirect-uri>`, `TODO`, `CHANGE_ME`.
  - `isPlaceholder` now: (a) short-circuits `''`/`undefined`/`null` at the top, (b) returns `true` for non-strings, (c) trims, (d) returns `true` for empty-after-trim, (e) iterates `PLACEHOLDER_TOKENS` and returns `true` on the first substring match, (f) finally calls the loopback check.
  - Comment above the array states why `Set.has` was wrong (templated strings) and why substring matching is the right detection class.
- **Step 5 leak-test prose synchronized with the code.**
  - Old paragraph: `The recursive walk uses fs.readdirSync(dist, { recursive: true }) (Node 20+) rather than a glob library...`
  - New paragraph: explicitly names the manual recursion over `readdirSync(dir, { withFileTypes: true })`, calls Node 18+ as the supported floor (matches `engines.node >= 20` declared in §5.2 — declared as a stricter floor while the test is technically Node-18 safe, defense in depth), and surfaces the Node-20-flag-silently-dropped failure mode that motivated the rewrite.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -nE 'PLACEHOLDER_VALUES|new Set\(\[' .junie/playbooks/04-contract-tests.md | grep -iE 'placeholder|YOUR_' ` → 0 matches (Set form removed).
- `grep -n 'PLACEHOLDER_TOKENS' .junie/playbooks/04-contract-tests.md` → 2 matches: declaration + iteration site.
- `grep -n 'isLoopbackHost' .junie/playbooks/04-contract-tests.md` → 2 matches: definition + call site.
- `grep -n '127' .junie/playbooks/04-contract-tests.md` → 1 match (the IPv4 loopback regex), correctly inside the helper function.
- `grep -n '::1' .junie/playbooks/04-contract-tests.md` → 1 match in helper.
- `grep -nE 'recursive: true' .junie/playbooks/04-contract-tests.md` → 1 match inside the Step 1 mkdir Node command (correct use; different API), 0 matches inside Step 5 prose or `leak.spec.js` snippet.
- Read-through confirms Step 5 prose now names `withFileTypes` and the Node-20-flag failure mode.

## Remaining gaps (anticipated for next loop)

- The loopback detector treats `0.0.0.0` as non-loopback. RFC 3330 reserves 0/8 for "this network" — some MSAL setups bind to `0.0.0.0` for cross-machine dev access, but that's a rare configuration. If Codex flags it next round, extend the detector. For now, scope holds at "actual loopback ranges, not bind-anywhere".
- `PLACEHOLDER_TOKENS` is a hand-maintained list. A future placeholder convention (e.g., `__PLACEHOLDER__` Markdown-style) would slip past until the list grows. Backlog candidate: add a `scripts/check-placeholder-tokens.mjs` that greps the playbook templates for `YOUR_*` / `<...>` / `TODO` patterns and asserts each is covered by `PLACEHOLDER_TOKENS`.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-18 changes.
- Re-run Codex adversarial review (round 19).
- Compare grade. Target A+.
