# Junie Skill v4 — Iteration 03

**Date:** 2026-05-02
**Loop step:** post-iteration-3 (review → brainstorm → plan → execute → re-review)

## Pre-iteration state

Codex round 3 grade: **needs-attention** (no letter; "No-ship") with 2 high findings — both about iteration-2 code.

## Codex review — key findings (round 3)

1. **[high]** Classpath scan filter regex matches zero classes (`.junie/playbooks/03-backend-scaffold.md:391-394`). Iteration 2 wrote `RegexPatternTypeFilter(Pattern.compile(".*\\.($devDoubleNamePattern).*"))`. Kotlin string-templated `Pattern.toString()` returns the source `^(Mock|Stub|...)`, so the resulting filter regex is `.*\\.(^(Mock|...)).*`. The `^` anchor cannot match after a package dot. Filter returns zero candidates; supposedly load-bearing classpath layer is vacuous.
2. **[high]** OBO test exercises GET against POST endpoint (`.junie/playbooks/03-backend-scaffold.md:670-708`). All six WebTestClient assertions call `.get().uri("/api/rag/ask")`, but `RagController` is `POST /api/rag/ask` per playbook + INTEGRATION_PLAN. With `anyExchange().authenticated()`, missing/bad tokens still 401 before routing, but valid-token case probably returns 404/405 — implementer might add a GET handler just to satisfy the test, eroding confidence in the real POST SSE boundary.

## Brainstorming summary

- Finding 1 — fix the regex bug AND prevent regression:
  - Replace the broken interpolated filter with a match-all filter (`Pattern.compile(".*")`); apply the simple-name match in Kotlin AFTER scanning. Eliminates the anchor-mis-interpolation class entirely.
  - Add a regex self-test method asserting positive/negative cases (catches future refactors that re-break the regex).
  - Add a third test method that runs the scanner against a synthetic test-tree fixture (`com.example._devdoublescantestfixtures.MockSyntheticDouble`) and asserts the scanner finds it. If the filter is broken, this test fails.
  - Commit the synthetic fixture in the test tree (NOT production) so it doesn't trip the production gate.
- Finding 2 — switch to POST with body:
  - All six assertions use POST with `application/json` body matching `AskRequest` shape from INTEGRATION_PLAN §3.1, plus `Accept: text/event-stream`.
  - Extract `postWithAuth(token)` / `postWithoutAuth()` helpers to keep test bodies tight.
  - Set `app.dev-doubles.enabled=true` via `@DynamicPropertySource` so MockOrchestratorClient provides the 200 SSE response for the valid-JWT case. Document that this property is intentionally enabled here (the dev-double gate test is in a different class with the property unset).
  - Tighten valid-JWT assertion: `expectStatus().isOk` + `expectHeader().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM)` proves the request reached the SSE handler.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Fix `DevDoubleClasspathScanTest` filter regex; add self-tests + synthetic fixture | `.junie/playbooks/03-backend-scaffold.md` | Match-everything filter present; regex self-test method present; fixture file in playbook Files list |
| 2 | Switch `OboValidationTest` to POST with body + SSE accept header; activate mock orchestrator for valid-JWT case | `.junie/playbooks/03-backend-scaffold.md` | Zero `.get().uri("/api/rag/ask")` calls in OBO test; POST helper used; `app.dev-doubles.enabled=true` set via dynamic property |

## Changes made

- **`.junie/playbooks/03-backend-scaffold.md` Step C (`DevDoubleClasspathScanTest`)**:
  - Replaced broken interpolated filter regex with `RegexPatternTypeFilter(Pattern.compile(".*"))` (match-all). Simple-name filtering now happens in Kotlin via `devDoubleNamePattern.matcher(simpleName).find()`, which correctly applies the anchor against the simple name.
  - Added `dev-double name regex matches expected positives and rejects negatives (iteration-2 anchor regression guard)` test method with pinned positive/negative matrix.
  - Added `classpath scanner returns at least the known-ungated synthetic dev-double when no @DevOnlyBean is present (regression for filter-anchor bug)` test method that exercises the same scanner pipeline against a synthetic fixture package.
  - Added `MockSyntheticDouble.kt` fixture (committed under `src/test/kotlin/com/example/_devdoublescantestfixtures/` — test tree only, NOT production).
  - Updated narrative comments warning future maintainers not to interpolate the anchored Pattern back into a FQCN regex.

- **`.junie/playbooks/03-backend-scaffold.md` Step E (`OboValidationTest`)**:
  - All six WebTestClient calls switched from `.get()` to `.post()`.
  - Added `askRequestBody` constant matching `AskRequest` JSON shape from INTEGRATION_PLAN §3.1.
  - Extracted `postWithoutAuth()` and `postWithAuth(token)` helpers.
  - Added `Accept: text/event-stream` header.
  - Added `Content-Type: application/json` header.
  - Added `app.dev-doubles.enabled=true` to `@DynamicPropertySource` so MockOrchestratorClient provides a working 200 SSE response for the valid-JWT case. Documented the intentional cross-test isolation (dev-double gate test in a separate class with the property unset).
  - Tightened valid-JWT assertion: `isOk` + content-type-compatible-with `text/event-stream`.
  - Renamed valid-JWT test to `valid JWT reaches the POST handler successfully` (prose matches Codex's recommended wording).

- **Files list** updated to include the synthetic fixture file.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `webClient.get().uri("/api/rag/ask")` count = 0.
- `webClient.post().uri("/api/rag/ask")` count = 1 (helper).
- `Pattern.compile(".*")` count = 2 (production scan + regression test scanner).
- "iteration-2 anchor regression guard" prose count = 1.
- `MockSyntheticDouble` references = 7 (test code + fixture file + Files list + narrative).
- `registry.add("app.dev-doubles.enabled")` count = 1 (in OBO test only).
- `TEXT_EVENT_STREAM` count = 2 (request Accept + response content-type assertion).

## Remaining gaps (anticipated for next loop)

- The synthetic fixture `MockSyntheticDouble.kt` is required for the regression test to pass; if scaffolders skip the fixture, the test fails with a clear error (which is the correct behavior). Documented but flag as "must be committed alongside the test class."
- Iteration 3 added 3 test methods to `DevDoubleClasspathScanTest`. If the regression test on synthetic fixture is the only direct regression guard for the filter regex, future refactors could still re-introduce a vacuous filter shape — the regex self-test catches the simple-name pattern itself, and the synthetic-fixture test catches the scanner+filter pipeline. Two layers should be sufficient.
- Unit 7b (real-target Junie scaffold) still deferred. Codex re-review may continue to note this but it is a deliberate plan deferral, not a defect.
- `app.dev-doubles.enabled=true` set in `OboValidationTest` `@DynamicPropertySource` — Codex may flag that this means OBO test depends on `MockOrchestratorClient` registering. The trade-off is documented inline; the alternative (asserting `expectStatus().value(s != 401)`) would be looser. Standing by current choice.

## Next loop actions

- Commit + push iteration-3 changes.
- Re-run Codex adversarial review.
- Compare grade vs needs-attention baseline. Target A+.
