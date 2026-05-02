# Junie Skill v4 — Iteration 14

**Date:** 2026-05-02
**Loop step:** post-iteration-14

## Pre-iteration state

Codex round 14 grade: **B+** (target: A+). All round-13 fixes confirmed CLOSED. Four new findings (2 medium, 2 low).

## Codex review — key findings (round 14)

1. **[medium]** `.junie/playbooks/04-contract-tests.md:48-59 and :303-308` — both generated Vitest specs use `__dirname`, which is undefined in ESM. The first call to `resolve(__dirname, …)` throws `ReferenceError` before any assertion runs, so the entire test file fails with no signal at all (looks like 0 tests, not 1 failure).
2. **[medium]** `.junie/playbooks/04-contract-tests.md:558-570` — documented offline dev flow ("frontend + backend, no orchestrator") cannot work end-to-end. The frontend `auth-stub.js` mints a fake non-RSA JWT; the backend's `NimbusReactiveJwtDecoder` validates against Entra JWKS / audience / issuer. The fake token always 401s, but the doc claims the user can submit a query and see fake SSE.
3. **[low]** `.junie/playbooks/03-backend-scaffold.md:234-251` (Step B table) says `application-dev.yml` flips `app.dev-doubles.enabled=true`, while `.junie/playbooks/04-contract-tests.md:131-156, 542-550` says `application-mock.yml` is the activation profile. Two different conventions for the single gate; risks `dev` silently auto-enabling doubles.
4. **[low]** `INTEGRATION_PLAN.md:104` describes the inbound request as `ask`, optional `conversation_id`, `user_context`. After the §3.1 auth-boundary fix, this line could be misread as contradicting "browser MUST NOT include userContext" — it actually refers to the orchestrator leg request (Spring → orchestrator), not the browser → Spring leg.

## Brainstorming summary

- Finding 1 — both Vitest files need an ESM-safe `__dirname` shim. Standard pattern: `import { fileURLToPath } from 'node:url'`, then `const __dirname = dirname(fileURLToPath(import.meta.url))`. Add comment explaining the Vitest-ESM-runner failure mode so a future maintainer doesn't "simplify" it back.
- Finding 2 — re-author the offline-dev section to spell out what is and is not supported. Three modes:
  (a) Frontend-only (auth-stub + frontend mock for `/api/rag/ask`) — works.
  (b) Frontend + backend, real MSAL token (`pnpm dev --mode production`), backend with mock orchestrator profile — works, end-to-end.
  (c) Frontend dev mode (auth-stub) + backend running — does not work, returns 401, and that is correct because R6c forbids a backend bypass.
  Add explicit "do not 'fix' this by disabling backend JWT validation in dev" warning.
- Finding 3 — adopt the `mock` profile as the only dev-double activation profile. `dev` is for real-backend local development with prod-like config; it intentionally does NOT enable doubles. This also resolves the offline-dev contradiction by making the rule consistent across both playbooks.
- Finding 4 — rephrase INTEGRATION_PLAN.md L104 to make explicit that `user_context` here is the orchestrator-leg payload built by Spring from the JWT, with a back-pointer to §3.1. Add the cross-reference inline so a reader scanning the data flow doesn't have to deduce the auth boundary from elsewhere in the doc.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add ESM-safe `__dirname` to both Vitest specs | `.junie/playbooks/04-contract-tests.md` | `fileURLToPath(import.meta.url)` present in both `contract.spec.js` and `leak.spec.js` snippets |
| 2 | Rewrite offline-dev section: 3 modes (one unsupported) | `.junie/playbooks/04-contract-tests.md` | Section names Mode 1/2 + unsupported case; warns against backend-side auth bypass |
| 3 | Consolidate dev-double activation to `mock` profile only | `.junie/playbooks/03-backend-scaffold.md` | Step B table shows `application-mock.yml = true`, `application-dev.yml` unset |
| 4 | Disambiguate INTEGRATION_PLAN.md L104 `user_context` | `INTEGRATION_PLAN.md` | Line names the orchestrator leg + cross-references §3.1 |

## Changes made

- **ESM-safe `__dirname` in both Vitest specs.**
  - `contract.spec.js` snippet now imports `dirname` (from `node:path`) and `fileURLToPath` (from `node:url`), and derives `__filename` + `__dirname` from `import.meta.url`. Three-line comment block above the derivation explains the ReferenceError failure mode in Vitest's ESM runner so future readers don't strip the shim.
  - `leak.spec.js` snippet gets the same shim, plus a one-line comment pointing back to `contract.spec.js` for the rationale.
- **Offline-dev section rewrite (medium auth-boundary doc).**
  - "To test locally (frontend + backend, no orchestrator)" replaced with explicit "two supported modes (and one unsupported one)" framing.
  - Mode 1 (frontend-only): auth-stub plus a frontend-side mock for `/api/rag/ask` (suggested: MSW or Vite middleware). Used for pure UI/UX work.
  - Mode 2 (end-to-end with real auth, mocked orchestrator): backend with `--spring.profiles.active=dev,mock`, frontend with `pnpm dev --mode production` so Vite resolves `auth.js` (real MSAL) instead of `auth-stub.js`. JWT is real; orchestrator is faked.
  - Unsupported case (auth-stub + real backend): documented as 401-by-design. Explicit "do not 'fix' this by disabling backend JWT validation" callout pointing at R6c invariant.
- **Profile consolidation (low — single-gate enforcement).**
  - `application-dev.yml` row in Step B table changed from `true` → `unset — plain dev does not auto-enable mocks`.
  - New `application-mock.yml` row added: `true (the only dev-double activation profile)`.
  - Narrative below the table rewritten: `dev` is for real-backend local dev (same auth posture as prod); `mock` is the explicit dev-double activator. `--spring.profiles.active=dev,mock` is the documented way to opt in.
- **INTEGRATION_PLAN.md L104 disambiguation (low).**
  - Original: "Request entra con `ask`, `conversation_id` opcional, `user_context`."
  - Rewritten: "Request entra al **orchestrator (FastAPI)** con `ask`, `conversation_id` opcional, y `user_context` (este último lo construye Spring desde el JWT autenticado en el paso 0; ver §3.1: el browser nunca lo envía)."
  - Names the leg (orchestrator), names the source (Spring from JWT), back-points to §3.1.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n 'fileURLToPath' .junie/playbooks/04-contract-tests.md` → 4 matches: vite.config.js (existing), contract.spec.js (new), leak.spec.js (new), and the per-file shim comments.
- `grep -nE 'application-(dev|mock)\.yml' .junie/playbooks/03-backend-scaffold.md` → only the Step B table rows; narrative consistent.
- `grep -n '"userContext"\|user_context' INTEGRATION_PLAN.md` → 1 match at L104 (the disambiguated line); 0 matches elsewhere.
- Manual read of the offline-dev section confirms three modes are named explicitly, the unsupported case is called out, and the R6c warning is present.

## Remaining gaps (anticipated for next loop)

- Mode 2 instructions assume Vite's `--mode` flag works against the dev server; the standard pattern is to run `pnpm preview` after `pnpm build`. Both routes resolve `auth.js`; the backlog item is to validate which is the smoother dev loop and document only that one.
- The unsupported "fake-token + real backend" case relies on the developer reading the warning. A stronger guard would print a runtime banner from `auth-stub.js` when it detects that `import.meta.env.MODE === 'development'` and a real backend URL is configured. Out of scope for this iteration; backlog candidate.
- INTEGRATION_PLAN.md §2.4 step 1 is now correctly disambiguated, but other steps in §2.4 (e.g., Cosmos persistence) still use loose phrasing. No regression flagged by Codex; deferred.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-14 changes.
- Re-run Codex adversarial review (round 15).
- Compare grade. Target A+.
