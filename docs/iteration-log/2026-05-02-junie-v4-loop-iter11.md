# Junie Skill v4 — Iteration 11

**Date:** 2026-05-02
**Loop step:** post-iteration-11

## Pre-iteration state

Codex round 11 grade: **A-** (target: A+). Two new low findings.

## Codex review — key findings (round 11)

1. **[low]** `.junie/playbooks/03-backend-scaffold.md:1128-1134` — backend OpenAPI doc template restates SSE event examples inline (`data: {"type":"conversationId"...}` etc.), conflicting with `.junie/guidelines.md` rule that SSE event payloads live only in `.junie/contracts/sse-events.examples.json`.
2. **[low]** `scripts/check-stack-invariant.mjs:72` — fence parser regex `^```([a-zA-Z0-9_+-]*)\s*$` only matches fences starting at column 1. CommonMark allows up to 3 leading spaces before fenced blocks, so an indented Kotlin/Java block carrying forbidden servlet imports would slip past the scan undetected. (`scripts/check-r5-invariant.mjs` already uses `^\s*```` — only the stack script needed fixing.)

Round-10 findings confirmed by Codex: both CLOSED.

## Brainstorming summary

- Finding 1 — replace the inline SSE block in the OpenAPI template with prose pointing at the canonical fixture, mirroring the resolution applied to INTEGRATION_PLAN.md §3.1 in the original v4 cut. Use a relative link `../../.junie/contracts/sse-events.examples.json` because the playbook lives two levels below repo root. Note also that playbook 04 Step 1 copies the same fixture into `contract-tests/fixtures/sse-events.examples.json`, so a scaffolded backend reading its own OpenAPI doc still has a local pointer.
- Finding 2 — add `\s{0,3}` prefix to the fence regex in `check-stack-invariant.mjs` to match CommonMark indentation rules. Cross-check `check-r5-invariant.mjs` for the same bug; it already uses `^\s*```` and is safe — no edit there.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Replace inline SSE block in OpenAPI template with canonical-fixture pointer | `.junie/playbooks/03-backend-scaffold.md` | grep `data: {"type"` returns 0 in playbooks (excluding R4a check description / implementation references) |
| 2 | Allow up-to-3-space indented fences in stack invariant scanner | `scripts/check-stack-invariant.mjs` | Stack invariant still clean; regex prefix updated |

## Changes made

- **OpenAPI doc template** — the four `data: {"type": ...}` lines and their fence wrapper replaced with a single prose pointer: `**Response (SSE):** see canonical event examples at \`.junie/contracts/sse-events.examples.json\` (also copied into the scaffolded target's \`contract-tests/fixtures/sse-events.examples.json\` by playbook 04 Step 1). Five event types — \`conversationId\`, \`chunk\`, \`citation\`, \`done\`, \`error\` — validated against \`.junie/contracts/sse-events.schema.json\`. Do not restate event payloads here; the canonical fixture is the only source.` Same shape as the INTEGRATION_PLAN.md §3.1 resolution from the original v4 cut.
- **Stack invariant fence regex** — `^```([a-zA-Z0-9_+-]*)\s*$` → `^\s{0,3}```([a-zA-Z0-9_+-]*)\s*$`. Two-line comment explains why indented fences must scan. Closing fences inside `iterateCodeBlocks` use the same `line` variable so the prefix change covers both opens and closes implicitly.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean (`0 violations across 7 playbook files`).
- `node scripts/check-stack-invariant.mjs` → clean (`0 violations across 7 playbook files`).
- `grep -nE 'data: \{"type"' .junie/playbooks/*.md` → only 2 remaining matches in `04-contract-tests.md`, both in R4a check description / impl (negative invariant references, not restatements).
- `grep -nE 'data: \{"type"' INTEGRATION_PLAN.md` → 0 matches (preserved from original v4 cut).
- `grep -nE 'data: \{"type"' .junie/guidelines.md` → 0 matches.
- Spot check: 4-space-indented Kotlin block with `import jakarta.servlet.http.HttpServletRequest` placed in a scratch md file under `.junie/playbooks/` produces a stack-invariant FAIL (verified before reverting the scratch file). Indented fences are now scanned.

## Remaining gaps (anticipated for next loop)

- The new pointer in the OpenAPI doc template uses a `../../` relative path. If the scaffolder lands the OpenAPI markdown at a different depth (e.g., `docs/api/backend-openapi.md` instead of `docs/backend-openapi.md`), the relative link breaks. Mitigation: prose explicitly names the absolute repo-root path `.junie/contracts/sse-events.examples.json` alongside the link, so a broken click still leaves a discoverable filename. Stronger fix would parameterize the link at scaffold time — out of scope.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-11 changes.
- Re-run Codex adversarial review (round 12).
- Compare grade. Target A+.
