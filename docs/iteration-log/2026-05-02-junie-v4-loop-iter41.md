# Junie Skill v4 — Iteration 41

**Date:** 2026-05-02
**Loop step:** post-iteration-41 (adversarial)

## Pre-iteration state

Round 41 verdict: **needs-attention** with one **medium** finding. Iter-40's `ensureInitialized` was a happy-path memoised promise — a corrupted-redirect-state / blocked-storage / interrupted-redirect rejection from `initialize()` or `handleRedirectPromise()` would propagate raw to `ragApi.js` instead of the sanitized recovery UI. Worse, the rejected promise stayed cached, so retries reused the same rejection.

## Codex adversarial review — single finding

1. **[medium]** `.junie/playbooks/04-contract-tests.md:794-819` — `ensureInitialized()` lacks the same hardened error path as `acquireTokenSilent`. Bootstrap rejection escapes the recovery UI and pins the cached promise into a permanent failure state.

## Brainstorming summary

- Mirror the `acquireTokenSilent` catch path inside `ensureInitialized`: catch the rejection, render the same "We couldn't sign you in" recovery UI, wire a `Sign in again` button that re-runs `ensureInitialized()` from scratch.
- Clear `initPromise = undefined` BEFORE rendering so the retry path can re-enter the bootstrap with a fresh promise. Without this, the click handler's recursive call would just await the same rejected promise.
- The retry handler is fire-and-forget by design: `ensureInitialized().catch(() => {})`. The bootstrap's own catch re-renders the recovery UI; swallowing the rejection here prevents an "unhandled promise rejection" log without changing the user-visible behaviour.
- The `.catch(() => {})` triggers the auth-policy structural rule from round 33 — that's the rule's job. Add an `auth-policy-allow:pb04-retry-noop-catch` anchor immediately above the call. Existing anchor regex required the marker to be the entire trimmed line; embedding it inside a JS code block needs a `// ` prefix tolerance, so update `STANDALONE_ANCHOR_RE` to accept `(?:\/\/\s*)?` before the HTML comment.
- Anchor walk-back stops at the first non-blank line, so the anchor MUST be the line immediately above `.catch(() => {})` — no intervening prose. Restructure the snippet so the explanatory comment block sits ABOVE the anchor and the anchor is alone on the line above the violation.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Wrap MSAL bootstrap in try/catch with sanitized recovery UI + retry handler + initPromise clearing | `.junie/playbooks/04-contract-tests.md` | Bootstrap rejection no longer escapes; clearing happens before UI render |
| 2 | Allow-anchor the retry handler's intentional `.catch(() => {})`; extend `STANDALONE_ANCHOR_RE` to tolerate `// ` prefix | `scripts/check-auth-policy.mjs`, `.junie/playbooks/04-contract-tests.md` | Auth-policy invariant clean; harness still passes |

## Changes made

- **`ensureInitialized()` hardened.**
  - Inner async IIFE now wraps the entire `initialize()` + `handleRedirectPromise()` flow in `try { ... } catch (err) { ... }`.
  - On rejection: sanitized correlation-ID-only `console.error`, clear `initPromise = undefined`, render the recovery UI with the same shape used by `acquireTokenSilent`'s catch path, wire the `Sign in again` button to `ensureInitialized()` (the cleared promise allows a fresh re-run), throw `AUTH_FAILED`.
  - The throw still propagates through `getToken()` → `ragApi.js`'s `await getToken()` → caller's reject handler. The recovery UI is already rendered before the throw, so the caller sees the throw AND the screen.
  - Comment block above the helper names round-41 closure and explicitly enumerates: caught rejections, cleared promise, recovery UI render, throw.
- **Retry click handler allow-anchored.**
  - The `retry.addEventListener('click', ...)` body now has the anchor `// <!-- auth-policy-allow:pb04-retry-noop-catch -->` on the line IMMEDIATELY above the `ensureInitialized().catch(() => {});` line. Explanation prose sits ABOVE the anchor (anchor walk-back stops at the first non-blank line).
- **`scripts/check-auth-policy.mjs` `STANDALONE_ANCHOR_RE` tolerant of JS line comment prefix.**
  - Old: `/^<!--\s*auth-policy-allow:([a-z0-9][a-z0-9-]*)\s*-->$/i`.
  - New: `/^(?:\/\/\s*)?<!--\s*auth-policy-allow:([a-z0-9][a-z0-9-]*)\s*-->$/i`. Markdown prose still works without the prefix; embedded JS comment-anchors now also match.
- **`ALLOWLIST` extended.**
  - New entry: `'pb04-retry-noop-catch:catch-and-substitute'` — the rule label matched by the structural regex.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS.
- Manual round-41 bypass exercise: simulate `handleRedirectPromise` rejecting with a synthetic error → `ensureInitialized` catches, renders recovery UI, clears `initPromise`, throws `AUTH_FAILED`. Subsequent click on `Sign in again` re-runs the bootstrap from scratch (cleared promise) — no permanent failure state.

## Remaining gaps (anticipated for next adversarial round)

- Recovery UI is rendered as inline `innerHTML`. CSP-strict deployments (no `unsafe-inline`) might reject the `<style>` attributes; the playbook doesn't currently document a CSP carve-out. Backlog candidate.
- The `Sign in again` retry runs `ensureInitialized()` then immediately discards the promise. If the user clicks before the bootstrap completes, two parallel `ensureInitialized()` calls share the same memoised promise — race-safe in practice. Backlog if Codex flags.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-41 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `approve` / no findings.
