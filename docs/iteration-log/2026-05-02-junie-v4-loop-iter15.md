# Junie Skill v4 — Iteration 15

**Date:** 2026-05-02
**Loop step:** post-iteration-15

## Pre-iteration state

Codex round 15 grade: **B+** (target: A+). Round-14 fixes confirmed CLOSED. Three new findings (1 medium, 2 low).

## Codex review — key findings (round 15)

1. **[medium]** `MockOrchestratorClient` (Unit 9b Step C) and the real `OrchestratorClient` (Unit 5 — WebClient implementation) are both annotated `@Component` and both implement the same interface. With `app.dev-doubles.enabled=true` (the `mock` profile), Spring sees two beans for one type and either throws `NoUniqueBeanDefinitionException` or — worse — silently injects the wrong one. The `application-mock.yml` comment says the real orchestrator URL is "ignored when `MockOrchestratorClient` is registered," but nothing in the bean configuration actually enforces that resolution.
2. **[low]** `.junie/playbooks/04-contract-tests.md:138` heading reads "configure dev profile only" — a stale phrase from before the round-14 profile consolidation. Body of the section already says `mock`. Heading must follow.
3. **[low]** `INTEGRATION_PLAN.md:3, 243-254` presents the frontend stack as `Vite (TypeScript)` with `vite.config.ts` / `ragApi.ts` / `useRagChat.ts`, while `.junie/guidelines.md:8` declares JavaScript as the default and playbook 04 emits `.js` files. Documented stack-language contradiction. Resolution: align the plan with the JS default and explicitly mark the TS tree as the opt-in variant.

## Brainstorming summary

- Finding 1 — three valid resolutions: (a) `@Primary` on the mock, (b) `@ConditionalOnMissingBean` on the real client, (c) qualified injection at every consumer. Pick (a). The mock already has the `@DevOnlyBean` gate that keeps it out of prod entirely, so `@Primary` cannot wrongly override the real bean in production. Adding `@ConditionalOnMissingBean` to the real client would invert ownership — making prod auto-degrade if the mock somehow registers. Qualifier injection bloats every consumer site. `@Primary` is the smallest intervention.
- Finding 2 — surgical edit. Heading `configure dev profile only` → `configure mock profile only`. No body changes needed.
- Finding 3 — INTEGRATION_PLAN.md is the source-of-truth doc Junie reads alongside the playbooks. The TS tree is currently presented as default, contradicting guidelines and the actual `.js` outputs. Two-step fix:
  - Top-of-file stack line drops `(TypeScript)` from the parenthetical, adds a "Frontend language: JavaScript por defecto" line citing guidelines.md.
  - §4 file tree is rewritten with a `{js,ts}` extension marker, a leading note explaining the variant is opt-in TS, and the missing `auth.{js,ts}` / `auth-stub.{js,ts}` / `auth/msalConfig.{js,ts}` files that v4's auth boundary requires (the original tree predates R6/R6a/R6c/R11).

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `@Primary` to MockOrchestratorClient with comment block explaining bean-resolution rule | `.junie/playbooks/03-backend-scaffold.md` | `@Primary` annotation + `import org.springframework.context.annotation.Primary` present; comment cites the `@DevOnlyBean` gate as the prod-safety guarantee |
| 2 | Cross-reference @Primary requirement in playbook 04 | `.junie/playbooks/04-contract-tests.md` | Step 3 confirmation bullet names `@Primary` alongside `@DevOnlyBean` |
| 3 | Fix Step 3 heading from `configure dev profile only` → `configure mock profile only` | `.junie/playbooks/04-contract-tests.md` | grep `configure dev profile only` returns 0 |
| 4 | Align INTEGRATION_PLAN.md frontend tree with JS default; mark TS as opt-in; add missing v4 auth files | `INTEGRATION_PLAN.md` | TL;DR stack line names JS default; §4 tree uses `{js,ts}` markers with explanatory note; auth boundary files present |

## Changes made

- **`MockOrchestratorClient` carries `@Primary`.**
  - Added import: `org.springframework.context.annotation.Primary`.
  - Class header now reads `@DevOnlyBean / @Primary / @Component class MockOrchestratorClient`. Six-line comment block above explains why: both this mock and the real `OrchestratorClient` from Unit 5 implement the same interface; without `@Primary`, Spring throws `NoUniqueBeanDefinitionException` whenever both beans land in the same context (the `mock` profile + the positive-registration test in `DevDoubleGateTest`). `@DevOnlyBean` keeps the mock out of prod, so `@Primary` cannot accidentally override the real client outside dev.
- **Playbook 04 Step 3 references the new annotation.**
  - Bullet 1 of the confirmation list extended: now reads "gated by `@DevOnlyBean` AND marked `@Primary` to win over the real `OrchestratorClient` from Unit 5 when both beans are on the classpath — required to avoid `NoUniqueBeanDefinitionException`."
- **Step 3 heading consolidated.**
  - `Step 3 — Mock orchestrator for offline dev (configure dev profile only)` → `... (configure mock profile only)`. Body already aligned to `mock`; only the heading still drifted.
- **INTEGRATION_PLAN.md JS-default alignment.**
  - TL;DR line 3 dropped `(TypeScript)` from the stack triplet. New line 4 added: `Frontend language: JavaScript por defecto (alineado con .junie/guidelines.md ...)` with explicit "TypeScript queda como variante opt-in en 01-preflight; los snippets .ts de §4 más abajo son la forma TS equivalente y deben leerse como .js cuando se mantiene el default."
  - §4 frontend tree gained a leading note marking the tree as the TS variant and instructing readers to substitute `.ts` → `.js` for the default.
  - Tree itself rewritten with `{js,ts}` extension markers on every source file plus a `# solo en variante TypeScript` note on `src/types/rag.ts`.
  - Tree gained the missing v4 auth-boundary files: `services/auth.{js,ts}` (adapter), `services/auth-stub.{js,ts}` (dev-only stub), and `auth/msalConfig.{js,ts}` (hardened MSAL — single-source `getToken`). Pre-iteration tree omitted all three despite being R6/R6a/R11-required.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n '@Primary' .junie/playbooks/03-backend-scaffold.md` → 2 matches: import + class annotation. Comment block immediately above the annotation explains the bean-resolution rationale.
- `grep -n 'configure dev profile only' .junie/playbooks/04-contract-tests.md` → 0 matches.
- `grep -n 'configure mock profile only' .junie/playbooks/04-contract-tests.md` → 1 match (the heading).
- `grep -nE '\.\(js\|ts\)|\{js,ts\}|TypeScript' INTEGRATION_PLAN.md` → returns the explanatory line + every tree node updated to the new pattern. No standalone `.ts` extension remains except `src/types/rag.ts` (correctly tagged TS-only).
- Manual read of the new INTEGRATION_PLAN.md tree confirms all R6/R6a/R11 auth-boundary files (`auth.{js,ts}`, `auth-stub.{js,ts}`, `auth/msalConfig.{js,ts}`) are now listed.

## Remaining gaps (anticipated for next loop)

- The `OboValidationTest` positive case relies on bean resolution finding `MockOrchestratorClient` first. The `@Primary` change is correct, but no test asserts the resolution happens that way under `app.dev-doubles.enabled=true`. Backlog: add an `@Autowired private val client: OrchestratorClient` field assertion that `client::class === MockOrchestratorClient::class` inside the positive-property test of `DevDoubleGateTest` (or a dedicated test class).
- INTEGRATION_PLAN.md §5 (dependencies) was not touched in this iteration; if it duplicates dependency lists from playbook 03's `build.gradle.kts` snippet, drift is possible. Codex didn't flag it; backlog candidate for a future audit pass.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-15 changes.
- Re-run Codex adversarial review (round 16).
- Compare grade. Target A+.
