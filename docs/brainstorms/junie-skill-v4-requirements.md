---
date: 2026-05-01
topic: junie-skill-v4
---

# Junie Skill v4 — Single-Source Contracts & Drift Elimination

## Problem Frame

Codex adversarial review of v3.0 (`fe55235`) graded the playbook **D — needs attention**. Two high-severity defects propagate to every project the playbook scaffolds:

1. **Contract drift.** `INTEGRATION_PLAN.md:154` defines `conversationId` as the first SSE event. The schema in `.junie/playbooks/04-contract-tests.md:19-61` only lists `chunk | citation | done | error`. Generated contract tests reject real backend streams or push implementers to drop conversation continuity.
2. **Auth backdoor.** `.junie/playbooks/04-contract-tests.md:174-207` tells the scaffolder to wrap `getToken()` in `.catch(() => 'STUB-JWT')` with no environment guard. Production builds silently accept the stub, masking missing MSAL wiring and violating the playbook's own "no fake tokens" rule.

Root cause is the same in both cases: **the playbook restates contracts in prose instead of pointing at one canonical artifact.** Any future contract addition (request shape, error envelope, retry codes) repeats the drift class.

Affected: every fresh RAG app scaffolded from `.junie/`. Since v3 hasn't been used yet for a real target project, the cost of a v4 cut is one rewrite — strictly cheaper than patching every generated repo later.

## Requirements

**Canonical contracts**
- R1. SSE event spec lives in a single machine-readable JSON Schema file at `.junie/contracts/sse-events.schema.json`. Schema is the source of truth; all other docs (INTEGRATION_PLAN.md, frontend models, backend mappers) link to it instead of restating events.
- R2. Schema must include all 5 event types currently in `INTEGRATION_PLAN.md`: `conversationId`, `chunk`, `citation`, `done`, `error`. Each event has `type` const + required value fields, `additionalProperties: false`, and a top-level `oneOf`.
- R3. Playbook `04-contract-tests.md` reads the canonical schema directly into `contract-tests/schemas/` rather than emitting an inline schema. No duplication.

**Drift prevention**
- R4. Add a contract test that asserts every `data: {"type":"X"}` example in `INTEGRATION_PLAN.md` validates against the canonical schema. Run as part of `04-contract-tests.md` output. Fails the scaffold output if any drift exists.
- R5. Playbook documentation references the schema by path; no inline schema blocks in any `.junie/playbooks/*.md` or `.junie/guides/*.md`.

**Auth-stub safety**
- R6. Auth-stub code in scaffolded frontend gated by build-time check (`import.meta.env.DEV` for Vite). Stub file resides in dev-only path so it tree-shakes out of production bundle.
- R6a. Dev stub stores token in a module-scoped variable, not `localStorage`. The dev path must not write a JWT-shaped string to any persistent browser storage — protects against XSS/extension exfil even in dev environments.
- R6b. Scaffolded backend gates all `Mock*` / `Stub*` beans with `@Profile("!prod")` (or equivalent). Frontend hardening alone leaves the actual auth boundary (backend) open — backend gate must mirror the build-time exclusion.
- R7. Scaffolded frontend includes a contract test that imports the production-mode bundle and asserts no stub markers (e.g. `STUB-JWT`, `dev-auth-token`, function names from auth-stub) appear. Test fails the build if a stub leaks into prod.
- R7b. Scaffolded backend includes a Spring integration test asserting no bean whose name matches `Mock*` / `Stub*` is registered when `spring.profiles.active=prod`. Test fails the build if a stub bean activates under prod profile.
- R8. `ragApi.js` removes the `.catch(() => 'STUB')` fallback. `getToken()` failure in production must throw and surface to the user.

**Migration**
- R9. v4 ships as a fresh `.junie/` directory. Current v3 archived to `.juniebackups/v3/` (consistent with v2 archive pattern).
- R10. v4 `guidelines.md` calls out the contract-source rule explicitly under standing rules. Narrow form for v4: "The SSE events contract lives in `.junie/contracts/sse-events.schema.json`. Do not restate it in prose. Extend this pattern (one schema file per contract) when a second contract is canonicalized." The general "all contracts" form is deferred until at least one more contract has been canonicalized so the rule is grounded in evidence rather than aspiration.

## Success Criteria

Replace the v3 "Codex re-review ok" gate with 4 concrete, deterministic checks. LLM-judge verdicts are out — the criteria below are reproducible and testable in CI.

- **Frontend leak gate.** `pnpm build` on a scaffolded target produces a bundle whose contents (combined with bundle-manifest inspection) contain zero stub markers — both literal strings (`STUB-JWT`, `dev-auth-token`) and the auth-stub module's exported symbols. Detection method (literal grep + manifest assertion vs source-map walk vs unique sentinel constant) is decided in planning; the criterion itself is method-agnostic.
- **Contract drift gate.** A contract test validates every SSE event example in `INTEGRATION_PLAN.md` against `.junie/contracts/sse-events.schema.json`. Test fails the scaffold if any event documented in INTEGRATION_PLAN.md is missing from the schema or vice versa. Extraction format is a planning decision (fenced code block convention vs sidecar fixture file).
- **Backend gate enforcement.** Spring integration test asserts zero `Mock*` / `Stub*` beans active when `spring.profiles.active=prod`. Test fails the build if any stub bean leaks into prod context.
- **Single-source extensibility.** Adding a new SSE event type requires editing exactly one file under `.junie/contracts/` (the canonical schema). Code-side changes (backend mapper, frontend handler, type definitions) are orthogonal and do not count toward the criterion — the contract surface itself stays single-file.

## Scope Boundaries

**In scope**
- SSE event schema (R1-R3)
- Contract drift detector for SSE events (R4-R5)
- Auth-stub build-time gate + leak test (R6, R6a, R6b, R7, R7b, R8) — frontend AND backend gates
- Migration to v4 directory (R9-R10)

**Out of scope (deferred)**
- Canonicalizing other contracts (request body, MCP wire format, error code catalog) — same pattern, but each one is its own evidence-driven decision. Add when the next bug surfaces.
- Versioning policy / semver rules for `.junie/`.
- Auto-publishing `.junie/` as standalone artifact (npm/git submodule). Current copy-paste workflow stays.
- Retroactively fixing already-scaffolded projects (none exist yet).
- Changing the 5-phase playbook structure or stack lock.

## Key Decisions

- **Schema as JSON-Schema file, not Markdown block.** Machine-readable, lintable, parseable by `ajv`. Markdown blocks are what caused v3 drift in the first place.
- **Build-time exclusion over runtime flag for auth stub.** Runtime flags can be set in prod env; build-time tree-shaking cannot. Backed by an explicit anti-leak test.
- **v4 is a clean cut, not a v3 patch.** v3 hasn't been used yet on a real target, so refactor cost is one rewrite. Patching v3.1 would leave the drift class untouched and require a v4 anyway.

## Dependencies / Assumptions

- Target frontend uses Vite (locked by `guidelines.md` standing rules); `import.meta.env.DEV` is available.
- Target backend uses Spring Boot WebFlux; no schema-validation lib chosen yet but `ajv` for frontend, `networknt/json-schema-validator` or similar for backend will be selected at planning time.
- INTEGRATION_PLAN.md remains the prose architectural spec. v4 only changes how contracts inside it are sourced (link vs restate), not its role.
- No existing scaffolded apps to migrate.

## Outstanding Questions

### Resolve Before Planning
*(none — decisions captured)*

### Deferred to Planning

**SSE schema mechanics**
- [Affects R3][Technical] Schema emission mechanism — `cp .junie/contracts/sse-events.schema.json contract-tests/schemas/` as a generation step (Windows-friendly, recommended) vs symlink (Unix-only) vs build-step regen.
- [Affects R4][Technical] Where SSE event examples live so the drift detector can extract them mechanically — sidecar fixture file `docs/sse-event-examples.json` (recommended; INTEGRATION_PLAN.md links to it) vs ` ```sse-example` fenced code-block convention vs regex over free-form prose. Decoupling from prose formatting eliminates fragile parsing.

**Auth-stub mechanics**
- [Affects R6][Technical] Stub import strategy that actually tree-shakes — Vite `resolve.alias` swap (`@/services/auth` → `auth-stub.js` in dev, `auth.js` in prod) OR dynamic `await import()` inside a DEV branch. Naive `if (import.meta.env.DEV)` guard with a static top-level import does NOT tree-shake.
- [Affects R7][Needs research] Production-bundle leak detection method that survives minification — unique sentinel constant the stub exports (e.g. `__JUNIE_DEV_AUTH_STUB_SENTINEL__`) OR source-map walk OR Rollup bundle-manifest absence assertion. Pure function-name grep is unreliable post-terser.
- [Affects auth][Security] MSAL hardening for the scaffolded `msalConfig.js` template: `cacheLocation: 'sessionStorage'` (not localStorage default), startup validation rejecting placeholder `clientId` / `tenantId` / `authority`, sanitized error rendering for `getToken()` failures (no raw `errorMessage` / `correlationId` in DOM), `acquireTokenSilent` policy for token refresh.

**Migration**
- [Affects R9][Technical] `.juniebackups/` already contains uncategorized v2 content. Migrate v2 → `.juniebackups/v2/` before adding `.juniebackups/v3/` to avoid path collision.
- [Affects R9][Verify] "v3 hasn't been used yet" claim is asserted but unverified. Confirm via `git log` / org search / forks check before committing to the clean-cut migration. If any consumer is found, add a v3→v4 migration note instead of clean cut.

**Validation**
- [Affects R1-R3][Validation] Test that Junie (the LLM agent consuming the playbook) can still produce correct scaffolds when SSE schema lives in a separate file rather than inline prose. Verify with one real scaffold run before declaring v4 done — removing inline content may degrade LLM grounding.

## Next Steps

→ `/ce-plan` for structured implementation planning.
