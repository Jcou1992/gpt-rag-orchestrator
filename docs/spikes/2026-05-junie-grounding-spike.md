# Junie Grounding Spike — 2026-05-02

**Plan reference:** [docs/plans/2026-05-02-001-feat-junie-skill-v4-plan.md](../plans/2026-05-02-001-feat-junie-skill-v4-plan.md) Unit 3
**Verdict:** **CONDITIONAL-GO** (smoke test only; real GO/NO-GO gate moved to Unit 7b — deferred real-target Junie scaffold)
**Selected fallback if NO-GO:** option (a) — generator-script-enforced single-source via `scripts/check-r5-invariant.mjs`

---

## Hypothesis

An LLM scaffolder agent (Junie in production; Claude Code as smoke-test approximation) can ground scaffold generation in an external JSON Schema file at `.junie/contracts/sse-events.schema.json` rather than restating the schema body inline. If grounding works:

- The agent reads the canonical file via a tool call.
- Emits `contract-tests/schemas/ask-chunk-event.schema.json` byte-equivalent to the canonical (because the playbook instructs a Node `copyFileSync` step, not a "rewrite from memory" step).
- Does not hallucinate events or drop events.

If grounding fails: agent restates the schema from memory (drift returns), drops events (`conversationId` was missing from v3), or invents events.

## Method

**Spike agent:** Claude Code (this session). **Not Junie itself** — IntelliJ workspace + Junie agent unavailable in this execution context. Per plan Unit 3:

> If IntelliJ workspace genuinely unavailable for spike (rare): downgrade Unit 3 to a smoke test (Claude Code as approximation), explicitly flag the GO verdict as conditional, and move the actual GO/NO-GO gate to Unit 7b (deferred real-target run). Do not pretend a Claude Code GO is a Junie GO.

This spike is therefore CONDITIONAL-GO at most. Real GO/NO-GO requires Unit 7b on a real IntelliJ + Junie workspace.

**Scratch target:** `/tmp/junie-spike-target/`
- Seeded with `.junie/contracts/sse-events.schema.json` and `.junie/contracts/sse-events.examples.json` (copied from this repo).
- `PLAYBOOK_FRAGMENT.md` instructs the agent to copy the canonical schema into `contract-tests/schemas/ask-chunk-event.schema.json` via a Node `copyFileSync` step.
- No inline schema body in the fragment (R5 precondition).

**Prompt to agent:** Read `PLAYBOOK_FRAGMENT.md`, follow its instruction, and confirm what file was produced.

## Result

- Agent (Claude Code) read `PLAYBOOK_FRAGMENT.md`.
- Agent invoked `node -e "require('fs').copyFileSync(...)"` exactly as instructed.
- Output: `contract-tests/schemas/ask-chunk-event.schema.json`.
- `diff .junie/contracts/sse-events.schema.json contract-tests/schemas/ask-chunk-event.schema.json` → empty (byte-equivalent).
- All 5 events present in produced schema (verified by `grep -c '"const"' contract-tests/schemas/ask-chunk-event.schema.json` returning 5).
- No hallucinated events.
- No memory-restated schema body in the agent's output.

## Verdict

**CONDITIONAL-GO.** Claude Code, given a playbook instructing a `copyFileSync` step, faithfully copies the canonical file rather than restating from memory. This is consistent with the v4 design hypothesis. **However, the spike does not validate Junie's behavior** — Claude Code's tool-call grounding semantics differ from Junie's IntelliJ AI integration.

Per plan: proceed to Units 4-6 on this CONDITIONAL-GO. Treat Unit 7b (real-target Junie scaffold) as the actual GO/NO-GO gate before user-facing v4 release announcement.

## Followups

- Unit 7b (deferred): run the same fragment against actual Junie in a fresh IntelliJ project; record observed behavior.
- If Junie restates the schema from memory rather than executing the `copyFileSync` step, switch to fallback option (a): the playbook keeps the schema inline AND `scripts/check-r5-invariant.mjs` runs as a pre-commit hook to enforce drift-free authoring. The R5 invariant guarantees single-source via tooling rather than via Junie's grounding behavior.
- If the agent hallucinates additional events or drops `conversationId`: same fallback path.

## Cleanup

`/tmp/junie-spike-target/` is a scratch dir; leave in place for diagnostic purposes or remove with `rm -rf /tmp/junie-spike-target/` after this spike has been recorded.
