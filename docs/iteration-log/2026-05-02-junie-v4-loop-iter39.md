# Junie Skill v4 — Iteration 39

**Date:** 2026-05-02
**Loop step:** post-iteration-39 (adversarial + translation pass)

## Pre-iteration state

User requested two coordinated changes:
1. **Translate every Spanish artifact in the repo to English** before resuming the adversarial loop. CLAUDE.md says "always respond in English"; INTEGRATION_PLAN.md was authored in Spanish and the SSE example fixture carried Spanish prose. The same drift class would have surfaced as a low-severity finding in a future adversarial round, so flushing it now keeps the surface stable.
2. **Resume the adversarial loop**: round 39 had returned `needs-attention` with one **high** + one **medium** despite round 38 returning `approve`.

## Codex adversarial review — round 39 findings (rerun)

1. **[high]** `getToken()` threw `AUTH_NO_ACCOUNT` synchronously before entering the try/catch that renders the sanitized recovery UI. First-visit users (no MSAL account) hit a dead-end error instead of being sent to login. Contradicts the Step 6 "no dead-end errors" guarantee.
2. **[medium]** `VITE_RAG_API_URL` was claimed to be validated at startup but `validateConfigOrHalt()` only checked MSAL values + `VITE_API_SCOPE`. Missing/malformed URL would fail later inside `new URL()` with a raw module-load error rather than the documented config-error screen.

## Brainstorming summary

- **Translation**: rewrite `INTEGRATION_PLAN.md` end-to-end in English (430 lines, mostly prose; mermaid blocks + code blocks unchanged). Translate the SSE example's Spanish payload (`La política de devoluciones...` → English equivalent). Translate the one Spanish word `"ventas"` in `pb03` to `"sales"`. Mermaid `subgraph` labels stay because they were already English.
- **Auth no-account**: replace `throw new Error('AUTH_NO_ACCOUNT')` with `await msalInstance.loginRedirect({ scopes }); throw new Error('AUTH_REDIRECTING')`. The redirect navigates the page away (control does not return); the throw is belt-and-braces if `loginRedirect` resolves without redirecting (offline/popup-blocker).
- **VITE_RAG_API_URL validation**: promote the env var to a module-scoped `apiBaseUrl` constant in `msalConfig.js`, add it to the `validateConfigOrHalt` checks list, and additionally try `new URL(apiBaseUrl)` to catch malformed strings that pass the placeholder check. Update `ragApi.js` to import the validated `apiBaseUrl` (single-source) instead of re-reading `import.meta.env`. Update the config-error screen copy to name `VITE_RAG_API_URL` alongside the MSAL values.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Translate `INTEGRATION_PLAN.md` to English | `INTEGRATION_PLAN.md` | grep for Spanish-only words returns 0 |
| 2 | Translate the SSE example fixture + the lone `"ventas"` in pb03 | `.junie/contracts/sse-events.examples.json`, `.junie/playbooks/03-backend-scaffold.md` | All English; invariants still clean |
| 3 | Auth no-account redirects via `loginRedirect`, not throws | `.junie/playbooks/04-contract-tests.md` | First-visit users sent to Entra ID login; no dead-end error |
| 4 | `VITE_RAG_API_URL` validated at startup via `apiBaseUrl` constant + URL parse | `.junie/playbooks/04-contract-tests.md` | `validateConfigOrHalt` lists `apiBaseUrl`; ragApi.js imports validated constant |

## Changes made

- **`INTEGRATION_PLAN.md` rewritten in English.** Every section translated. Mermaid + code blocks unchanged. Section numbering preserved. Tone matches the existing English standing rules in `.junie/guidelines.md`.
- **`sse-events.examples.json`** — Spanish chunk text replaced with `"The refund policy applies within 30 days of purchase..."`. Other event payloads were already English-clean.
- **`pb03` `UserContext.kt` doc comment** — `"ventas"` → `"sales"`.
- **`getToken()` no-account branch (round-39 high).**
  - Old: `if (accounts.length === 0) { throw new Error('AUTH_NO_ACCOUNT'); }`.
  - New: `if (accounts.length === 0) { await msalInstance.loginRedirect({ scopes }); throw new Error('AUTH_REDIRECTING'); }`. Comment block names round-39 closure and explains the belt-and-braces throw.
- **`apiBaseUrl` validated at startup (round-39 medium).**
  - New `export const apiBaseUrl = import.meta.env.VITE_RAG_API_URL;` constant in `msalConfig.js`.
  - `validateConfigOrHalt` checks list extended: `['apiBaseUrl', apiBaseUrl]`.
  - Extra `try { new URL(apiBaseUrl); } catch { ... }` step catches non-placeholder strings that fail to parse as URLs.
  - Config-error screen copy lists `VITE_RAG_API_URL` alongside the MSAL values + names the URL-parse requirement.
  - `ragApi.js` now imports `apiBaseUrl` from `msalConfig.js` instead of re-reading `import.meta.env.VITE_RAG_API_URL` — single validated source.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS.
- `grep -nE "[áéíóúñ]|política|ventas|según|sino|debe |para |con |opcional" INTEGRATION_PLAN.md .junie -r` → 0 matches.
- `grep -n "AUTH_NO_ACCOUNT" .junie/playbooks/04-contract-tests.md` → 0 matches (replaced with redirect path).
- `grep -n "loginRedirect" .junie/playbooks/04-contract-tests.md` → 2 matches (no-account redirect + retry button).
- `grep -n "apiBaseUrl" .junie/playbooks/04-contract-tests.md` → 4 matches (declaration + validator + URL-parse + ragApi import).

## Remaining gaps (anticipated for next adversarial round)

- Translation is complete for the auth surface but the `.junie/playbooks/05-docs-generation.md` file may still carry residual Spanish — Codex did not flag it; backlog if it surfaces.
- The `loginRedirect` no-account path assumes the browser supports redirect navigation. In SSR / popup-blocked environments this would silently no-op; the throw catches it but the user UX is "blank screen for a moment". Backlog if Codex flags.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-39 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
