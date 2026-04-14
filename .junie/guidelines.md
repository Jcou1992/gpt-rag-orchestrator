# Junie Project Guidelines — GPT-RAG Integration

This repo integrates the GPT-RAG Orchestrator (Python/FastAPI) into a **Vue 3 + Vuetify + Vite** frontend proxied by a **Kotlin + Spring Boot (WebFlux)** backend. Full architecture, contracts, and phased plan live in [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) — treat it as the source of truth for any design decision.

## Standing rules

- **Stack is not negotiable at the architecture level.** Vue 3 + Vuetify 3 + Vite + Pinia on the frontend. Kotlin + Spring Boot WebFlux + OAuth2 Resource Server on the backend. Library *versions*, language flavor (JS vs TS), and optional add-ons are negotiable; swapping Vuetify → PrimeVue (or similar) is not.
- **Frontend language default is JavaScript** (the team's current standard, carried over from the Vue 2 codebase). TypeScript is available as an opt-in during scaffolding — do not silently introduce `.ts` files.
- **Never expose the orchestrator directly to the browser.** All traffic goes through Spring Boot. Vue only speaks to `POST /api/rag/ask`.
- **SSE end-to-end.** Use `@microsoft/fetch-event-source` in Vue (native `EventSource` cannot send `Authorization` headers). Use WebClient reactive streaming in Spring (not `RestTemplate`).
- **JSON envelope in the proxy.** Spring normalizes the orchestrator's raw-text SSE into `{type: chunk|citation|done|error, ...}` events before forwarding. Don't parse markdown citations in Vue.
- **TDD for all generated code.** Red → green → refactor. No production code without a failing test first. Tests live alongside implementation (`*.spec.ts` / `*Test.kt`).
- **Auth tokens passthrough.** The user's Entra ID JWT is forwarded to the orchestrator for OBO. Never cache or log tokens.
- **No secrets in the repo.** App registrations, API keys, connection strings → environment variables or Key Vault references only.

## Playbooks (invoke by name)

### Two-phase scaffolding

**Phase 1: Extract reference (optional but recommended)**
- [`playbooks/extract-reference-brief.md`](playbooks/extract-reference-brief.md) — Run **inside a reference project** to capture stack, versions, conventions. Produces `REFERENCE_BRIEF.md` for the target project.

**Phase 2: Scaffold the RAG app (modular, recoverable)**
- [`playbooks/create-rag-app.md`](playbooks/create-rag-app.md) — **Orchestrator.** Calls 5 sub-playbooks sequentially:
  1. **01-preflight** — lock all decisions (language, package manager, MSAL, add-ons). Output: `SCAFFOLD_DECISIONS.md`.
  2. **02-frontend-scaffold** — generate Vue 3 code TDD-first (9 units, 27 tests). Output: `frontend/`, `docs/frontend-api.md`.
  3. **03-backend-scaffold** — generate Kotlin/Spring code TDD-first (9 units, 32 tests). Output: `backend/`, `docs/backend-openapi.md`.
  4. **04-contract-tests** — validate frontend ↔ backend contracts, set up mocks/fallbacks. Output: `contract-tests/`, `docs/communication-fallbacks.md`.
  5. **05-docs-generation** — generate 10+ comprehensive guides (1200+ lines). Output: `docs/` with setup, architecture, development, testing, troubleshooting, conventions.

  Each phase updates `SCAFFOLD_PROGRESS.md` as a memory checkpoint. If interrupted, re-run and it resumes.

## Invocation examples

> "Junie, follow `.junie/playbooks/create-rag-app.md`."

> "Junie, run the extract-reference-brief playbook against this project and write the output to `REFERENCE_BRIEF.md`."
