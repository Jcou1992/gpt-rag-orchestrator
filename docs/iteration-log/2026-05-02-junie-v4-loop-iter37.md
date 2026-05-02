# Junie Skill v4 — Iteration 37

**Date:** 2026-05-02
**Loop step:** post-iteration-37 (adversarial)

## Pre-iteration state

Round 37 adversarial verdict: **needs-attention** with TWO **high** + ONE **medium** finding. The reviewer pivoted from the auth-regex bypass class (now several rounds deep) to scaffold templates that would fail at runtime and an auth-regex shape the iter-36 widening still missed:

1. **[high]** `ragApi.js` template called `fetch('/api/rag/ask', ...)` — relative URL hits the frontend origin in a production split-deploy, not the backend.
2. **[high]** `SecurityConfig.kt` template disabled CSRF + required `anyExchange().authenticated()` but never enabled CORS or permitted `OPTIONS` preflight. A real cross-origin browser request dies on preflight 401 before the actual POST runs.
3. **[medium]** Iter-36's `[^){}]*?` gap excluded `{` and `}`, so a comment containing `{` (e.g., `/* fallback {tok} */`) defeated the function-expression regex. Same class: comment-prefixed arrow handler `.catch(/* fallback */ () => x)` slipped past the arrow regex too.

## Codex adversarial review — findings

1. `.junie/playbooks/04-contract-tests.md:313` — relative-URL fetch.
2. `.junie/playbooks/03-backend-scaffold.md:795-806` — missing CORS / OPTIONS-preflight.
3. `scripts/check-auth-policy.mjs:117-118` — brace-in-comment + comment-prefixed arrow bypass.

## Brainstorming summary

- **ragApi**: build endpoint from `import.meta.env.VITE_RAG_API_URL` via `new URL('/api/rag/ask', API_BASE)`. The constructor throws synchronously for missing/malformed base — fail-loud beats silent wrong-origin requests. The `msalConfig.js` placeholder validator already gates `VITE_RAG_API_URL` indirectly via the same env-var family; documenting it explicitly here fails on placeholder values too.
- **CORS**: WebFlux requires `cors {}` in the `ServerHttpSecurity` chain plus a `CorsConfigurationSource` bean. Use a property `app.cors.allowed-origins` (List<String>); no wildcard fallback so a missing prop fails the bind. Permit OPTIONS at the auth filter explicitly even though the cors() filter handles preflights — defense-in-depth survives a future refactor that strips cors().
- **Comment-stripping**: simplest fix for both bypass shapes — strip JS comments from the file content BEFORE applying the multiline regexes. Replace block comments with whitespace of the same byte length so line numbers stay correct. Substring/line-scoped rules continue to scan the RAW text so forbidden tokens hidden in comments still flag.
- **Avoid stripping URLs**: the `// ...` line-comment regex must not eat `https://...`. Use a negative-lookbehind via capture group `(^|[^:\\])\/\/...` so the `:` in URL schemes is preserved.
- **Tests**: add a CORS preflight WebTestClient assertion to `OboValidationTest` that sends `OPTIONS /api/rag/ask` from a browser origin without a Bearer token and expects 200 with the `Access-Control-Allow-*` headers. Add `app.cors.allowed-origins` to `@DynamicPropertySource` so the slice context starts.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Build `ragApi.js` endpoint from `VITE_RAG_API_URL` via `new URL(...)` | `.junie/playbooks/04-contract-tests.md` | grep `fetch('/api/rag/ask` returns 0; `RAG_ASK_URL` constant present |
| 2 | Add CORS to `SecurityConfig.kt` (cors() filter + CorsConfigurationSource bean + OPTIONS permit) + `app.cors.allowed-origins` property + preflight test | `.junie/playbooks/03-backend-scaffold.md` | New `corsConfigurationSource` bean; `pathMatchers(OPTIONS).permitAll()`; CORS preflight test |
| 3 | Strip JS comments before multiline regex pass + add 3 fixture lines (brace-in-comment, comment-prefixed arrow + async-arrow) | `scripts/check-auth-policy.mjs`, `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md`, `tests/invariants/run-harness.mjs` | Production scan clean; harness 37/37 |

## Changes made

- **`ragApi.js` URL hardening.**
  - `import.meta.env.VITE_RAG_API_URL` read into `API_BASE` constant.
  - `RAG_ASK_URL = new URL('/api/rag/ask', API_BASE).toString()` — throws synchronously if `API_BASE` is missing or malformed.
  - Comment block names "LOAD-BEARING" and explicitly forbids the relative-URL pattern, citing the round-37 closure.
  - `callRagApi` now `fetch(RAG_ASK_URL, ...)` instead of relative path.
- **`SecurityConfig.kt` CORS.**
  - 3 new imports: `CorsConfiguration`, `CorsConfigurationSource`, `UrlBasedCorsConfigurationSource`.
  - New constructor arg `@Value("\${app.cors.allowed-origins}") private val allowedOrigins: List<String>`.
  - `securityWebFilterChain` chain gained `.cors { it.configurationSource(corsConfigurationSource()) }` BEFORE csrf disable + auth filter.
  - `pathMatchers(HttpMethod.OPTIONS).permitAll()` added to the auth chain (defense in depth on top of cors()).
  - New `@Bean fun corsConfigurationSource(): CorsConfigurationSource` configures `allowedOrigins`/Methods/Headers/exposedHeaders, `allowCredentials = false`, `maxAge = 600`.
- **`application.yml` example block.**
  - New `app.cors.allowed-origins: ${APP_CORS_ALLOWED_ORIGINS}` line. Comment notes "no wildcard fallback; missing → app refuses to start".
- **`OboValidationTest` preflight assertion.**
  - New `@Test fun \`CORS preflight from allowed origin returns 200 without a Bearer token\`()` sends `OPTIONS /api/rag/ask` with `Origin: http://localhost:5173`, asserts 200 + `Access-Control-Allow-Origin` matches the origin + Allow-Methods/Allow-Headers exist.
  - `@DynamicPropertySource` extended to register `app.cors.allowed-origins=http://localhost:5173` so the test slice's context can start (the SecurityConfig bean would otherwise fail to bind on a missing prop).
- **`check-auth-policy.mjs` comment stripping.**
  - Before the multiline regex loop, build `commentStripped`: replace `/* ... */` comments with whitespace of equal length (preserves line numbers); replace `// ...` line comments via a regex that requires the `//` not to be preceded by `:` or `\` (so URLs like `https://...` are preserved).
  - Multiline regex now executes against `commentStripped` instead of raw `text`. Line numbers reported still match the user's editor view (whitespace replacement preserves newlines).
  - Substring + line-scoped rules continue to use the raw `text` so forbidden tokens hidden in comments still flag (intentional — `// dummy JWT` is not OK).
- **Fixtures.**
  - 3 new fixture lines: `.catch(/* fallback {tok} */ function ...)`, `.catch(/* fallback */ () => x)`, `.catch(/* {scope} */ async () => x)`.
  - Each contributes one new violation; `expectedViolations: 34 → 37`.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (auth-policy 37/37).
- Manual round-37 bypass exercises: each new shape (ragApi relative URL, missing CORS preflight, brace-in-comment catch handler) was confirmed flagged or fixed.

## Remaining gaps (anticipated for next adversarial round)

- Comment-stripping regex for `// ...` allows `https:` to survive but might still miss exotic shapes. AST-based parsing is the long-term fix.
- `app.cors.allowed-origins` is read as `List<String>` via Spring's @Value coercion. Some Spring versions require `,` separation specifically; `application.yml` YAML list syntax is preferred for clarity. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-37 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
