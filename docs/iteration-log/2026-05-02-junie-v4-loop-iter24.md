# Junie Skill v4 — Iteration 24

**Date:** 2026-05-02
**Loop step:** post-iteration-24 (adversarial)

## Pre-iteration state

Round 24 adversarial verdict: **needs-attention**. Iteration 23's regression check is pure Node and uses `spawnSync(..., { shell: false })`, but it resolves the Vite binary as `node_modules/.bin/vite.cmd` on Windows. `.cmd` files are shell scripts — they cannot be launched without a shell. `spawnSync` with `shell: false` against a `.cmd` shim fails with `ENOENT` / `EINVAL` on cmd.exe / PowerShell targets, which means `pnpm test` blocks before Vite even runs and the guard is never exercised.

## Codex adversarial review — single finding

1. **[medium]** `.junie/playbooks/04-contract-tests.md:461-474` — Windows path picks `vite.cmd`, but `.cmd` shims can't be launched without a shell. `shell: false` is correct for security/portability hygiene, but the binary choice is wrong for that flag. Codex also noted a related gap: `result.error` (when `spawnSync` itself fails to launch) is currently treated identically to a regressed guard — a launch failure surfaces as "FAIL: vite build EXITED ZERO" or "FAIL: build failed but NOT for the guard reason", both of which are misleading.

## Brainstorming summary

- The fix has two prongs: (a) launch Vite through Node directly so no `.cmd` shim is involved, (b) handle `result.error` as its own explicit failure mode.
- Vite ships its CLI script at `node_modules/vite/bin/vite.js`. Invoking it via `spawnSync(process.execPath, [viteCli, ...])` is what npm and pnpm do internally — the canonical cross-platform way to run a Node-based CLI tool. No shell, no `.cmd` shim, no quoting hazards.
- `process.execPath` is the absolute path to the running Node interpreter. Spawning it directly with the CLI script as the first arg means the OS launches Node natively (Windows doesn't need a shell for `node.exe`), which is the launching path that always works.
- For (b): check `result.error` before `result.status` and exit with a distinct message ("could not launch Vite"). A `pnpm install` failure / corrupted node_modules will then surface as itself rather than masking the security regression check.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Switch the regression script from `vite.cmd` to invoking `node node_modules/vite/bin/vite.js` via `process.execPath` | `.junie/playbooks/04-contract-tests.md` | Script resolves `node_modules/vite/bin/vite.js`; spawns `process.execPath` with the CLI path as first arg |
| 2 | Add explicit `result.error` branch | `.junie/playbooks/04-contract-tests.md` | Branch handles launch failure separately; emits "could not launch Vite" message |

## Changes made

- **Vite invocation now goes through `process.execPath`.**
  - Removed the `process.platform === 'win32' ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite'` branch.
  - New `viteCli = resolve(projectRoot, 'node_modules/vite/bin/vite.js')` resolution. Same path on Windows / macOS / Linux. No `.cmd` shim involved.
  - `spawnSync` arguments rewritten as `process.execPath, [viteCli, 'build', '--mode', 'local-auth']`. `process.execPath` is Node's own absolute path and is launchable without a shell on every platform.
  - Existence check (`existsSync(viteCli)`) updated to point at the new path; failure message updated ("Vite CLI not found at … Run `pnpm install`").
  - Comment block in the script header explains why `.cmd` was removed and why this pattern matches what npm/pnpm do internally — future contributors won't "simplify" it back to `.bin/vite.cmd`.
- **Explicit `result.error` branch.**
  - New `if (result.error)` block runs before the status check and exits 1 with the launch error's `.message`. `result.error` is what `spawnSync` populates when it cannot start the child process at all (binary missing, permission denied, OS limit) — distinct from `result.status` (the child exited with a non-zero code).
  - Comment names the failure mode being closed: a launch failure must not be misinterpreted as either a guard regression (`status === 0` branch) or a guard hit but-wrong-message (`!combined.includes` branch).

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `grep -n 'node_modules/.bin/vite\.cmd' .junie/playbooks/04-contract-tests.md` → 0 matches (the `.cmd` shim is gone).
- `grep -n 'process.execPath' .junie/playbooks/04-contract-tests.md` → 1 match in the `spawnSync` call.
- `grep -n 'result.error' .junie/playbooks/04-contract-tests.md` → 2 matches (branch declaration + message extraction).
- Manual trace of failure modes:
  - Vite CLI present, guard fires: `result.error` undefined, `result.status` non-zero, sentinel in stderr → exit 0 (PASS).
  - Vite CLI present, guard regressed: `result.error` undefined, `result.status === 0` → exit 1 with "EXITED ZERO" message.
  - Vite CLI present, build fails for unrelated reason: `result.error` undefined, `result.status` non-zero, sentinel NOT in stderr → exit 1 with "NOT for the guard reason" message + first 20 output lines.
  - `node_modules/vite/bin/vite.js` missing: `existsSync` false → exit 1 with "Run `pnpm install`" message.
  - Node cannot spawn (e.g., binary deleted between existsSync and spawn): `result.error` set → exit 1 with "could not launch Vite" + the error message.

## Remaining gaps (anticipated for next adversarial round)

- `process.execPath` could be a symlink that breaks under unusual setups (e.g., asdf shim swapping the binary out from under us mid-run). spawnSync would either work or set `result.error` — the latter case is now handled. Treating this as covered.
- The script trusts the locally installed Vite to actually evaluate `vite.config.js`. A `vite.config.ts` (TypeScript variant) requires a Vite version that handles TS configs natively; the doc still pins `vite: ^5.4.0` which does. Backlog: assert the resolved Vite version supports TS configs if/when the TypeScript opt-in lands in practice.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-24 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
