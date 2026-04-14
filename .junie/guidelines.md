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

- [`playbooks/extract-reference-brief.md`](playbooks/extract-reference-brief.md) — Run this **inside a reference project** to produce a `REFERENCE_BRIEF.md` summarizing its stack, conventions, and standards. Copy that file into this repo before scaffolding.
- [`playbooks/create-rag-app.md`](playbooks/create-rag-app.md) — Scaffolds the full `frontend/` + `backend/` trees from [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md), honoring `REFERENCE_BRIEF.md` if present. TDD-first. Interactive.

## Invocation examples

> "Junie, follow `.junie/playbooks/create-rag-app.md`."

> "Junie, run the extract-reference-brief playbook against this project and write the output to `REFERENCE_BRIEF.md`."
