# Junie Skill v4 — Iteration 12

**Date:** 2026-05-02
**Loop step:** post-iteration-12

## Pre-iteration state

Codex round 12 grade: **A-** (target: A+). Three new findings (1 medium, 2 low).

## Codex review — key findings (round 12)

1. **[medium]** `.junie/playbooks/04-contract-tests.md:243-263` — production `src/services/auth.js` template re-implements `acquireTokenSilent` directly, bypassing the hardened `getToken(scopes)` in `msalConfig.js`. Result: scaffolded prod auth path skips the InteractionRequiredAuthError redirect, sanitized error rendering, and correlation-ID logging — all R11/SC6 controls.
2. **[low]** `.junie/playbooks/04-contract-tests.md:552-555` — troubleshooting doc says console emits `[AUTH-STUB ACTIVE] true`, but `auth-stub.js` L229 actually emits `[AUTH-STUB ACTIVE] <sentinel-UUID>`. Code-vs-doc drift; fixing the code would silently regress the leak test (sentinel must appear in the bundle for tree-shaking-resistance).
3. **[low]** `.junie/playbooks/03-backend-scaffold.md:1174` says `Tests: 35/35 passed` while `:1221` says `Total: 32/32 unit tests passed`. Counting `@Test` methods in the playbook: Units 1–8 sum to 24 per the progress checkpoint, Unit 9b adds 15 (DevDoubleGateTest 3 + DevDoubleClasspathScanTest 4 + SecurityBeansPresentTest 2 + OboValidationTest 6). True total is 39.

Round-11 findings confirmed by Codex: both CLOSED.

## Brainstorming summary

- Finding 1 — make `auth.js` delegate to `hardenedGetToken` from `msalConfig.js`. One source of truth; the alias-resolution target (auth.js) becomes a pure adapter that passes the API scope through. Document the constraint in a comment so a future reader does not "re-add try/catch for clarity" and silently re-introduce the bypass.
- Finding 2 — fix the doc string to match what the code emits. Don't touch the code: the sentinel-as-second-arg is load-bearing for the leak test (it pins the export side-effect into the bundle so tree-shaking can't drop it).
- Finding 3 — both numbers are inaccurate. Adopt 39/39 as the true total (24 + 15) and add a Unit 9b row to the progress checkpoint. Update both the completion ASCII block and the table total in lockstep so the two stay reconciled.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Wire production `auth.js` to delegate to hardened `getToken(scopes)` from `msalConfig.js` | `.junie/playbooks/04-contract-tests.md` | `auth.js` snippet imports `getToken as hardenedGetToken` from `../auth/msalConfig.js`; no `acquireTokenSilent` call directly inside `auth.js` |
| 2 | Align stub-console doc string with actual stub output | `.junie/playbooks/04-contract-tests.md` | Doc reads `[AUTH-STUB ACTIVE] <sentinel>` not `[AUTH-STUB ACTIVE] true` |
| 3 | Reconcile test counts to a single accurate value (39) and add Unit 9b row | `.junie/playbooks/03-backend-scaffold.md` | Both occurrences read `39/39`; progress table includes Unit 9b row totaling 15 |

## Changes made

- **`auth.js` template now delegates to hardened MSAL** — replaced direct `msalInstance.acquireTokenSilent` block with `import { getToken as hardenedGetToken } from '../auth/msalConfig.js'` and a one-line wrapper `return hardenedGetToken([import.meta.env.VITE_API_SCOPE])`. Added a `CRITICAL` comment block explaining why re-implementing here would bypass R11/SC6 controls.
- **Stub-console doc string aligned with code** — playbook 04 troubleshooting line now reads `Console emits "[AUTH-STUB ACTIVE] __JUNIE_DEV_AUTH_STUB_SENTINEL_a3f7c291_4b2e_48d1_9c6a_77e0f3b82d14__"` followed by a sentence explaining why the sentinel argument is load-bearing (tree-shake resistance).
- **Test count reconciliation** — playbook 03 completion ASCII block changed from `Tests: 35/35 passed (9 units × ~3–4 assertions each)` → `Tests: 39/39 passed (Units 1–8 + Unit 9b dev-double/OBO; Unit 9 MCP optional adds more)`. Progress checkpoint table gained a new row `9b. dev-double gate + OBO (Step D/F + classpath scan + security beans) | 15/15 | ✅` and the total line changed from `32/32` → `39/39 unit tests passed (Units 1–8: 24; Unit 9b: 15; Unit 9 MCP optional)`.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -nE 'acquireTokenSilent' .junie/playbooks/04-contract-tests.md` → matches only inside the `msalConfig.js` snippet (Step 6, the hardened source) and the auth-summary section, not inside the `auth.js` snippet.
- `grep -nE 'AUTH-STUB ACTIVE' .junie/playbooks/04-contract-tests.md` → 2 occurrences: code (`console.warn('[AUTH-STUB ACTIVE]', STUB_SENTINEL)`) + doc (sentinel string spelled out). No `true`-only mention remains.
- `grep -nE '35/35|32/32' .junie/playbooks/03-backend-scaffold.md` → 0 matches.
- `grep -nE '39/39' .junie/playbooks/03-backend-scaffold.md` → 2 matches (completion block + progress total) — consistent.

## Remaining gaps (anticipated for next loop)

- The progress-table total (`24 + 15 = 39`) is hardcoded prose. If a later iteration adds a test under any unit, drift returns. A stronger guard would be a small `scripts/check-test-count.mjs` that walks every `@Test` line in fenced Kotlin blocks under playbook 03 and asserts the table total matches. Out of scope for this iteration; backlog candidate.
- Codex's round-12 review noted that the auth boundary now has three modules involved (`auth.js` adapter + `msalConfig.js` hardened + `auth-stub.js` dev). Three is the right number but the scaffolded layout depends on the relative-import path `../auth/msalConfig.js` working. If the scaffolder ever lands `msalConfig.js` somewhere other than `src/auth/`, the import breaks. Mitigation: comment in `auth.js` explicitly names the expected sibling-directory layout.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-12 changes.
- Re-run Codex adversarial review (round 13).
- Compare grade. Target A+.
