# Junie Skill v4 — Iteration 26

**Date:** 2026-05-02
**Loop step:** post-iteration-26 (adversarial)

## Pre-iteration state

Round 26 adversarial verdict: **needs-attention**. Iteration 25 closed the test-pipeline freshness gap, but Codex went up the stack and surfaced a contradiction between playbook 02 (frontend scaffold) and playbook 04 (auth-boundary hardening). Playbook 02 Step 3 instructed scaffolders to generate `src/services/auth.js` with a "mocked `getToken()` returning a dummy JWT" and a guardrail bullet at L294 told them to "fall back to a dummy token for dev (`auth-stub-token`)". Both directly violate the R6/R6a/R8/R11 controls that playbook 04 spends Steps 4 + 6 establishing. The leak test scans for the dev-stub sentinel UUID specifically, so a generic dummy-token fallback in `auth.js` would ship to production while the leak gate still passes — same impact class as the v3 D-grade defect this entire v4 cut was meant to eliminate.

## Codex adversarial review — single finding

1. **[high]** `.junie/playbooks/02-frontend-scaffold.md:126-133, 294` — phase 02 instructed scaffolders to ship a non-hardened `auth.js` with a dummy JWT, and the guardrails reinforced it with an explicit `auth-stub-token` fallback recommendation. The leak test does not catch generic dummy tokens (it scans for one specific sentinel). A scaffolder following pb02 by itself produces the v3 leak class verbatim.

## Brainstorming summary

- Two playbooks contradicting each other on a security-critical surface. The right authority is playbook 04 — that's where the hardened MSAL adapter, the dev-only sentinel-bearing stub, the Vite alias, the placeholder validator, and the build/runtime/regression guards live.
- Phase 02 should NOT generate an `auth.js` at all if MSAL is opted in. Step 3 should wire the MSAL package + env vars and stop there. Phase 04 owns the file emission. Same approach already used for `MockOrchestratorClient.kt` (phase 04 owns ownership but the file is generated in phase 03 because phase-03 tests need it on the classpath — symmetric architectural decision).
- For the "TODO" branch (MSAL deferred), generate a `getToken()` that **throws** rather than returning a dummy. A throw is the only acceptable placeholder: surfaces the gap loudly, blocks any code path that tries to use auth before phase 04 lands.
- Add a new invariant script `scripts/check-auth-policy.mjs` so this drift class fails CI rather than relying on adversarial-review catching it round after round. Forbidden tokens: `STUB-JWT`, `auth-stub-token`, `dummy JWT`, `mocked getToken`, `.catch(() => 'STUB' / 'stub' / 'auth-stub')`. Allowlist legitimate prose mentions ("what NOT to generate").
- Add a new standing rule to `.junie/guidelines.md` codifying the single hardened-auth boundary so future drift surfaces during human review too.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Rewrite playbook 02 Step 3 to delegate auth ownership to phase 04 | `.junie/playbooks/02-frontend-scaffold.md` | "MSAL now" branch no longer generates `auth.js`; "TODO" branch generates a throwing placeholder (no dummy return); env var names align with phase 04 validator |
| 2 | Reword Step 5 guardrail bullet so it points at phase 04's hardened stub instead of recommending a dummy fallback | `.junie/playbooks/02-frontend-scaffold.md` | grep `auth-stub-token` returns 0 matches |
| 3 | Add `scripts/check-auth-policy.mjs` invariant script + new standing rule in guidelines.md | `scripts/check-auth-policy.mjs`, `.junie/guidelines.md` | Script scans 7 playbook files; reports clean; guidelines name the script and the forbidden token list |

## Changes made

- **Playbook 02 Step 3 rewritten.**
  - New leading note: "Auth policy is owned by playbook 04 Steps 4 + 6." Phase 02 does not generate `auth.js` for the MSAL-now branch.
  - "MSAL now" instruction now: wire `@azure/msal-browser` + placeholder config in `main.js`, add env vars, no test in this phase. The env var names corrected: `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_API_SCOPE` — same names playbook 04 Step 6 validates at startup. Removed `VITE_MSAL_TENANT_ID` and `VITE_MSAL_API_SCOPE` (those names diverge from the validator and would be flagged as placeholders).
  - "TODO" instruction unchanged but with explicit "**No dummy/stub return value** — a thrown error is the only acceptable placeholder" callout.
  - Closing paragraph adds the Single-auth-policy invariant as inline guidance: exactly two `auth*.js` files; `auth.js` (hardened delegator) and `auth-stub.js` (dev-only sentinel-bearing). No third file, no inline mock, no catch-and-substitute.
- **Playbook 02 guardrail bullet rewritten.**
  - Old: `MSAL local fallback: If MSAL opted but can't auth, fall back to a dummy token for dev (auth-stub-token). Log a warning.`
  - New: `MSAL local fallback: Owned by playbook 04 Step 4 — Vite resolves @/services/auth to auth-stub.js only when mode in ['development', 'test']. The dev stub token is held module-scoped and bears the pre-committed leak-test sentinel; it is NEVER a generic catch-and-substitute fallback in auth.js or ragApi.js. R8 invariant: getToken() failures throw and surface via the sanitized error rendering in msalConfig.js.`
- **`scripts/check-auth-policy.mjs` (new).**
  - Walks `.junie/playbooks/**/*.md`, scans every line (prose AND code blocks — the original drift was in narrative bullets).
  - Forbidden token list: `STUB-JWT`, `auth-stub-token`, `dummy JWT`, `dummy-token`, `mocked getToken`, three-way variant of the v3 catch-and-substitute pattern (`.catch(() => 'STUB`, `.catch(() => 'stub`, `.catch(() => "STUB`, plus `auth-stub` quoted variants).
  - `ALLOWLIST` set with two entries: legitimate prose mentions of "dummy JWT" and "dummy-token" in playbook 02's "what NOT to generate" callout. Each entry justified inline.
  - Exit codes: 0 clean, 1 with `file:line` + pattern + excerpt for every violation.
  - Comment block at the top names R6/R6a/R8/R11/SC1/SC6 and explicitly cites round-26 as the closed regression so future readers see the historical reason.
- **`.junie/guidelines.md` standing rule added.**
  - New "Single hardened-auth boundary" rule directly below the "Single dev-double activation gate" rule. Names: the two `auth*.js` files, the R8 invariant on `getToken` failure, the new `scripts/check-auth-policy.mjs` script, the forbidden token list summary.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 7 playbook files`).
- `grep -nE 'auth-stub-token|dummy JWT|mocked getToken' .junie/playbooks/*.md` → only matches in playbook 02 Step 3's "what NOT to generate" callout (allow-listed) and the guardrail bullet's prohibition (allow-listed). No code-level instructions to generate forbidden patterns.
- Manual reading confirms playbook 02 + playbook 04 now agree: phase 02 wires MSAL package + env vars; phase 04 emits both `auth.js` (hardened) and `auth-stub.js` (sentinel-bearing). One canonical source of `auth*.js` template.

## Remaining gaps (anticipated for next adversarial round)

- The `check-auth-policy.mjs` allow-list is hand-maintained. If a future iteration adds a third forbidden token to the prose ("what NOT to generate" in a different playbook), the allowlist needs an entry. Backlog candidate: add a comment-tag protocol (`<!-- auth-policy:explanation -->`) so the allowlist can be resolved by tag rather than file:line:pattern.
- The script scans `.junie/playbooks/**/*.md` only; if a future playbook lands in `.junie/guides/` with auth instructions, drift could re-emerge. Codex didn't flag it; backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-26 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
