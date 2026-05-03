# Junie Skill v4 — Iteration 42

**Date:** 2026-05-02
**Loop step:** post-iteration-42 (adversarial)

## Pre-iteration state

Round 42 verdict: **needs-attention** with one **medium** finding. Iter-41 routed bootstrap rejection through the recovery UI but the retry handler called `ensureInitialized().catch(() => {})` only — if the retry SUCCEEDED, the promise resolved silently, the error UI stayed in place, and subsequent clicks just returned the already-resolved memoised promise. Transient failure → permanent dead end.

## Codex adversarial review — single finding

1. **[medium]** `.junie/playbooks/04-contract-tests.md:837-843` — retry handler doesn't drive a real recovery path after successful bootstrap.

## Brainstorming summary

- Three valid recovery shapes: (a) reload the page, (b) call `loginRedirect({ scopes })` directly, (c) re-mount the app. Pick (a): simplest, scopes-context-free, and lets MSAL's normal `initialize → handleRedirectPromise → getAllAccounts → loginRedirect-if-needed` flow run from a clean state. (b) needs scopes from the caller, which the recovery UI doesn't have. (c) requires Vue-internal hooks the playbook deliberately avoids coupling to.
- Update the click handler from `ensureInitialized().catch(() => {})` to `ensureInitialized().then(() => window.location.reload()).catch(() => {})`. The `.catch(() => {})` still suppresses the unhandled-rejection log; if the retry FAILS, the bootstrap's own try/catch re-renders this same recovery UI (already cleared the promise inside `ensureInitialized`'s catch).
- Single-line chain so the auth-policy anchor walk-back resolves to the line immediately above (the anchor). Multi-line `.then(...).catch(...)` would put a non-anchor non-blank line between the anchor and the violation, breaking allowlist resolution.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Retry handler drives a real recovery via `window.location.reload()` after successful bootstrap; single-line chain for anchor compatibility | `.junie/playbooks/04-contract-tests.md` | `.catch(() => {})` still allow-anchored; harness passes |

## Changes made

- **Retry click handler now reloads after successful bootstrap.**
  - Old: `ensureInitialized().catch(() => {})`.
  - New: `ensureInitialized().then(() => window.location.reload()).catch(() => {})`.
  - Comment block above explicitly enumerates the four-step MSAL flow that runs after the reload (`initialize → handleRedirectPromise → getAllAccounts → loginRedirect-if-needed`) so a future maintainer doesn't strip the reload thinking it's redundant.
  - Single-line chain (no break before `.then`) keeps the anchor walk-back simple — anchor is on the line immediately above the chain.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS.
- Manual round-42 trace: bootstrap fails → recovery UI renders → user clicks retry → `ensureInitialized()` re-runs → if it succeeds, `window.location.reload()` fires → fresh page load → MSAL bootstrap runs again → user proceeds through normal flow. If retry fails, the bootstrap's catch re-renders the same UI.

## Remaining gaps (anticipated for next adversarial round)

- `window.location.reload()` is a hard navigation. If the user has unsaved state in the app (unlikely for the post-error path, but possible in a future iteration that runs the recovery UI mid-session), the reload would discard it. Backlog if Codex flags.
- The reload path doesn't handle the case where the URL still carries MSAL's redirect-response query parameters. Browser typically clears them after a successful redirect, but a partial failure could leave them. MSAL's `handleRedirectPromise` is idempotent across reloads in v3.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-42 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
