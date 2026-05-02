# Junie Skill v4 — Iteration 13

**Date:** 2026-05-02
**Loop step:** post-iteration-13

## Pre-iteration state

Codex round 13 grade: **B+** (target: A+). Three new findings (1 medium, 2 low). Round-12 fixes confirmed CLOSED.

## Codex review — key findings (round 13)

1. **[medium]** `.junie/playbooks/03-backend-scaffold.md:133, 269-270, 948-951, 1121-1125` — auth-boundary flaw. Playbook teaches `UserContextBuilder` derives user context from JWT claims, but the OBO test body and the generated API doc both serialize a client-supplied `userContext` field on the request body. Net effect: scaffolders accept browser-supplied identity that overrides the OBO subject and forwards an attacker-chosen `oid` to the orchestrator.
2. **[low]** `.junie/guidelines.md:41` says "32 tests" while playbook 03 now reports 39/39. Count drift survived in guidelines.
3. **[low]** `.junie/playbooks/04-contract-tests.md:260-261, 429-435, 560-563` — `auth.js` calls `hardenedGetToken([import.meta.env.VITE_API_SCOPE])` but `msalConfig.js` startup validator only checks clientId/authority/redirectUri. A missing `VITE_API_SCOPE` falls through silently to `acquireTokenSilent` after the app has already mounted instead of failing at the config-error screen.

## Brainstorming summary

- Finding 1 — three coordinated edits make `UserContext` strictly server-derived:
  (a) UserContext.kt class doc gets a "SERVER-DERIVED ONLY" block, with explicit warning that the request DTO must not include a `userContext` field;
  (b) the OBO test fixture `askRequestBody` drops the `userContext` field and gains a comment explaining why;
  (c) the OpenAPI doc template's request-body example loses the `userContext` field and gains an "Auth-boundary note" pointing readers at `UserContextBuilder` + `JwtAuthenticationToken`. Also fix INTEGRATION_PLAN.md §3.1 (the source-of-truth doc the scaffolder reads) so its request-body example aligns.
- Finding 2 — single edit in guidelines.md to mirror playbook 03's "39 tests; Unit 9 MCP optional" wording.
- Finding 3 — promote `apiScope` to an exported binding from `msalConfig.js`, validate it in the same `validateConfigOrHalt` that gates the other three, update the placeholder error screen, and update `auth.js` to import the validated `apiScope` constant rather than re-reading `import.meta.env`. The single-source pattern keeps a future maintainer from "fixing" the indirection back to `import.meta.env` and silently regressing the validator.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Make `UserContext` server-derived; remove `userContext` from request bodies | `.junie/playbooks/03-backend-scaffold.md`, `INTEGRATION_PLAN.md` | grep `userContext` returns only the function-parameter binding (Kotlin) and explicit "no userContext" prose |
| 2 | Bump test count in guidelines from 32 → 39 (Units 1–8 + 9b) | `.junie/guidelines.md` | grep `32 tests` returns 0 |
| 3 | Validate `VITE_API_SCOPE` at startup; export `apiScope` from msalConfig and use it in `auth.js` | `.junie/playbooks/04-contract-tests.md` | `msalConfig.js` snippet exports `apiScope`; `validateConfigOrHalt` checks list includes it; `auth.js` imports the validated value |

## Changes made

- **UserContext is server-derived only (medium auth-boundary fix)** —
  - `UserContext.kt` data class doc rewritten with a SERVER-DERIVED ONLY block plus a per-field note on `attributes`: it is populated server-side (Graph enrichment / claim mapping), never copied from the request body. The block names the controller path: `RagController` reads `JwtAuthenticationToken` from `ReactiveSecurityContextHolder` and hands it to `UserContextBuilder`.
  - `OboValidationTest.askRequestBody` fixture lost the `"userContext" to emptyMap()` entry and gained a leading comment explaining why omission is intentional. Now matches the production request shape.
  - OpenAPI doc template request-body example dropped the `userContext` field. Replaced with an "Auth-boundary note" paragraph that states `UserContext` is built server-side from JWT claims by `UserContextBuilder`, names the test (`OboValidationTest`) that validates the wire shape, and explicitly forbids client-supplied identity.
  - `INTEGRATION_PLAN.md §3.1` request example aligned: `userContext` field removed from JSON body; new auth-boundary note added directly below the request block calling out that `UserContext` is server-derived.
- **Guidelines test count alignment (low)** — `.junie/guidelines.md:41` changed from "9 units, 32 tests" to "Units 1–8 + Unit 9b dev-double/OBO, 39 tests; Unit 9 MCP optional", mirroring playbook 03's wording.
- **`VITE_API_SCOPE` validated at startup (low)** —
  - `msalConfig.js` snippet now reads `import.meta.env.VITE_API_SCOPE` into an exported `apiScope` constant (above the `msalConfig` object, with a comment explaining why).
  - `validateConfigOrHalt` checks list gained a fourth entry: `['apiScope', apiScope]`.
  - The placeholder error screen now lists `VITE_API_SCOPE` alongside the other three vars.
  - `auth.js` adapter now imports `apiScope` from `msalConfig.js` and calls `hardenedGetToken([apiScope])` (instead of re-reading the env var). Comment warns a future reader against undoing the indirection.
  - Troubleshooting "To wire real auth" section updated: lists all four env vars and notes that all four are validated at startup, gating app mount.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n 'userContext' .junie/playbooks/03-backend-scaffold.md` → 4 matches: `userContext` parameter on the Kotlin `OrchestratorClient.askOrchestrator` interface (correct — the parameter still exists; only the request body shouldn't carry it), 2 prose explanations, and one explicit "no userContext field" callout.
- `grep -n 'userContext' INTEGRATION_PLAN.md` → 0 matches.
- `grep -n 'userContext' .junie/playbooks/04-contract-tests.md` → 0 matches (was 0 already; included for completeness).
- `grep -n '32 tests' .junie/guidelines.md` → 0 matches.
- `grep -n 'apiScope' .junie/playbooks/04-contract-tests.md` → 4 matches: declaration, validator entry, `auth.js` import, comment. All four lines coherent.
- `grep -n 'VITE_API_SCOPE' .junie/playbooks/04-contract-tests.md` → 5 matches across config read, comments, error-screen instructions, troubleshooting. No bare `import.meta.env.VITE_API_SCOPE` survives outside the validated read in `msalConfig.js`.

## Remaining gaps (anticipated for next loop)

- The OpenAPI doc auto-extracted from controllers will only match the trimmed request shape if `RagController` (Unit 7) defines `AskRequest` without a `userContext` field. The playbook narratively forbids it but does not generate the `AskRequest` data class in the diff scope this iteration touched. Backlog: confirm Unit 7's `AskRequest` definition, and add a regression test asserting it has only `ask` + `conversationId` fields.
- INTEGRATION_PLAN.md still references the orchestrator's request schema (§3.2) which may itself accept `userContext` in its current upstream contract. The skill scaffolds the **proxy** layer; the proxy strips client-supplied identity and substitutes the JWT-derived one before forwarding to the orchestrator. That mapping is implicit in the playbook narrative and is not currently asserted by a test. Backlog: add a `RagControllerTest` assertion that the WebClient body forwarded to the orchestrator carries the JWT-derived UserContext, ignoring whatever the inbound request body might contain.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-13 changes.
- Re-run Codex adversarial review (round 14).
- Compare grade. Target A+.
