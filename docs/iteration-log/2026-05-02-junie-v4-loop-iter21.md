# Junie Skill v4 — Iteration 21

**Date:** 2026-05-02
**Loop step:** post-iteration-21 (adversarial)

## Pre-iteration state

`/codex:adversarial-review` round 21 verdict: **needs-attention**. The IPv4-mapped IPv6 loopback fix from iteration 20 is correct, but the adversarial pass surfaced an orthogonal high-severity bypass class: the `local-auth` mode introduced in iteration 17 is gated on `import.meta.env.MODE` only, which is a build-time string. `vite build --mode local-auth` therefore bakes `mode === 'local-auth'` into a production bundle and the loopback allow-list silently activates in prod.

## Codex adversarial review — single finding

1. **[high]** `.junie/playbooks/04-contract-tests.md:424-504` — `isLocalRedirectAllowed = ALLOWS_LOCAL_REDIRECT.has(mode)` trusts only `import.meta.env.MODE`. A CI / deploy script that runs `vite build --mode local-auth` produces a production bundle in which the placeholder validator accepts `localhost`, `127/8`, `::1`, `::ffff:127.x.y.z`, and the IPv4-mapped IPv6 forms iteration 20 just hardened against. Same impact class (loopback redirect URI shipping in production) as round-18 medium-1, reached through a different code path. Doc says "use `pnpm dev --mode local-auth`" but nothing in the code actually enforces dev-server-only.

## Brainstorming summary

- The mistake is conflating two orthogonal flags: `mode` is a build-time string the developer chose; `import.meta.env.PROD` / `import.meta.env.DEV` is what Vite sets based on the actual command (`vite dev` vs `vite build`). `mode` alone cannot tell us whether the bundle is going to a CDN.
- Fix has two layers: (a) gate `isLocalRedirectAllowed` on `!import.meta.env.PROD` AND `ALLOWS_LOCAL_REDIRECT.has(mode)` so `vite build --mode local-auth` flips `PROD=true` and the allow-list collapses; (b) defense-in-depth — at module load, if `PROD && mode === 'local-auth'`, render the same config-error screen the placeholder validator uses and throw, halting before MSAL initializes.
- Layer (b) makes the failure loud and unambiguous in CI/CD logs. Without it, layer (a) would silently downgrade to "loopback URIs are rejected" — the user would see the placeholder error screen but never know the root cause was the build mode.
- Codex also recommended a regression test (`vite build --mode local-auth` with a loopback URI). That test belongs to a future iteration that wires the leak/contract test runner; this iteration restricts itself to the `msalConfig.js` template change because the runtime test surface in the current playbook is read-only static.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Gate loopback allow-list on `!import.meta.env.PROD` (closes the bypass) | `.junie/playbooks/04-contract-tests.md` | `isLocalRedirectAllowed` derivation references `!import.meta.env.PROD` |
| 2 | Add explicit fail-loud guard for `PROD && mode === 'local-auth'` (defense-in-depth) | `.junie/playbooks/04-contract-tests.md` | Module-load check throws + renders config-error screen for that combination |

## Changes made

- **Loopback allow-list now gated on Vite's `PROD` flag.**
  - `const isLocalRedirectAllowed = ALLOWS_LOCAL_REDIRECT.has(mode);` → `const isLocalRedirectAllowed = !import.meta.env.PROD && ALLOWS_LOCAL_REDIRECT.has(mode);`.
  - Comment block above the constant explains the difference between `MODE` (build-time string) and `PROD` (Vite's dev-vs-build flag), and explicitly names the round-21 adversarial bypass as the closed attack class so future readers don't "simplify" the gate back.
- **Module-load fail-loud guard for the misconfiguration.**
  - At module load, immediately after the constants, an `if (import.meta.env.PROD && mode === 'local-auth')` block renders a config-error screen ("Production build with a developer auth mode") and throws `Error('msalConfig: PROD build with --mode local-auth is forbidden.')`.
  - Screen explains what happened and what to do (`Rebuild without --mode local-auth and redeploy`). Same rendering pattern as the existing placeholder validator so the visual treatment is consistent.
  - Guard is wrapped in a `typeof document !== 'undefined'` check so the throw still fires under headless test environments where `document` is not present (jsdom `pretty good` but `document` may be substituted in odd ways) — without that guard, a test runner could throw inside `getElementById` before the `throw` line and surface a confusing error.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- Tracing the bypass scenario by hand: `vite build --mode local-auth` → `import.meta.env.MODE === 'local-auth'`, `import.meta.env.PROD === true`. Module load → `if (PROD && mode === 'local-auth')` is true → config-error screen renders → `throw` halts. Even without the throw, `isLocalRedirectAllowed = !true && ...` short-circuits to `false`, so the placeholder validator rejects every loopback host. Two independent defenses against the same misconfiguration.
- Standard `vite dev --mode local-auth` (the documented Mode 2 invocation): `MODE='local-auth'`, `PROD=false`, `DEV=true`. The fail-loud guard does not fire. `isLocalRedirectAllowed = !false && true = true`. Loopback URIs are accepted, real MSAL resolves to localhost. Documented dev workflow continues to work.
- Standard `vite build` (production deploy without the mode flag): `MODE='production'`, `PROD=true`. Guard does not fire (`mode !== 'local-auth'`). `isLocalRedirectAllowed = !true && ... = false`. Loopback URIs rejected. Production posture unchanged.

## Remaining gaps (anticipated for next adversarial round)

- The guard fires only if `import.meta.env.PROD` is true. Some build pipelines run Vite in `library` mode or use custom `define` to override env vars; the guard relies on Vite's own dev/build distinction holding. Out of scope for this iteration; if Codex flags it next round, parameterize the check.
- `import.meta.env.PROD` is replaced at build time as a literal `true` / `false` in the bundle. Tools that re-bundle the output (Webpack downstream, etc.) cannot re-evaluate it. The guard works because Vite is the locked frontend stack invariant — see guidelines.md.
- Static-analysis confidence: the playbook still embeds the entire `msalConfig.js` template as a fenced JS block, not under `scripts/`. A future iteration could add a runtime regression test that simulates `vite build --mode local-auth` and asserts the throw fires; that test would need a frontend test harness which the v4 playbook scaffolds but does not exercise. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-21 changes.
- Re-run `/codex:adversarial-review`. Loop terminates only when verdict is `ready` / no findings.
