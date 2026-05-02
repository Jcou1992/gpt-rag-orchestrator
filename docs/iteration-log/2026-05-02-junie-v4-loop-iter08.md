# Junie Skill v4 — Iteration 08

**Date:** 2026-05-02
**Loop step:** post-iteration-8

## Pre-iteration state

Codex round 8 grade: **needs-attention** ("No-ship") with 2 high findings.

## Codex review — key findings (round 8)

1. **[high]** Generated Kotlin assertions are emitted as property reads — `assertThat(x).isNotEmpty` (no parens), same for `.isTrue`/`.isFalse` and Spring WebTestClient `.isOk`/`.isUnauthorized`. AssertJ + Spring methods need explicit invocation in Kotlin; bare names are property references and the test sources fail compilation.
2. **[high]** Iteration-7 narrative said the classpath-scan test was the safety net for omitted `@Bean`-method dev doubles. False — `ClassPathScanningCandidateComponentProvider` only sees stereotyped CLASSES; method-level `@DevOnlyBean` markers are invisible to it. A `@Configuration class DevDoublesConfig { @Bean fun fakeAuthClient() = ... }` with `@DevOnlyBean` on the method but the config class omitted from the slice would pass both layers vacuously.

## Brainstorming summary

- Finding 1 — audit every AssertJ + Spring assertion in the playbook for missing parens; fix all. Likely candidates: `.isNotEmpty`, `.isEmpty`, `.isTrue`, `.isFalse`, `.isOk`, `.isUnauthorized`, `.isForbidden`.
- Finding 2 — close the @Bean-method gap with a third sub-test in `DevDoubleClasspathScanTest`:
  - Walk all `@Configuration` classes via `ClassPathScanningCandidateComponentProvider` + `AnnotationTypeFilter(Configuration::class.java)`.
  - Reflect on each class's declared methods.
  - Filter by `@Bean`-annotated AND method-name matching the dev-double regex.
  - Assert each carries `@DevOnlyBean`.
  - Update Step H verification table to enumerate the third check.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `()` to every no-paren AssertJ + Spring WebTestClient assertion | `.junie/playbooks/03-backend-scaffold.md` | grep for `.isNotEmpty$` / `.isTrue$` / `.isFalse$` / `.isOk$` / `.isUnauthorized$` returns 0 |
| 2 | Add `@Bean`-method scan test method to `DevDoubleClasspathScanTest` + add imports for `Bean`, `Configuration`, `AnnotationTypeFilter` | `.junie/playbooks/03-backend-scaffold.md` | New test method present; 3 new imports |
| 3 | Update Step H verification table to enumerate the new @Bean-method check | `.junie/playbooks/03-backend-scaffold.md` | Verification table mentions all 3 checks |

## Changes made

- **Assertion syntax fixes** — added `()` to:
  - 3× `.isNotEmpty()` (DevDoubleGateTest positive integration check + 2× SecurityBeansPresentTest assertions)
  - 1× `.isTrue()` (DevDoubleClasspathScanTest regex self-test positive matrix)
  - 1× `.isFalse()` (DevDoubleClasspathScanTest regex self-test negative matrix)
  - 5× `.isUnauthorized()` (OboValidationTest five 401 assertions)
  - 1× `.isOk()` (OboValidationTest valid-JWT assertion)
- **`DevDoubleClasspathScanTest`** — added a new test method `every @Bean method whose name matches the dev-double regex carries @DevOnlyBean (covers config-method case the class-level scan misses)`. The method:
  - Builds a second scanner with `AnnotationTypeFilter(Configuration::class.java)` to walk every production `@Configuration` class.
  - For each class, reflects on `declaredMethods`, filters by `@Bean`-annotated AND name matching `devDoubleNamePattern`.
  - Asserts each matching method carries `@DevOnlyBean`. Fails the build with the offending `ConfigClass.methodName()` enumeration if any are bare.
- Added 3 imports to support the new test: `org.springframework.context.annotation.Bean`, `org.springframework.context.annotation.Configuration`, `org.springframework.core.type.filter.AnnotationTypeFilter`.
- **Step H verification table** rewrote the `DevDoubleClasspathScanTest` row from one bullet to three bullets, enumerating each independent check the test layer now performs.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -E '\.(isNotEmpty|isEmpty|isTrue|isFalse|isOk|isUnauthorized|isForbidden)$'` → 0 matches.
- Method-call counts: `.isNotEmpty()` ×3, `.isUnauthorized()` ×5, `.isOk()` ×1, `.isTrue()` ×1, `.isFalse()` ×1.
- New test method `every @Bean method whose name matches the dev-double regex carries @DevOnlyBean` present.
- `AnnotationTypeFilter` count = 2 (import + use).

## Remaining gaps (anticipated for next loop)

- The new @Bean-method scan reflects only on `declaredMethods`; methods inherited from a parent `@Configuration` class would be missed. Edge case; unlikely in scaffolded code.
- Spring's `Bean` annotation is on the import path `org.springframework.context.annotation.Bean` — if Spring Boot ever moves it (very unlikely), the test breaks. Pinned for current Spring Boot 3.x.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-8 changes.
- Re-run Codex adversarial review.
- Compare grade. Target A+.
