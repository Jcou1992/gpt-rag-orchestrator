# Junie Skill v4 — Iteration 22

**Date:** 2026-05-02
**Loop step:** post-iteration-22 (adversarial)

## Pre-iteration state

Round 22 adversarial verdict: **needs-attention**. Iteration 21's runtime guard inside `msalConfig.js` correctly closes the loopback allow-list bypass at user runtime — but `vite build --mode local-auth` still **succeeds** as a build, ships the artifact, and only fails when end users load the app. The guard didn't actually achieve the stated goal of "block local-auth in production builds" — it moved the failure to post-deploy user outage.

## Codex adversarial review — single finding

1. **[high]** `.junie/playbooks/04-contract-tests.md:448-460` — runtime guard in `msalConfig.js` is the wrong layer. The CI/deploy pipeline running `vite build --mode local-auth` exits zero because Vite never evaluates `import.meta.env.PROD` at build time (that's a bundle-side abstraction that gets *replaced* with a literal during build). The poisoned artifact publishes successfully, sign-in fails for users post-deploy, and the existing leak test (`pnpm build` followed by `leak.spec.js`) does not gate on this combination. Same impact class (loopback redirect URI ships in production) as the round-21 finding, reached one layer up.

## Brainstorming summary

- Two layers must fail: (a) Vite's build itself when `--mode local-auth` is passed, (b) the deploy pipeline if (a) is somehow bypassed. Layer (b) was iteration 21's runtime guard; layer (a) is missing.
- Vite config evaluation runs Node-side; `command` and `mode` are arguments to the `defineConfig` factory. `command === 'build' && mode === 'local-auth'` → throw. Vite catches the throw and exits non-zero before emitting any artifact. CI fails fast.
- Codex also recommended a regression check that proves the build guard fires. Add an explicit `package.json` scripts entry: `check:no-local-auth-build: "! vite build --mode local-auth"`. The negation passes when the inner command fails (i.e., when the guard threw). Wired into `pnpm test` so the check runs in every CI invocation. Equivalent cross-shell `node -e` form provided for Windows.
- Together: build-time guard (Vite) + deploy-time guard (msalConfig runtime) + regression check (CI). Three independent layers; weakening any one surfaces the failure in another.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Convert vite.config.js factory to receive `command` + `mode` and throw at build time when both flags match the bypass | `.junie/playbooks/04-contract-tests.md` | Factory signature is `({ command, mode })`; explicit `if (command === 'build' && mode === 'local-auth') throw` block present |
| 2 | Add regression-check Step 5b — package.json `check:no-local-auth-build` script + node -e cross-shell equivalent | `.junie/playbooks/04-contract-tests.md` | Step 5b block lists the script, gated by `pnpm test`, with explanation |

## Changes made

- **`vite.config.js` template — build-time guard.**
  - `defineConfig(({ mode }) => ({...}))` rewritten as `defineConfig(({ command, mode }) => { ... return {...}; })`.
  - Top of factory has explicit `if (command === 'build' && mode === LOCAL_AUTH_MODE) throw new Error(...)` block. Comment block above it explains why this layer exists despite the runtime guard already in `msalConfig.js`: Vite config evaluation is Node-side, `command` is the canonical Node-side signal, `import.meta.env` is bundle-side and not available here. The build guard fires before any artifact is emitted; the runtime guard fires post-deploy at first user load. Both layers must hold.
  - Error message names the offending flag and tells the user what to do (`Use the default 'production' mode to build deployable bundles`). CI logs surface the misconfig immediately.
  - `LOCAL_AUTH_MODE = 'local-auth'` constant introduced so the build guard and the dev-mode allowlist refer to the same string symbol.
- **Playbook 04 Step 5b — regression check.**
  - New Step 5b section follows the leak test, scoped explicitly to the build-mode bypass.
  - `package.json` snippet shows the `check:no-local-auth-build` script using shell negation (`! vite build --mode local-auth`) — passes only when Vite throws.
  - `test` script gated on the new check via `&&`.
  - Cross-shell-portable Node equivalent provided for Windows shells where `!` is not the standard negation operator.
  - One-paragraph rationale explains: a contributor weakening the build-time guard would see the regression check fail in CI, which surfaces the regression before the leak test even runs.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- Manual trace of the four scenarios:
  - `vite dev` (no flags) → `command='serve'`, mode='development'. Build guard skipped. Dev server runs.
  - `vite dev --mode local-auth` → `command='serve'`, mode='local-auth'. Build guard skipped (`command !== 'build'`). Mode 2 dev workflow continues to work.
  - `vite build` → `command='build'`, mode='production'. Build guard skipped (`mode !== 'local-auth'`). Production bundle emitted; runtime guard inactive (PROD=true but mode !== 'local-auth'). Loopback URIs rejected by `isPlaceholder`.
  - `vite build --mode local-auth` → `command='build'`, mode='local-auth'. **Build guard throws**, Vite exits non-zero, no artifact emitted. CI fails. Layer 2 (msalConfig runtime guard) and layer 3 (regression check) never need to fire because layer 1 already stopped the misconfig.
- The CI scripts block is the only documented test surface that gates on the build guard. Static check via `grep` after edits: `grep -n 'check:no-local-auth-build' .junie/playbooks/04-contract-tests.md` → 1 match (Step 5b script declaration).

## Remaining gaps (anticipated for next adversarial round)

- A scaffolder using a custom build tool that bypasses `vite.config.js` (e.g., direct Rollup) would not hit the build guard. Mitigation: the locked stack invariant in guidelines.md requires Vite. Out of scope for this iteration.
- Step 5b prescribes `package.json` scripts but does not validate that the scaffolded `package.json` actually contains them. A future iteration could parse the scaffolded `package.json` in a pre-commit check and assert the script is present. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-22 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
