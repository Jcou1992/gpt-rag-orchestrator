# Junie Skill v4 — Iteration 17

**Date:** 2026-05-02
**Loop step:** post-iteration-17

## Pre-iteration state

Codex round 17 grade: **B+** (target: A+). Round-16 fixes confirmed CLOSED. Three new findings (2 high, 1 medium) — every one of them a genuine runtime breakage in the scaffolded artifacts, not cosmetic.

## Codex review — key findings (round 17)

1. **[high]** `INTEGRATION_PLAN.md §5.2` omits `@vitejs/plugin-vue` even though `vite.config.js` (playbook 04 Step 4 line 184) imports it via `import vue from '@vitejs/plugin-vue'`. Following the dep list produces a frontend that fails the first `vite dev` / `vite build` with `Cannot find package '@vitejs/plugin-vue'`. Same drift class as round-16 finding 1 (msal-browser); a second instance means the dep audit needs to walk every `import` in the playbook code blocks, not be done speculatively.
2. **[high]** Playbook 04 offline-dev Mode 2 prescribes `pnpm dev --mode production`, but `msalConfig.js` rejects localhost redirect URIs in non-dev modes via the placeholder validator. Running the prescribed command therefore fails at startup with the config-error screen, contradicting the doc's claim that MSAL works.
3. **[medium]** `contract-tests/leak.spec.js` uses `fs.readdirSync(distDir, { recursive: true })` — a Node 20+ option. Under Node 18 the flag is silently ignored and the walker scans only the top level, producing a vacuous pass when the auth-stub lands inside a hashed asset subdirectory like `dist/assets/`.

## Brainstorming summary

- Finding 1 — append `@vitejs/plugin-vue: ^5.1.0` to default devDeps (NOT TS-only). Add a load-bearing note pointing readers at `vite.config.js`. Also declare `engines.node >= 20` while editing §5.2 — Vite 5 + Vitest 2 both push toward Node 20, and the engines floor closes finding 3's failure class even if the leak test stays simple.
- Finding 2 — introduce a `local-auth` Vite mode that allow-lists a `localhost` redirect URI in `msalConfig.js` while staying out of the dev-stub allowlist (so it still resolves real `auth.js`, not `auth-stub.js`). Promote `isDevMode` and `isLocalRedirectAllowed` to two separate flags with an explicit allow-list set; keep `production` out of the localhost-allow-list so a misconfigured deploy still fails loud. Update offline-dev Mode 2 invocation from `--mode production` → `--mode local-auth` with a paragraph explaining why.
- Finding 3 — replace the `{ recursive: true }` call with a manual recursive walker using `readdirSync(dir, { withFileTypes: true })` plus `entry.isDirectory()` / `entry.isFile()`. Works on Node 18+. Keep the `engines: { node: '>=20' }` declaration as a defense-in-depth posture, but eliminate the active dependency on the Node 20+ flag so the leak test does not silently regress on an older runtime.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `@vitejs/plugin-vue` to default devDeps + declare `engines.node >= 20` + extend load-bearing notes | `INTEGRATION_PLAN.md` | grep `@vitejs/plugin-vue` returns 1 match in §5.2; `engines.node` block present |
| 2 | Add `local-auth` Vite mode — `msalConfig.js` allow-lists localhost redirect for that mode + offline-dev Mode 2 doc invokes `--mode local-auth` | `.junie/playbooks/04-contract-tests.md` | `ALLOWS_LOCAL_REDIRECT` set contains `'local-auth'`; offline-dev block reads `pnpm dev --mode local-auth` |
| 3 | Replace `readdirSync(dir, { recursive: true })` in leak spec with manual walker + drop unused `statSync` import | `.junie/playbooks/04-contract-tests.md` | grep `recursive: true` returns 0 matches inside JS blocks; walkDist uses `withFileTypes` |

## Changes made

- **§5.2 dependency completeness + engines floor.**
  - Default `devDependencies` JSON gained `"@vitejs/plugin-vue": "^5.1.0"` between `vite` and `vite-plugin-vuetify`.
  - New top-level `engines: { node: ">=20.0.0" }` block at the end of the package.json snippet.
  - Notes section gained two new bullets: one pointing at `vite.config.js` (`plugins: [vue()]`) for `@vitejs/plugin-vue`'s load-bearing role, one explaining the engines floor as alignment with Vite 5 + Vitest 2 — and explicitly stating that the leak test is Node-18-safe (manual walker), so the engines floor is precaution, not active dependency.
- **`local-auth` Vite mode (auth-boundary doc fix).**
  - Replaced `const isDevMode = ...` single declaration with two flags + an allow-list set:
    - `ALLOWS_LOCAL_REDIRECT = new Set(['development', 'test', 'local-auth'])` — the names of every mode where a localhost redirect URI is acceptable.
    - `isDevMode` (unchanged semantics: only `'development'` / `'test'`) for any callers that still need it.
    - `isLocalRedirectAllowed` (new) gates the localhost regex check inside `isPlaceholder`.
  - Comment block above the constants explains: `production` is intentionally NOT in the allow-list (a prod build with a localhost redirect is a misconfigured deploy and must fail loud); `local-auth` lets a developer run real MSAL on `http://localhost:5173` without a tunnel.
  - Offline-dev Mode 2 invocation updated:
    - Was: `pnpm dev --mode production`.
    - Now: `pnpm dev --mode local-auth`, with a leading paragraph explaining why the new mode exists and why `--mode production` against localhost was wrong.
- **Leak test now Node-18 safe.**
  - `walkDist()` rewritten as a manual recursive function using `readdirSync(dir, { withFileTypes: true })` + `entry.isDirectory()` + `entry.isFile()`.
  - Six-line comment explains the failure mode of `{ recursive: true }` on Node 18 (silent flag drop → top-level-only scan → vacuous pass when the stub lands in `dist/assets/`).
  - `statSync` removed from the `node:fs` import line — no longer used after the rewrite.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n '@vitejs/plugin-vue' INTEGRATION_PLAN.md` → 2 matches (dep entry + load-bearing note).
- `grep -n '"engines":' INTEGRATION_PLAN.md` → 1 match (the new top-level block).
- `grep -nE "ALLOWS_LOCAL_REDIRECT|isLocalRedirectAllowed|local-auth" .junie/playbooks/04-contract-tests.md` → 7 matches across the constant declaration, the validator branch, the comment block, and the offline-dev section.
- `grep -nE "recursive: true|readdirSync\(distDir, \{ recursive" .junie/playbooks/04-contract-tests.md` → 0 matches inside JS code blocks (matches only inside the Step 1 `mkdir -p` Node command, which uses `fs.mkdirSync(..., {recursive:true})` — a different API on a different argument shape that is Node-14+).
- `grep -n 'statSync' .junie/playbooks/04-contract-tests.md` → 0 matches inside the `leak.spec.js` snippet; only matches inside the Step 1 schema-copy verification commands, which is correct.
- Read-through of the offline-dev section confirms the unsupported-case warning still survives (R6c invariant call-out unchanged).

## Remaining gaps (anticipated for next loop)

- `@vitejs/plugin-vue` v5.x is the documented pin; v6 may ship and Codex could flag the version drift class once again. Mitigation: the load-bearing-note pattern in §5.2 surfaces the dependency by name; a future `scripts/check-frontend-deps.mjs` could parse imports from playbook code blocks and assert each is in §5.2. Backlog candidate.
- The `local-auth` mode resolves real `auth.js` and accepts a localhost redirect URI, but the scaffolded `.env` template is not updated in this iteration. A scaffolder will still hit "missing `VITE_MSAL_CLIENT_ID`" if they don't provide tenant values. The R11 validator surfaces this loudly (config-error screen), so it's a clear UX, not a hidden failure.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-17 changes.
- Re-run Codex adversarial review (round 18).
- Compare grade. Target A+.
