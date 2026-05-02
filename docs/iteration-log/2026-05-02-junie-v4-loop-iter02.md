# Junie Skill v4 — Iteration 02

**Date:** 2026-05-02
**Loop step:** post-iteration-2 (review → brainstorm → plan → execute → re-review)

## Pre-iteration state

- After iteration 1: 3 D+ findings closed (WebFlux stack, single dev-double gate, concrete OBO fixtures + invariant scripts).
- Codex round 2 grade: **needs-attention** (no letter; "No-ship") with 2 high findings — both about the new code introduced in iteration 1.

## Codex review — key findings (round 2)

1. **[high]** `OboValidationTest` WireMock lifecycle bug (`.junie/playbooks/03-backend-scaffold.md:535-556`). `@DynamicPropertySource` runs while Spring builds the application context — **before** JUnit `@BeforeAll`. The supplier reads `wireMock.baseUrl()` against a not-yet-started server. Result: Spring binds an unusable JWKS URI; the OBO test either crashes during context startup or wires a broken decoder, turning the six WebTestClient assertions into a vacuous pass.
2. **[high]** `DevDoubleGateTest` slice is empty (`.junie/playbooks/03-backend-scaffold.md:273-274`). The placeholder `AutoConfigurations.of(/* the production config slice under test */)` left no concrete config in the slice. `ApplicationContextRunner` does not component-scan; without `withUserConfiguration(...)` the slice has no beans. Both the annotation lookup and the regex check pass against an empty context — a vacuous pass that doesn't enforce the single-gate invariant.

## Brainstorming summary

- Finding 1 — fix lifecycle ordering. Two approaches:
  - (a) `@RegisterExtension static WireMockExtension` — cleanest but requires a JUnit-Jupiter-aware WireMock artifact.
  - (b) `init { wireMock.start(); ... }` block on the `companion object`. Static initializer runs at class-load, **before** Spring touches `@DynamicPropertySource`. Works with the existing `wiremock-jre8` artifact. Add a JVM shutdown hook for cleanup; idempotent across re-loads.
  - Picked (b) — simpler, no extra dependency, deterministic.
- Finding 2 — two-layer enforcement:
  - Replace placeholder with explicit `withUserConfiguration(DevDoublesConfig::class.java, MockOrchestratorClient::class.java, ...)` enumerating every dev-double config in the project. Add a positive integration assertion (with the property set, dev doubles DO load).
  - Add a SECOND test (`DevDoubleClasspathScanTest`) that uses `ClassPathScanningCandidateComponentProvider` to walk the production classpath at the bytecode level — entirely independent of any Spring slice. Catches the case where a dev double exists in source but was forgotten in the slice. This is the **load-bearing** layer.
  - Document an `allowList` for legitimate false positives (e.g., `MockingjayController`) with a one-line justification per entry.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Fix WireMock startup vs `@DynamicPropertySource` ordering | `.junie/playbooks/03-backend-scaffold.md` (Step E) | Static `init {}` on companion object visible; comment explains lifecycle; shutdown hook present |
| 2 | Two-layer dev-double enforcement: real slice + classpath scan | `.junie/playbooks/03-backend-scaffold.md` (Step C) | `withUserConfiguration` populated; `DevDoubleClasspathScanTest` defined with `ClassPathScanningCandidateComponentProvider` + allow-list pattern |
| 3 | Update Files list, commit pattern, verification table | `.junie/playbooks/03-backend-scaffold.md` (Files / Step F / Step G) | New test class names propagate everywhere |

## Changes made

- **`.junie/playbooks/03-backend-scaffold.md`:**
  - **Step E (`OboValidationTest.kt`)**: rewrote the companion object. Removed `@BeforeAll`/`@AfterAll`; replaced with a static `init {}` block that calls `wireMock.start()` + `JwtTestKit.stubJwks(wireMock)` AT CLASS-LOAD TIME, before `@DynamicPropertySource`. Added a JVM shutdown hook for cleanup. Added a "LOAD-BEARING" comment block explaining the lifecycle constraint and warning future maintainers not to move the logic into `@BeforeAll`.
  - **Step C (`DevDoubleGateTest`)**: replaced placeholder `AutoConfigurations.of(/* ... */)` with explicit `withUserConfiguration(DevDoublesConfig::class.java, MockOrchestratorClient::class.java, ...)`. Added a third test method asserting the positive integration case (`app.dev-doubles.enabled=true` → dev-double beans DO register).
  - **Step C (NEW `DevDoubleClasspathScanTest.kt`)**: zero-Spring-context test using `ClassPathScanningCandidateComponentProvider` with a regex include filter. Walks `com.example` package at bytecode level. Asserts every class whose simple name matches `(?i)^(Mock|Stub|Fake|Spy|Dummy|TestDouble|InMemory|Noop)` either carries `@DevOnlyBean` OR appears in `allowList` with justification.
  - **Step C narrative**: prefixed with a two-row table explaining "why two tests" — the classpath scan is load-bearing because `ApplicationContextRunner` does not component-scan and the slice can be incomplete.
  - **Files list**: added `DevDoubleClasspathScanTest.kt` and `JwtTestKit.kt` (the kit was added in iter 1 but missed from the file list).
  - **Step F (commit pattern)**: expanded from 4 commits to 7 to surface the new test class.
  - **Step G (verification)**: added explicit "fails the build when…" rows for `DevDoubleClasspathScanTest`, expanded the `OboValidationTest` row with the WireMock-startup invariant.

## Verification

- `node scripts/check-r5-invariant.mjs` → `R5 invariant: clean (0 violations across 7 playbook files).`
- `node scripts/check-stack-invariant.mjs` → `Stack invariant: clean (0 violations across 7 playbook files).`
- Static initializer block (`init {`) present in `OboValidationTest` companion object.
- Placeholder `AutoConfigurations.of(/* the production config slice under test */)` removed (count = 0).
- `withUserConfiguration` referenced 4× in playbook (slice config + narrative).
- `ClassPathScanningCandidateComponentProvider` referenced 4× (test class + narrative + import).
- `DevDoubleClasspathScanTest` referenced 11× across the playbook (definition, narrative, file list, commits, verification table).
- `addShutdownHook` referenced 1× (the WireMock cleanup path).

## Remaining gaps (anticipated for next loop)

- WireMock `wiremock-jre8` 2.35.0 pinned literal — version drift if Spring Boot 3.x bumps minimum JDK. Acceptable for v4; flag for v4.1.
- `JwtTestKit.MALFORMED` is a `const val String` — works in Kotlin even though `JWTClaimsSet.Builder().jwtID(UUID.randomUUID().toString())` produces non-deterministic JWTs each call. The forged/wrong-aud/wrong-iss tokens regenerate per test (different `jti`) — fine for assertion semantics, but means logs aren't reproducible. Cosmetic.
- `DevDoubleClasspathScanTest` only checks class-level `@DevOnlyBean`; `@Bean`-method-level `@DevOnlyBean` won't be reflected in the bytecode-level scan. Acceptable — the Spring slice catches that case.
- Unit 7b (real-target Junie scaffold) still deferred. Codex re-review will likely note this as residual.

## Next loop actions

- Commit + push iteration-2 changes.
- Re-run Codex adversarial review.
- Compare grade vs needs-attention baseline. Target A+.
