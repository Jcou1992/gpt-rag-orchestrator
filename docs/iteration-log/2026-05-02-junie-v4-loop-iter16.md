# Junie Skill v4 — Iteration 16

**Date:** 2026-05-02
**Loop step:** post-iteration-16

## Pre-iteration state

Codex round 16 grade: **A-** (target: A+). All round-15 fixes confirmed CLOSED. Five new findings (1 medium, 4 low) — all consistency-class issues across the dependency list, output paths, and language-default rules.

## Codex review — key findings (round 16)

1. **[medium]** `INTEGRATION_PLAN.md` §5.2 omits `@azure/msal-browser` from frontend dependencies even though `src/auth/msalConfig.js` (R11/SC6) imports `PublicClientApplication` and `InteractionRequiredAuthError` from it. A scaffolder following the dep list ships a frontend that fails to build with `Cannot find module '@azure/msal-browser'`.
2. **[low]** `INTEGRATION_PLAN.md` §5.2 lists `typescript` and `vue-tsc` unconditionally in `devDependencies`, contradicting the JS-default / TS-opt-in rule re-aligned in iteration 15.
3. **[low]** `.junie/playbooks/04-contract-tests.md:7` outputs `msalConfig.js` (bare path), but the actual template emits `src/auth/msalConfig.js` (per the alias path in `auth.js` and the §4 INTEGRATION_PLAN tree).
4. **[low]** `.junie/playbooks/04-contract-tests.md:148` heading reads "single property only" while the YAML block carries three properties (`app.dev-doubles.enabled`, `orchestrator.url`, `orchestrator.api-key`). The "single" invariant scoped to the gate flag, not the whole file.
5. **[low]** `.junie/guidelines.md:12` TDD rule names `*.spec.ts` as the frontend test pattern. With JS-default scaffold, the actual files are `.spec.js` (`vitest` does not require TS). The contradiction would push Junie toward generating `.spec.ts` even in the JS variant.

## Brainstorming summary

- Finding 1 — append `@azure/msal-browser` to `dependencies` in §5.2. Use the same caret pin family already used (`^3.20.0` matches v3 line, which exposes `PublicClientApplication` + `InteractionRequiredAuthError` — verified against `msalConfig.js` import site). Add a contextual note explaining why it's load-bearing (R11/SC6 hardened MSAL).
- Finding 2 — promote `typescript` and `vue-tsc` to a separate "TypeScript variant only" callout below the JSON block. Keep them out of the default JSON to prevent silent install when a JS project never uses them.
- Finding 2-companion — while editing §5.2, also surface the test-runner/validator deps that playbook 04 actually requires. The current §5.2 omits `vitest`, `ajv`, `ajv-formats` — playbook 04 imports all three. Adding them now closes the same drift class for the test surface that the medium finding closes for the auth surface.
- Finding 3 — single-line edit in playbook 04 frontmatter: `msalConfig.js` → `src/auth/msalConfig.js`. Aligns with every other reference in the same file.
- Finding 4 — rephrase the heading: `single property only` → `single dev-double activation property` (scope the invariant explicitly to the gate flag). Inline parenthetical clarifies that other unrelated overrides are fine; only the gate flag is required to be unique.
- Finding 5 — guidelines.md TDD rule rewritten as: "frontend `*.spec.js` (default) — or `*.spec.ts` only when the TypeScript opt-in variant is selected — and backend `*Test.kt`."

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `@azure/msal-browser` to runtime deps + add `vitest` / `ajv` / `ajv-formats` to dev deps + carve TypeScript opt-in callout | `INTEGRATION_PLAN.md` | grep `@azure/msal-browser` returns 1 match in §5.2; `typescript` no longer in the unconditional devDeps JSON |
| 2 | Fix bare `msalConfig.js` output path → `src/auth/msalConfig.js` | `.junie/playbooks/04-contract-tests.md` | grep `msalConfig\.js` returns 0 matches without a directory prefix in the playbook frontmatter |
| 3 | Scope-clarify the `application-mock.yml` heading | `.junie/playbooks/04-contract-tests.md` | Heading reads "single dev-double activation property" |
| 4 | Align TDD rule with JS-default | `.junie/guidelines.md` | Rule names both `.spec.js` (default) and `.spec.ts` (opt-in) |

## Changes made

- **§5.2 dependency list rewritten.**
  - Runtime `dependencies` gained `"@azure/msal-browser": "^3.20.0"` between `@microsoft/fetch-event-source` and `pinia`.
  - `devDependencies` dropped `typescript` and `vue-tsc` from the default block, gained `vitest`, `ajv`, `ajv-formats` (the runtime test stack the contract specs actually load).
  - New callout below the JSON: **TypeScript variant only** — instructs the scaffolder to add `typescript` + `vue-tsc` to `devDependencies` when the TS opt-in is selected; explicitly states the JS default does not need them.
  - Existing notes section expanded to three bullet points covering `@microsoft/fetch-event-source`, `@azure/msal-browser`, and the test stack — each note explains why the package is load-bearing so a future drift in this list surfaces immediately.
- **Playbook 04 frontmatter output path normalized.**
  - `msalConfig.js` (bare) → `src/auth/msalConfig.js`. Now consistent with every other reference in the same playbook (`auth.js` import path, Step 6 header, Step 6 file path label, troubleshooting cross-references).
- **`application-mock.yml` heading clarified.**
  - "single property only" → "single dev-double activation property". Inline parenthetical explains that the file MAY carry other unrelated overrides (`orchestrator.url`, `orchestrator.api-key`), and the invariant is exactly that one property activates the gate, not the whole file.
- **`.junie/guidelines.md` TDD rule aligned with JS default.**
  - "Tests live alongside implementation (`*.spec.ts` / `*Test.kt`)." → "Tests live alongside implementation: frontend `*.spec.js` (default) — or `*.spec.ts` only when the TypeScript opt-in variant is selected — and backend `*Test.kt`."

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n '@azure/msal-browser' INTEGRATION_PLAN.md` → 2 matches (the new dep entry + the load-bearing note).
- `grep -nE '"typescript":|"vue-tsc":' INTEGRATION_PLAN.md` → 1 match each, both inside the TypeScript-variant-only callout. Neither appears in the unconditional `devDependencies` JSON.
- `grep -n 'msalConfig\.js' .junie/playbooks/04-contract-tests.md | grep -v 'src/auth/'` → only matches inside JavaScript snippets that import via the relative path `'../auth/msalConfig.js'` (correct from the importer's location). Zero bare directory-less references in narrative.
- `grep -n 'single property only' .junie/playbooks/04-contract-tests.md` → 0 matches.
- `grep -n 'single dev-double activation property' .junie/playbooks/04-contract-tests.md` → 1 match (the new heading).
- `grep -n 'spec.js\|spec.ts' .junie/guidelines.md` → 1 match (the TDD rule, which now names both variants).

## Remaining gaps (anticipated for next loop)

- `package.json` version pins are caret-bound. If `@azure/msal-browser` ships a v4 with a breaking export shape, the scaffold will compile cleanly but fail at first sign-in. Backlog candidate: add a runtime smoke test asserting the imported names exist.
- §5.2 still does not document `@vitejs/plugin-vue` even though Vite Vue projects need it. Codex did not flag it; deferred to a future "dependency completeness audit" backlog item rather than chasing it speculatively now.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-16 changes.
- Re-run Codex adversarial review (round 17).
- Compare grade. Target A+.
