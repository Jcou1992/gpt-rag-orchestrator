# Junie Skill v4 — Iteration 38

**Date:** 2026-05-02
**Loop step:** post-iteration-38 (adversarial)

## Pre-iteration state

Round 38 verdict: **needs-attention**. Iter-37's CORS hardening required a coordinated property pass through every Spring test that boots a context AND the troubleshooting docs. Codex caught two misses:

1. SecurityBeansPresentTest (Step D in Unit 9b) supplied only `app.entra.*` properties — context fails to start with unresolved `app.cors.allowed-origins` placeholder before any assertion runs.
2. CORS troubleshooting doc told users to set `spring.web.cors.allowed-origins` (Spring's default property namespace), but the scaffolded `corsConfigurationSource()` reads `app.cors.allowed-origins`. Following the recovery instructions wouldn't fix the actual misconfig.

## Codex adversarial review — findings

1. **[high]** `.junie/playbooks/03-backend-scaffold.md:712-722` — SecurityBeansPresentTest missing `app.cors.allowed-origins`.
2. **[medium]** `.junie/playbooks/04-contract-tests.md:909-918` — troubleshooting doc points at the wrong property namespace.

## Brainstorming summary

- For (1): one-line fix in the `properties = [...]` block. Same pattern OboValidationTest already uses (round 37 added the property there).
- For (2): rewrite the troubleshooting block to (a) call out that the scaffolded `corsConfigurationSource()` does NOT read Spring's defaults, (b) give the YAML form using `app.cors.allowed-origins`, (c) give the env-var form `APP_CORS_ALLOWED_ORIGINS` for production. Add a pointer to where Methods/Headers are configured.
- Bonus pass: the bootRun invocations in playbook 04 / 05 use `--spring.profiles.active=mock` against a scaffolded `application.yml` whose `app.cors.allowed-origins` is `${APP_CORS_ALLOWED_ORIGINS}` with no default. Add a default in `application-mock.yml` so the documented offline-dev workflow starts without requiring the env var; production never loads `mock`.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | SecurityBeansPresentTest gains `app.cors.allowed-origins=http://localhost:5173` in `properties` | `.junie/playbooks/03-backend-scaffold.md` | Comment names round-38 closure; matches OboValidationTest pattern |
| 2 | Rewrite CORS troubleshooting to point at `app.cors.allowed-origins` and `APP_CORS_ALLOWED_ORIGINS` | `.junie/playbooks/04-contract-tests.md` | grep `spring.web.cors` returns 0; new YAML/env-var forms align with SecurityConfig binding |
| 3 | Add `app.cors.allowed-origins` default to `application-mock.yml` | `.junie/playbooks/04-contract-tests.md` | Mock profile starts without the env var; production posture unchanged |

## Changes made

- **SecurityBeansPresentTest.kt @SpringBootTest properties.**
  - Added `"app.cors.allowed-origins=http://localhost:5173"` line to the `properties = [...]` array. Comment block notes the property is required for context startup; values are not exercised by this test.
- **CORS troubleshooting rewrite.**
  - Replaced the YAML block (`spring.web.cors.allowed-origins`) with two correct forms: `app.cors.allowed-origins` in YAML and `APP_CORS_ALLOWED_ORIGINS` as env var.
  - Added explicit "the scaffolded `SecurityConfig.kt` reads `app.cors.allowed-origins` (NOT Spring's `spring.web.cors.*` namespace — Spring's defaults are not what the custom `corsConfigurationSource()` consults)" callout so future readers don't try `spring.web.cors.*` first.
  - Added a pointer to `SecurityConfig.corsConfigurationSource()` for Methods/Headers customization.
- **application-mock.yml CORS default.**
  - New `app.cors.allowed-origins: http://localhost:5173` block. Comment explicitly says "dev convenience only" and notes production never loads the mock profile.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS.
- `grep -n 'spring.web.cors' .junie/playbooks/*.md` → 0 matches.
- `grep -n 'app.cors.allowed-origins' .junie/playbooks/*.md` → 5 matches: SecurityConfig binding (pb03), application.yml example (pb03), SecurityBeansPresentTest (pb03), OboValidationTest (pb03), application-mock.yml (pb04), troubleshooting doc (pb04). Property name consistent across all sites.

## Remaining gaps (anticipated for next adversarial round)

- Other tests that boot a Spring context (e.g., a future RagControllerTest) will hit the same issue. Backlog: a small reusable test-properties constant or `@TestPropertySource` companion file that every Spring test can import.
- The `application-mock.yml` default uses `http://localhost:5173` (Vite default port). If the scaffolded frontend uses a different dev port (e.g., 3000), the dev override would mismatch. Comment notes the value but doesn't parameterize. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-38 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
