# Junie Skill v4 — Iteration 40

**Date:** 2026-05-02
**Loop step:** post-iteration-40 (adversarial)

## Pre-iteration state

Round 40 verdict: **needs-attention** with TWO **high** findings. Iteration 39 closed the AUTH_NO_ACCOUNT dead-end + VITE_RAG_API_URL placeholder gap, but Codex pushed deeper:

1. The fix for the no-account branch calls `loginRedirect` immediately — but MSAL v3 (`@azure/msal-browser ^3.x`) requires `initialize()` + `handleRedirectPromise()` BEFORE any account/token API call. Without it, post-redirect users land back with an un-hydrated account list and bounce into `loginRedirect()` again — infinite redirect loop, or unhandled MSAL initialization error before the sanitized recovery UI can render.
2. The new `apiBaseUrl` validator only checked placeholder-ness + URL parsing. `VITE_RAG_API_URL=http://api.example.com` passes both, and `ragApi.js` then sends the Entra ID bearer token over cleartext HTTP. Production deploy typo → token exposure on every request.

## Codex adversarial review — round 40 findings

1. **[high]** MSAL redirect path can loop or fail before accounts are hydrated (`.junie/playbooks/04-contract-tests.md:766-786`). MSAL bootstrap missing.
2. **[high]** Validated `apiBaseUrl` allows production bearer tokens over plaintext HTTP (`:744-749`).

## Brainstorming summary

- **MSAL bootstrap**: introduce a memoised `initPromise` that awaits `msalInstance.initialize()` + `msalInstance.handleRedirectPromise()`. If the redirect carries an account, set it as active so subsequent `getAllAccounts()` returns it. `getToken()` awaits the promise before any account read. The promise runs exactly once per page load; subsequent calls reuse the resolved value.
- **HTTPS in production**: `validateConfigOrHalt` already has placeholder + URL-parse checks for `apiBaseUrl`. Add a third check: when `import.meta.env.PROD === true`, require `protocol === 'https:'`. Log the offending URL in the error message so operators can fix it. Non-prod builds (`development`, `test`, `local-auth`) can still use `http://localhost:8080` because they're never deployed.
- The HTTPS check piggybacks on the existing PROD-aware `isLocalRedirectAllowed` pattern from round 21 (build-mode awareness was already established).
- **Tests**: round 40 only touches the `msalConfig.js` template. The auth-policy invariant scans for forbidden patterns; the new code doesn't introduce any. The harness's count assertion stays unchanged because no new forbidden tokens shipped.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add memoised `ensureInitialized` MSAL bootstrap; getToken awaits it | `.junie/playbooks/04-contract-tests.md` | `initPromise` singleton present; `await ensureInitialized()` first line of getToken |
| 2 | Validator rejects non-HTTPS apiBaseUrl in production | `.junie/playbooks/04-contract-tests.md` | `import.meta.env.PROD && url.protocol !== 'https:'` branch in validateConfigOrHalt |

## Changes made

- **MSAL v3 bootstrap.**
  - New module-scoped `initPromise` (initially undefined) and `ensureInitialized()` helper. The helper memoises the promise that runs `await msalInstance.initialize()` then `await msalInstance.handleRedirectPromise()`. If the redirect result carries an account, `setActiveAccount(result.account)` is called so the next `getAllAccounts()` returns it.
  - Comment block above the bootstrap names the round-40 closure and explains the redirect-loop failure mode the bootstrap prevents.
  - `getToken()` first line is now `await ensureInitialized();` — runs before any account/token API call.
- **HTTPS enforcement in production.**
  - `validateConfigOrHalt` URL-parse branch extended: after successful `new URL(apiBaseUrl)`, an additional `import.meta.env.PROD && u.protocol !== 'https:'` check pushes a tagged failure with the offending URL into `bad`. The config-error screen then surfaces the production-HTTPS requirement.
  - Comment names the round-40 closure and the cleartext-token-exposure risk.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS.
- Manual round-40 bypass exercises:
  - Set `import.meta.env.PROD=true` + `apiBaseUrl='http://api.example.com'` → validator pushes `apiBaseUrl` into `bad` with "production builds require https://" tag.
  - Simulate first-visit + post-redirect (set MSAL accounts to empty before `handleRedirectPromise`) → `ensureInitialized` runs the redirect handler, hydrates the account, `getAllAccounts()` returns the new account, no second `loginRedirect` fires.

## Remaining gaps (anticipated for next adversarial round)

- `handleRedirectPromise` may legitimately reject (e.g. browser navigated away mid-flow). The current bootstrap propagates the rejection to `getToken()`'s caller — same pattern as the existing `acquireTokenSilent` catch path. Backlog candidate: wrap the bootstrap in the same sanitized-error rendering as the rest of `getToken`.
- Production-HTTPS check accepts any `https://` URL. A `https://internal.network/` URL still allows TLS but may not be reachable from the user's browser; that's a deploy-config issue, not a security issue.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-40 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
