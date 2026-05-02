# Junie Skill v4 — Iteration 23

**Date:** 2026-05-02
**Loop step:** post-iteration-23 (adversarial)

## Pre-iteration state

Round 23 adversarial verdict: **needs-attention**. Iteration 22 added a build-time guard in `vite.config.js` and a regression check in `package.json`, but the regression check itself is not portable: it uses POSIX shell negation (`! vite build --mode local-auth`) inside the `package.json` `scripts` value. Targets running cmd.exe / PowerShell can't interpret `!` as command negation, so `pnpm test` fails before Vitest runs even when the Vite guard is correct. The Node-based portable command was shown only as prose, not wired into the script entry.

## Codex adversarial review — single finding

1. **[medium]** `.junie/playbooks/04-contract-tests.md:429-432` — `package.json` `check:no-local-auth-build` uses POSIX `!` negation. Same playbook explicitly avoids POSIX shell features in Step 1 (the Node-driven `mkdir`/`statSync` rewrite from iteration 14) because the scaffolded target may run on Windows. The regression check just re-introduced the same drift class. Codex also flagged a secondary concern: even if the negation worked, it passes whenever the inner `vite build` exits non-zero — including unrelated failures (missing dep, syntax error elsewhere) that mask a regressed guard.

## Brainstorming summary

- Two layers in the fix: (a) ship the regression check as a checked-in `scripts/check-no-local-auth-build.mjs`, not a one-liner; (b) the script must assert the specific guard-sentinel substring in stderr, not just non-zero exit, so unrelated build failures don't mask a regression.
- Sentinel value picked: `'vite build --mode local-auth is forbidden'`. This is the first sentence of the guard's `Error` message in `vite.config.js`. The regression check's `GUARD_SENTINEL` is a substring of the actual message; `combined.includes(GUARD_SENTINEL)` matches without coupling to trailing punctuation.
- Cross-shell concerns surface in three places: process invocation (use `spawnSync` with `shell: false`), binary path (resolve `node_modules/.bin/vite` or `vite.cmd` per `process.platform === 'win32'`), and string concatenation (Node string ops are platform-agnostic, no further care needed).
- A secondary class of false-pass: `vite build` failing because `node_modules/` is empty. The script pre-checks `existsSync(viteBin)` and exits 1 with an instructional message — surfaces "ran the check before installing deps" as a separate failure mode rather than a silent pass.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Replace POSIX-`!` script with a checked-in Node script that asserts guard sentinel | `.junie/playbooks/04-contract-tests.md` | `scripts/check-no-local-auth-build.mjs` template present; `package.json` script invokes `node scripts/check-no-local-auth-build.mjs`; sentinel substring matches the guard message |

## Changes made

- **Step 5b regression check rewritten as a checked-in Node script.**
  - The non-portable POSIX one-liner `"check:no-local-auth-build": "! vite build --mode local-auth"` is replaced with `"check:no-local-auth-build": "node scripts/check-no-local-auth-build.mjs"` — works identically on cmd.exe, PowerShell, bash, zsh.
  - New template file `scripts/check-no-local-auth-build.mjs` (full script body inline in the playbook):
    - Resolves the local Vite binary by `process.platform`-aware path (`node_modules/.bin/vite` vs `node_modules/.bin/vite.cmd`).
    - `spawnSync` with `shell: false` so no shell interpretation happens — args go directly to the Vite binary.
    - Three exit-code branches:
      - status 0 → guard regressed → exit 1 with explicit "EXITED ZERO" message.
      - status non-zero AND stderr does not contain `GUARD_SENTINEL` → build failed for a different reason → exit 1 with the first 20 lines of combined output for diagnosis.
      - status non-zero AND stderr contains `GUARD_SENTINEL` → guard fired correctly → exit 0 with PASS message.
    - Pre-check: `existsSync(viteBin)` returns instructional failure ("Run pnpm install first") if the binary is missing — separates "deps not installed" from "guard regressed".
  - Three explicit guarantees stated in Step 5b prose: cross-shell portability, sentinel-text assertion, direct `package.json` wiring (no prose-only fallback).
  - `GUARD_SENTINEL` is the first sentence of the `Error` message thrown in `vite.config.js`. Comment in the script reminds future contributors to update both sites if the wording changes.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n 'vite build --mode local-auth is forbidden' .junie/playbooks/04-contract-tests.md` → 2 matches (the guard `Error` message + the `GUARD_SENTINEL` constant in the regression script). Substring relationship is verified by hand: the constant is contained in the full message.
- `grep -nE '"check:no-local-auth-build":' .junie/playbooks/04-contract-tests.md` → 1 match — value is `"node scripts/check-no-local-auth-build.mjs"` (no `!` operator anywhere).
- Manual trace of the four scenarios:
  - Guard intact, deps installed, `vite build --mode local-auth` invoked: Vite exits non-zero with sentinel in stderr → script exits 0 → `pnpm test` continues to Vitest.
  - Guard regressed (someone removed the throw): Vite exits 0 → script exits 1 → `pnpm test` halts.
  - Guard intact but unrelated build failure (e.g., syntax error in another file): Vite exits non-zero, sentinel NOT in stderr → script exits 1 with the first 20 lines of output → contributor sees the unrelated failure surfaced rather than masked.
  - `node_modules/` not installed: `existsSync(viteBin)` false → script exits 1 with instructional message → contributor knows to run `pnpm install` first.

## Remaining gaps (anticipated for next adversarial round)

- The script asserts `GUARD_SENTINEL` is a substring of stderr+stdout. If a future contributor changes the guard's wording to a synonym ("rejected", "disallowed", etc.) without updating `GUARD_SENTINEL`, the regression check will silently fail-closed — exit 1 every run. That's the correct posture (over-strict beats under-strict for security regressions), but the next adversarial round may flag the coupling. If so, lock the wording with a unit test on the error message itself.
- The script does not catch the case where someone replaces the build guard with a `console.error` (no exit). The `command === 'build'` factory is required by Vite to either return a config or throw; `console.error` then falls through to a successful build. Codex didn't flag this; backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-23 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
