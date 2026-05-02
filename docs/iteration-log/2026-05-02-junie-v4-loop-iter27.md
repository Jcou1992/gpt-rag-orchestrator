# Junie Skill v4 — Iteration 27

**Date:** 2026-05-02
**Loop step:** post-iteration-27 (adversarial)

## Pre-iteration state

Round 27 adversarial verdict: **needs-attention**. Two new mediums:

1. Playbook 02 Environment-variables docs section (L214-219) still listed `VITE_MSAL_TENANT_ID` and `VITE_MSAL_API_SCOPE` — names that the playbook 04 startup validator does NOT recognize. A scaffolder following the docs literally would set those four vars, the validator would still see `VITE_MSAL_AUTHORITY` / `VITE_MSAL_REDIRECT_URI` / `VITE_API_SCOPE` as undefined → placeholder → halt at config-error screen. Real availability regression.
2. `scripts/check-auth-policy.mjs:56-90` allowlist key was `<file>:<pattern>`, not `<file>:<line>:<pattern>`, so any future `dummy JWT` / `dummy-token` re-introduction anywhere in `02-frontend-scaffold.md` would be silently exempted. Same drift class the script was meant to prevent.

## Codex adversarial review — findings

1. **[medium]** `.junie/playbooks/02-frontend-scaffold.md:214-219` — `Environment variables` docs template lists the obsolete env-var names. Generated docs misaligned with the validator.
2. **[medium]** `scripts/check-auth-policy.mjs:56-90` — file-scope allowlist masks any same-file re-introduction. Critical bug in the new invariant script itself.

## Brainstorming summary

- For (1): rewrite the env-var bullet list to match exactly the four names the validator checks. Add a one-line note pointing readers at playbook 04 Step 6 and explicitly calling out the obsolete names so future drift doesn't sneak back in.
- For (2): line-number-keyed allowlist is brittle (every line edit invalidates the entry). Better: anchor-based allowlisting via a stable HTML comment marker `<!-- auth-policy-allow:<id> -->` placed immediately above the prose line. Allowlist keys become `<anchor-id>:<pattern>`. The script walks backwards from a forbidden-token hit, skipping blank lines, to find the nearest non-blank line; if that line carries the anchor and the `(id, pattern)` pair is in `ALLOWLIST`, the hit is suppressed.
- Subtle bug in (2): forbidden tokens can appear inside the anchor IDs themselves (e.g., `pb02-step3-no-dummy-token` contains `dummy-token`). The scanner must SKIP anchor lines so they don't self-trigger violations. Add an `ALLOW_ANCHOR_RE.test(line)` short-circuit at the top of the per-line loop.
- Manual regression test for (2): introduce a fake `dummy JWT` line elsewhere in the same playbook, re-run the script, confirm exit-1 with the fake line surfaced. Revert. Rerun, confirm clean exit-0.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Rewrite the Environment variables docs section to match the validator | `.junie/playbooks/02-frontend-scaffold.md` | Bullets list `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_API_SCOPE`; obsolete names absent; lead-in note explains the alignment |
| 2 | Convert the auth-policy allowlist to anchor-based; add anchor lines to the existing legitimate prose | `scripts/check-auth-policy.mjs`, `.junie/playbooks/02-frontend-scaffold.md` | Allowlist keys are `<anchor-id>:<pattern>`; anchor regex defined; anchor lines themselves are skipped during scanning; manual fake-violation test fails |

## Changes made

- **Playbook 02 Environment variables list rewritten.**
  - Five bullets listing every var the runtime / validator actually reads:
    - `VITE_RAG_API_URL` (default `http://localhost:8080`).
    - `VITE_MSAL_CLIENT_ID`.
    - `VITE_MSAL_AUTHORITY` — full authority URL example given (`https://login.microsoftonline.com/<tenant-id>`).
    - `VITE_MSAL_REDIRECT_URI` — example given; explicit note about the loopback policy (only accepted in `development` / `test` / `local-auth`).
    - `VITE_API_SCOPE` — example given (`api://<api-client-id>/.default`).
  - Lead-in paragraph names the validator file (`src/auth/msalConfig.js`, playbook 04 Step 6), states that placeholder values halt the app at the config-error screen, and explicitly calls out `VITE_MSAL_TENANT_ID` and `VITE_MSAL_API_SCOPE` as **NOT** valid names. A scaffolder reading this section can no longer reproduce the bug.
- **Anchor-based allowlist in `check-auth-policy.mjs`.**
  - Added `ALLOW_ANCHOR_RE = /<!--\s*auth-policy-allow:([a-z0-9][a-z0-9-]*)\s*-->/i`. Captures the anchor id.
  - `scanFile` now: (a) short-circuits on lines that ARE anchor markers (the anchor id contains the forbidden token by design), (b) for each forbidden-token hit, walks backwards skipping blank lines to the nearest non-blank line, (c) checks that line for the anchor regex, (d) checks `ALLOWLIST.has(<anchor-id>:<pattern>)` and continues if so.
  - `ALLOWLIST` reduced to two entries, both keyed off the same anchor (`pb02-step3-no-dummy-token`) so one anchor authorizes both patterns at the same prose location.
  - Top-of-script comment block updated to spell out the anchor protocol — adding a new exempt prose line REQUIRES placing a new anchor + adding a new entry; same-file presence is no longer enough.
  - Anchor `<!-- auth-policy-allow:pb02-step3-no-dummy-token -->` placed immediately above the legitimate prose paragraph in playbook 02 Step 3.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 7 playbook files`).
- Manual regression test: appended `This line should not exist: dummy JWT regression.\n` to the END of `02-frontend-scaffold.md` (well past the legitimate-prose paragraph), ran the script, observed `FAIL — 1 violation(s)` with the fake line surfaced (line 302, `pattern: dummy JWT`). Reverted the file, re-ran, observed clean exit.
- `grep -n 'auth-policy-allow' .junie/playbooks/02-frontend-scaffold.md` → 1 match (the legitimate anchor); no stray markers.
- `grep -nE 'VITE_MSAL_TENANT_ID|VITE_MSAL_API_SCOPE' .junie/playbooks/02-frontend-scaffold.md` → 0 hits in instructions; only the explicit "NOT valid" callout remains in the lead-in note.
- Manual read of the new env-vars list confirms 1:1 alignment with `msalConfig.js`'s validator.

## Remaining gaps (anticipated for next adversarial round)

- The anchor-resolution walks backwards over blank lines only. A future contributor who places intervening prose between the anchor and the protected line would silently lose allowlist coverage on that line. That is the conservative direction (over-strict beats under-strict), but the next adversarial round may flag it as a usability cliff. Backlog candidate: extend the walk to include same-paragraph adjacency rules.
- The `pb02-step3-no-dummy-token` anchor authorizes BOTH `dummy JWT` and `dummy-token` patterns. The pattern set is closed under "tokens that appear in this paragraph"; if the prose adds a new forbidden token (e.g., `STUB-JWT`), the allowlist needs a new entry. Backlog candidate: allow `pattern: '*'` shorthand for "any forbidden token" if such a use case ever lands.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-27 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
