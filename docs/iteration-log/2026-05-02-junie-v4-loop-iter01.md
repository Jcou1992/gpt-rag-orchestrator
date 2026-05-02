# Junie Skill v4 — Iteration 01

**Date:** 2026-05-02
**Loop step:** post-iteration-1 (review → brainstorm → plan → execute → re-review)

## Pre-iteration state

- v4 (commits `3299c33` → `13eea2c`) shipped artifact-complete with Unit 7a SCs PASS within static envelope.
- Codex round 1 grade: **D+** with 3 findings.

## Codex review — key findings (D+ baseline)

1. **[high]** Servlet security in WebFlux scaffold (`.junie/playbooks/03-backend-scaffold.md:333-363`) — `HttpSecurity` / `SecurityFilterChain` / `JwtDecoder` / `MockMvc` shipped in templates that target a Kotlin + WebFlux backend. Generated code either fails to compile or wires the wrong runtime path.
2. **[high]** Mock orchestrator bypasses dev-double gate (`.junie/playbooks/04-contract-tests.md:137-140`) — `MockOrchestratorClient` gated by standalone `orchestrator.mock-enabled` property, not the central `@DevOnlyBean` / `app.dev-doubles.enabled` gate. Second activation path defeats the v4 invariant.
3. **[medium]** OBO test fixtures are TODO placeholders (`.junie/playbooks/03-backend-scaffold.md:419-425`) — `forgedJwt`, `wrongAudienceJwt`, `wrongIssuerJwt`, `validJwt` initialized with `TODO(...)`. Test class throws on construction; no JWT rejection actually proven.

## Brainstorming summary

- Finding 1: needs full template rewrite to reactive equivalents — `ServerHttpSecurity`, `SecurityWebFilterChain`, `ReactiveJwtDecoder`, `NimbusReactiveJwtDecoder`, `WebTestClient`. Add `@EnableWebFluxSecurity`. Replace `MockMvc` test stack with `WebTestClient`.
- Finding 2: drop `orchestrator.mock-enabled`, route mock through `@DevOnlyBean`. Update `application-mock.yml` to use `app.dev-doubles.enabled=true`. Cross-reference between playbooks so the single-gate invariant is documented in both places.
- Finding 3: ship a deterministic JWT/JWKS fixture builder (`JwtTestKit.kt`) with two RSA keypairs (legitimate published in JWKS, attacker never published) + WireMock. Replace TODOs with calls to the kit; prove forged-by-wrong-key path.
- Hardening for A+: stack-invariant script (`scripts/check-stack-invariant.mjs`) that fails the build if any servlet import appears in a Kotlin/Java code block under `.junie/playbooks/**`. Surface in `guidelines.md` standing rules. Update Unit 9b header with non-negotiable stack constraint.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Convert SecurityConfig template to WebFlux reactive | `.junie/playbooks/03-backend-scaffold.md` | Stack invariant clean; servlet imports = 0 in Kotlin code blocks |
| 2 | Unify dev-double gate; drop `orchestrator.mock-enabled` | `.junie/playbooks/04-contract-tests.md` | Mock orchestrator carries `@DevOnlyBean`; `application-mock.yml` uses `app.dev-doubles.enabled` only |
| 3 | Concrete `JwtTestKit` + WebTestClient `OboValidationTest` | `.junie/playbooks/03-backend-scaffold.md` | Zero `TODO(` inside Kotlin blocks; all 6 JWT scenarios concrete |
| 4 | Cross-cutting: stack invariant script + guidelines update | `scripts/check-stack-invariant.mjs` (new), `.junie/guidelines.md` | Both invariants run clean |

## Changes made

- `.junie/playbooks/03-backend-scaffold.md`:
  - Unit 9b header: added "Stack constraint (read first — non-negotiable)" block listing reactive types as required and servlet types as forbidden.
  - Step D (SecurityConfig.kt): rewritten with `ServerHttpSecurity` + `SecurityWebFilterChain` + `@EnableWebFluxSecurity` + `ReactiveJwtDecoder` + `NimbusReactiveJwtDecoder`. Reactive `authorizeExchange` + `oauth2ResourceServer { jwt { jwt.jwtDecoder(reactiveJwtDecoder()) } }`.
  - Step E split into two artifacts:
    - **NEW** `JwtTestKit.kt` — RSA keypair generator (Nimbus JOSE), JWKS publisher (WireMock stub), signed-JWT helpers for valid/forged/wrong-aud/wrong-iss tokens. Forged path uses an attacker keypair never published in JWKS.
    - `OboValidationTest.kt` — rewritten with `@SpringBootTest(webEnvironment = RANDOM_PORT)`, `WebTestClient`, `WireMockServer` lifecycle in `@BeforeAll`/`@AfterAll`, `@DynamicPropertySource` for property binding. All 6 scenarios concrete; zero TODOs.
  - Added explicit `build.gradle.kts` dependency list (Nimbus JOSE 9.40, WireMock 2.35.0, reactor-test, security-test).

- `.junie/playbooks/04-contract-tests.md`:
  - Step 3 (Mock orchestrator): rewrote section with single-gate framing. `MockOrchestratorClient` carries `@DevOnlyBean`; `application-mock.yml` uses `app.dev-doubles.enabled: true`. Cross-references `DevDoubleGateTest` and explicitly forbids parallel switches.
  - Communication-fallbacks section: removed alternative `orchestrator.mock-enabled` path; replaced with single-gate reminder.

- `.junie/guidelines.md`:
  - Added two new standing rules: reactive Spring stack lock (with full forbidden-imports list) and single dev-double activation gate (`app.dev-doubles.enabled` only, `@DevOnlyBean` mandatory).

- `scripts/check-stack-invariant.mjs` (new): zero-dependency Node ESM script. Walks `.junie/playbooks/**/*.md`, extracts Kotlin/Java fenced blocks, fails the build if any forbidden token (servlet imports, MockMvc, `@AutoConfigureMockMvc`, `jakarta.servlet`, `javax.servlet`, etc.) appears.

## Verification

- `node scripts/check-r5-invariant.mjs` → `R5 invariant: clean (0 violations across 7 playbook files).`
- `node scripts/check-stack-invariant.mjs` → `Stack invariant: clean (0 violations across 7 playbook files).`
- `ajv` validation of canonical schema + sidecar fixture: all 5 events validate.
- WebFlux types present in playbook 03: `ServerHttpSecurity` (5), `SecurityWebFilterChain` (4), `ReactiveJwtDecoder` (8), `NimbusReactiveJwtDecoder` (4), `WebTestClient` (5), `@EnableWebFluxSecurity` (1).
- Servlet types absent in Kotlin code blocks (regex prose mentions are excluded by the script's block-aware extraction).
- `TODO(` inside Kotlin code blocks: 0. Sole match is the narrative line "No `TODO(...)` placeholders" — explanatory prose, not code.
- `orchestrator.mock-enabled=true` literal: 0. Remaining mentions are narrative prohibitions.

## Remaining gaps (anticipated for next loop)

- Unit 7b (real-target Junie scaffold) still deferred — no IntelliJ workspace this session. Codex re-review will likely note this as residual.
- `JwtTestKit` uses Nimbus JOSE 9.40 pinned literal — version drift risk if Spring Boot 3.x bumps.
- `application-mock.yml` example uses `${ORCHESTRATOR_API_KEY:mock-key}` env-var fallback. Plan v4.1 backlog flags API-key lifecycle as a v4.1 candidate; this iteration nudges it without fully closing.
- `DevDoubleGateTest` integration check (positive case with `app.dev-doubles.enabled=true`) was already written in v4 round 1; iteration 1 only covered the Mock client path explicitly in narrative.

## Next loop actions

- Commit + push the iteration-1 changes.
- Re-run Codex adversarial review against `origin/main`.
- Compare grade vs D+ baseline. Continue loop until A+.
