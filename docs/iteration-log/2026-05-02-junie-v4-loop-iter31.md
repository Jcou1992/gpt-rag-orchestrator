# Junie Skill v4 — Iteration 31

**Date:** 2026-05-02
**Loop step:** post-iteration-31 (adversarial)

## Pre-iteration state

Round 31 adversarial verdict: **needs-attention**. The CI workflow added in iteration 30 runs the three invariant scripts on PR + push, but Codex constructed a bypass: the same PR can modify `scripts/check-*.mjs` to weaken (or skip) the rules AND introduce a forbidden pattern, and the workflow's clean-tree run will pass. Same drift class as round-22 (regression check that didn't actually exercise the guard) reached one layer up.

## Codex adversarial review — single finding

1. **[medium]** `.github/workflows/junie_invariants.yaml:51-58` — workflow only runs the production scan. No negative-control fixtures, no harness that proves each script still rejects known-bad input. A contributor can silently neuter an invariant in the same PR that introduces a forbidden pattern. CI passes; auth/stack/schema boundaries silently stop enforcing.

## Brainstorming summary

- The fix is a self-test harness that exercises each script against a committed known-bad fixture and asserts non-zero exit + the right violation text. Run BEFORE the production scan in CI. If a contributor weakens an invariant, the harness fails first; the workflow goes red.
- Each invariant script needs to accept a target-directory override (env var or arg) so the harness can point the script at fixture content without modifying `.junie/playbooks/`. Use `JUNIE_PLAYBOOKS_DIR`. Default behavior (production runs without the env var set) unchanged.
- Fixtures live under `tests/invariants/fixtures/{bad-r5,bad-stack,bad-auth}/`. Each subdirectory has one `.md` file containing the minimum content that triggers the corresponding invariant. Comments inside each fixture explicitly say "INTENTIONALLY BAD" so a future contributor doesn't try to "clean them up".
- Harness file: `tests/invariants/run-harness.mjs`. Spawns each invariant script via `process.execPath` (same pattern as iteration 24's regression check), points `JUNIE_PLAYBOOKS_DIR` at the fixture dir, asserts exit-non-zero + sentinel-substring in stderr+stdout. Sentinel chosen to be unique to the violation message, so an unrelated launch failure or a script that passes for the wrong reason still fails the harness.
- Manual self-check (verified before commit): temporarily weaken `check-r5-invariant.mjs` to always exit 0; harness fails the R5 case with a clear message; restore the script; harness passes again.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `JUNIE_PLAYBOOKS_DIR` env override to each invariant script (no behavioral change without the env var) | `scripts/check-r5-invariant.mjs`, `scripts/check-stack-invariant.mjs`, `scripts/check-auth-policy.mjs` | Production runs (no env var) still report `clean`; setting the env var redirects scanning to the override path |
| 2 | Commit known-bad fixtures for each invariant under `tests/invariants/fixtures/bad-*/` | `tests/invariants/fixtures/bad-r5/inline-schema.md`, `tests/invariants/fixtures/bad-stack/servlet-import.md`, `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Each fixture is the minimum content that triggers the corresponding invariant; explicit "INTENTIONALLY BAD" comment block at the top |
| 3 | Add `tests/invariants/run-harness.mjs` that runs each invariant against its fixture and asserts non-zero exit + sentinel | `tests/invariants/run-harness.mjs` | All 3 cases PASS in clean state; weakening any script causes the harness to FAIL with a specific message |
| 4 | Wire harness into the CI workflow BEFORE the production scan | `.github/workflows/junie_invariants.yaml` | New "Negative-control harness" step runs first; `paths:` filter extended to cover `tests/invariants/**` |

## Changes made

- **Env-var override on all three invariant scripts.**
  - `check-r5-invariant.mjs`: `playbookDir` resolution checks `process.env.JUNIE_PLAYBOOKS_DIR` first, falls back to the canonical path. Comment block names the harness as the consumer.
  - `check-stack-invariant.mjs`: imports `resolve` from `node:path`; `TARGET_DIRS` derivation matches the same pattern.
  - `check-auth-policy.mjs`: same pattern; comment cross-references `check-r5-invariant.mjs` for rationale to avoid restating it three times.
  - All three production runs (no env var set) remain `clean`.
- **Three known-bad fixtures.**
  - `bad-r5/inline-schema.md`: a fenced ` ```json ` block whose JSON contains both `oneOf` and `additionalProperties` — the exact pattern R5 forbids.
  - `bad-stack/servlet-import.md`: a Kotlin code block importing `HttpSecurity`, `SecurityFilterChain`, `MockMvc` — the servlet-stack triggers the stack invariant rejects.
  - `bad-auth/dummy-token-fallback.md`: prose telling scaffolders to mock `getToken` returning a "dummy JWT", a code block with `.catch(() => 'STUB-JWT')`, and a bash block listing `RAG_API_URL` / `VITE_MSAL_TENANT_ID` / `VITE_MSAL_API_SCOPE` — covers all four forbidden classes the auth-policy script enforces.
- **Harness `tests/invariants/run-harness.mjs`.**
  - Spawns each script via `spawnSync(process.execPath, [scriptPath], { ..., env: { ..., JUNIE_PLAYBOOKS_DIR: fixtureDir } })`.
  - Per-case assertions:
    - `existsSync` precheck on the script and the fixture dir (script-missing / fixture-missing fails as a distinct error).
    - `result.error` branch (launch failure surfaces with its own message — closes the same false-pass class iteration 24 closed for the build-mode regression check).
    - `result.status === 0` branch ("EXITED ZERO" — the script silently stopped rejecting the fixture).
    - Sentinel substring check on `stderr+stdout` ("script may have failed for an unrelated reason" — distinct error message naming the expected sentinel).
  - Sentinels picked to be unique to the violation messages: `oneOf` (R5 prints the offending key set), `HttpSecurity` (stack prints the matched servlet import), `STUB-JWT` (auth-policy prints the matched substring token). All three are absent from clean-state output, so a script that exits non-zero for an unrelated reason still fails the sentinel check.
- **Workflow wiring.**
  - New "Negative-control harness" step runs BEFORE the three production scan steps. Comment block above the new step quotes the round-31 adversarial finding so future readers understand why the harness exists.
  - `paths:` filter extended on both `pull_request` and `push` triggers to include `tests/invariants/**` so harness changes also retrigger the workflow.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS, 0 FAIL.
- **Negative-control self-check** (run before commit): temporarily replaced `process.exit(violations.length > 0 ? 1 : 0)` and `process.exit(1)` calls in `check-r5-invariant.mjs` with `process.exit(0)`; re-ran the harness; observed `[harness] FAIL: R5 (inline-schema) — script EXITED ZERO against known-bad fixture.` Restored the file; harness back to 3 PASS.
- The workflow YAML still parses; the new step block matches the existing indentation and `run:` shape.

## Remaining gaps (anticipated for next adversarial round)

- Fixtures are committed plaintext; a contributor could "fix" the fixture (remove the violating content) and the harness would then mis-pass. Mitigation: the comment block at the top of each fixture says "INTENTIONALLY BAD"; the harness asserts the fixture path exists; a missing fixture surfaces as a distinct failure class. A stricter guard would hash the fixture content and check the hash in the harness — backlog candidate if Codex flags drift.
- Weakening BOTH the script and its fixture in the same PR could still land a green check. The defense relies on PR review noticing both concurrent changes; the workflow alone cannot detect intent. This matches the standard "adversarial CI" tradeoff.
- `JUNIE_PLAYBOOKS_DIR` is a shared env var across all three scripts. A future invariant added with different scoping needs would have to either follow the same convention or invent its own. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-31 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
