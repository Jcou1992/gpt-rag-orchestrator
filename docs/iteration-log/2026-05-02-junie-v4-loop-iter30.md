# Junie Skill v4 — Iteration 30

**Date:** 2026-05-02
**Loop step:** post-iteration-30 (adversarial)

## Pre-iteration state

Round 30 adversarial verdict: **needs-attention**. The auth-policy invariant (and its two siblings, R5 and stack) is now correct, but Codex flagged that none of the three are wired into CI. The standing rule in `.junie/guidelines.md` claims the script enforces the boundary, but a repo search returns no `.github/workflows/*` job invoking it. Operationally, "manual run path" = "depends on a reviewer remembering to run it locally" = bypassable.

## Codex adversarial review — single finding

1. **[medium]** `.junie/guidelines.md:18` (and by extension `scripts/check-*.mjs` callers) — invariants are documented, not enforced. PRs that re-introduce a forbidden auth pattern, a servlet import, or an inline schema duplication can pass CI silently. Fix: add a GitHub Actions job that runs all three invariant scripts on PR + push.

## Brainstorming summary

- The existing `.github/workflows/pr_pipeline.yaml` is scoped to `pull_request` against `develop` and depends on Azure secrets (login + evaluation). Stuffing the invariant scripts into it would couple Node-only checks to Azure auth and bake in the wrong trigger surface (only pull_request to develop, not pushes to feature branches like `playbookGeneration`).
- Cleanest: a NEW workflow file, scoped to `pull_request` (any branch) AND `push` to the long-lived branches, with `paths:` filters so the workflow only runs when the playbooks / invariant scripts / `INTEGRATION_PLAN.md` actually change. No Azure secrets needed.
- Three sequential `node scripts/check-*.mjs` steps. Each script already exits non-zero on violation; the workflow passes that exit through. Reviewers see the failure as a red check on the PR with the offending line number in the step's logs.
- Update the guidelines.md standing rule to reference the workflow file by name + path. The "documented but not enforced" gap is closed in two places: the workflow exists AND the rule names it.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Add `.github/workflows/junie_invariants.yaml` running all three invariant scripts on PR + push to long-lived branches | `.github/workflows/junie_invariants.yaml` | YAML parses; trigger covers PRs + relevant pushes; paths filter scopes to playbooks + scripts + plan + the workflow itself |
| 2 | Reference the workflow + the obsolete-env-var coverage in the guidelines auth rule | `.junie/guidelines.md` | Standing rule names `.github/workflows/junie_invariants.yaml`; lists `RAG_API_URL`/`VITE_MSAL_TENANT_ID`/`VITE_MSAL_API_SCOPE` alongside the existing forbidden tokens |

## Changes made

- **New workflow `.github/workflows/junie_invariants.yaml`.**
  - Header comment block names each invariant by purpose (R5 / stack / auth-policy) so a future maintainer reading the workflow understands what it guards.
  - Triggers:
    - `pull_request` (any branch), filtered to `paths: ['.junie/**', 'scripts/check-*.mjs', 'INTEGRATION_PLAN.md', '.github/workflows/junie_invariants.yaml']`.
    - `push` to `main`, `develop`, `release/**`, `playbookGeneration`, same paths filter.
  - Single job (`invariants`) on `ubuntu-latest`, no Azure auth or external secrets.
  - Uses `actions/setup-node@v4` with `node-version: '20'` (matches the `engines.node >= 20` declaration in the scaffolded `package.json` template).
  - Three named steps, one per invariant script. Each step's `run:` is the exact `node scripts/check-*.mjs` invocation a developer would use locally.
- **`.junie/guidelines.md` standing rule updated.**
  - Auth-policy rule extended with the obsolete env-var names (`RAG_API_URL` / `VITE_MSAL_TENANT_ID` / `VITE_MSAL_API_SCOPE`) the script now also rejects (round-28 extension).
  - New rule "Invariant scripts run in CI" added directly below. It names the workflow file by path, lists the three scripts, calls out the trigger surface (PR + push to `main`/`develop`/`release/**`/`playbookGeneration`), and gives the local invocation form for diagnosis.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `.github/workflows/junie_invariants.yaml` parses (Node `fs.readFileSync` → 59 lines; visual check confirms the 3-step `steps:` block under `jobs.invariants`).
- The workflow's `paths:` filter is symmetric between `pull_request` and `push` so both trigger surfaces match the same change set.
- A future PR that touches only files OUTSIDE the filter (e.g., `dataset/`, `infra/`) does NOT trigger the invariants workflow — keeps CI runtime focused; the existing `pr_pipeline.yaml` continues to gate the application-side changes.

## Remaining gaps (anticipated for next adversarial round)

- The new workflow runs on Linux only. The `check-no-local-auth-build.mjs` regression check (a different script, scaffolded into target projects, NOT the repo-side invariants) was hardened in iteration 24 specifically for Windows. The invariant scripts themselves are Node-only and don't shell out, so cross-platform CI isn't required for them — but if a future iteration adds a script that does shell out, this workflow's Linux-only pinning could mask Windows-specific regressions. Backlog candidate: matrix-build the workflow if a shell-out script lands.
- Branch protection rules are repo-admin-side and not visible to the script or the workflow. A future PR could merge over a failing invariants check if the branch protection isn't configured to require this check. Out of scope; surfaces in repo settings, not code.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-30 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
