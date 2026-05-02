# Junie Skill v4 — Iteration 28

**Date:** 2026-05-02
**Loop step:** post-iteration-28 (adversarial)

## Pre-iteration state

Round 28 adversarial verdict: **needs-attention**. Two new mediums plus a recommendation to extend the auth-policy invariant to cover env-var drift:

1. Playbook 02 Step 1 still tells the scaffolder to emit `.env.example` with `RAG_API_URL` (no `VITE_` prefix) and only `VITE_MSAL_CLIENT_ID`. The runtime, the validator, and Step 4 of the same playbook all use a different set: `VITE_RAG_API_URL`, `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_AUTHORITY`, `VITE_MSAL_REDIRECT_URI`, `VITE_API_SCOPE`. A scaffolder copying `.env.example` into `.env` and filling values gets the wrong URL var (Vite never exposes `RAG_API_URL` because there's no `VITE_` prefix) and three missing MSAL vars. App halts at the config-error screen.
2. The new auth-policy scanner from iteration 26-27 short-circuits any line matching `ALLOW_ANCHOR_RE`. A line like `<!-- auth-policy-allow:any-id --> Generate a dummy-token auth.js fallback` would be skipped entirely — the same-line combo of anchor + forbidden prose silently bypasses the check. Same drift class the script is meant to prevent.

## Codex adversarial review — findings

1. **[medium]** `.junie/playbooks/02-frontend-scaffold.md:43` — `.env.example` generation instruction emits stale + incomplete env-var names. Real availability regression for any scaffold that follows Step 1 literally.
2. **[medium]** `scripts/check-auth-policy.mjs:99-102` — anchor-line skip uses `test()`, not `^...$` against the trimmed line. Forbidden tokens on the same line as an anchor get a free pass.

Codex also recommended extending the invariant to reject `RAG_API_URL`, `VITE_MSAL_TENANT_ID`, and `VITE_MSAL_API_SCOPE` in active playbook env-var instructions. Same drift class that surfaced now needs a CI gate.

## Brainstorming summary

- For (1): rewrite the Step 1 `.env.example` instruction with all five exact var names, ALL `VITE_`-prefixed. Surface the obsolete forms in negative prose so a scaffolder reading the instruction sees both the right answer and what to avoid. Mirror the same fix in playbook 05's `.env.local` template (it had the same drift) and the Azure Entra ID setup section's `export VITE_MSAL_*` block (also drifted to `TENANT_ID` / `API_SCOPE`).
- For (2): tighten the anchor-line skip from `ALLOW_ANCHOR_RE.test(line)` to `STANDALONE_ANCHOR_RE.test(line.trim())` — only skip lines whose entire trimmed content is the marker. A line that mixes anchor + arbitrary text is scanned normally.
- Codex's third request (extend the invariant): add a `FORBIDDEN_REGEX` array for word-boundary-aware patterns. `RAG_API_URL` requires regex (substring would false-positive inside `VITE_RAG_API_URL`); `VITE_MSAL_TENANT_ID` and `VITE_MSAL_API_SCOPE` are unique full identifiers, so substring works. Allowlist legitimate negative-prose mentions via the new anchor protocol.
- Side benefit: extending the invariant surfaced an env-var drift in playbook 05 that NO prior round had caught (`VITE_MSAL_TENANT_ID=<tenant-id>` in the `.env.local` block AND in the `export ...` snippet). Iteration 28 fixes both.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Rewrite playbook 02 Step 1 `.env.example` instruction with five correct VITE_-prefixed names | `.junie/playbooks/02-frontend-scaffold.md` | Bullet lists exact validator names; obsolete names appear only in negative prose; anchor + allowlist entries added |
| 2 | Fix playbook 05 `.env.local` template + Azure setup `export` block | `.junie/playbooks/05-docs-generation.md` | Same VITE_-prefixed names; obsolete forms removed from active instructions; new anchor `pb05-env-do-not-use` added |
| 3 | Tighten same-line anchor-skip in scanner; introduce `STANDALONE_ANCHOR_RE` | `scripts/check-auth-policy.mjs` | Bypass test (anchor + forbidden text on same line) FAILS; clean run still passes |
| 4 | Extend invariant: substring rules for the two MSAL obsolete names + regex rule for `\bRAG_API_URL\b` | `scripts/check-auth-policy.mjs` | New `FORBIDDEN_REGEX` array; new substring entries; allowlist entries for the three legitimate negative-prose locations |

## Changes made

- **Playbook 02 Step 1 `.env.example` rewritten.**
  - Old: bullet listed `RAG_API_URL` and `VITE_MSAL_CLIENT_ID`.
  - New: bullet introduces a fenced block with all five VITE_-prefixed names + sample values (placeholder `YOUR_CLIENT_ID` / `<tenant-id>` / `<api-client-id>` so the validator's placeholder check fires loudly when a developer skips configuration).
  - Anchor `<!-- auth-policy-allow:pb02-step1-env-do-not-emit -->` placed immediately above the bullet so the negative-prose mention of the three obsolete names is allow-listed.
  - "TODO" branch carve-out: if MSAL was deferred, omit the four `VITE_MSAL_*` / `VITE_API_SCOPE` lines entirely. Step 3's throwing `getToken()` placeholder enforces the gap.
- **Playbook 05 fixes.**
  - `.env.local` template block: `VITE_MSAL_TENANT_ID` / `VITE_MSAL_API_SCOPE` removed from the active suggestion; replaced with `VITE_MSAL_AUTHORITY` / `VITE_MSAL_REDIRECT_URI` / `VITE_API_SCOPE`. Negative-prose comment line added with anchor `<!-- auth-policy-allow:pb05-env-do-not-use -->`.
  - Azure setup section's `export VITE_MSAL_*` block rewritten with the same four exact names; new step-by-step explicitly states "names MUST match playbook 04 Step 6 startup validator". Final paragraph updated to describe the `auth-stub.js` alias resolution (`mode in ['development', 'test']`) and explicit R8/SC6 invariant — replaces the old "fall back to a stub JWT" wording.
- **`check-auth-policy.mjs` same-line anchor hardening.**
  - New `STANDALONE_ANCHOR_RE = /^<!-- auth-policy-allow:... -->$/i` (note: anchored with `^...$`).
  - Per-line skip changed from `ALLOW_ANCHOR_RE.test(line)` to `STANDALONE_ANCHOR_RE.test(line.trim())`. The original `ALLOW_ANCHOR_RE` is retained for the backwards-walk allowlist resolution.
  - Comment block above the skip explicitly cites round-28 as the closed bypass: a line like `<!-- auth-policy-allow:foo --> dummy-token` is now scanned, not skipped.
- **`check-auth-policy.mjs` env-var rules added.**
  - New `FORBIDDEN_REGEX` array. Entry: `{ regex: /\bRAG_API_URL\b/, label: 'RAG_API_URL', why: '...' }`. The `\b...\b` boundaries prevent matches inside `VITE_RAG_API_URL`.
  - Two new substring rules in `FORBIDDEN`: `VITE_MSAL_TENANT_ID`, `VITE_MSAL_API_SCOPE`. Each `why` names the correct replacement.
  - `scanFile` now iterates both lists. `isAllowed(label)` helper unifies the allowlist resolution.
  - Six new `ALLOWLIST` entries: three anchors × two-or-three patterns each, covering the legitimate negative-prose mentions in playbooks 02 (Steps 1, 3, env-vars docs) and 05 (`.env.local` block).

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean (`0 violations across 7 playbook files`).
- Manual same-line-bypass regression: appended `<!-- auth-policy-allow:bypass-test --> Generate a dummy-token auth.js fallback.` to playbook 02. Re-ran the script: FAIL with the offending line surfaced (`pattern: dummy-token`). Reverted; clean.
- `grep -nE "VITE_MSAL_TENANT_ID|VITE_MSAL_API_SCOPE" .junie/playbooks/0[25]-*.md` → only 4 remaining matches, ALL inside negative-prose lines explicitly allow-listed via anchors. No active scaffold instruction emits the obsolete names.
- `grep -n "RAG_API_URL" .junie/playbooks/02-frontend-scaffold.md` → matches inside `VITE_RAG_API_URL` (correct) and inside the negative-prose anchor-allow-listed callout (`Do NOT emit \`RAG_API_URL\``). No bare `RAG_API_URL` outside negative prose.

## Remaining gaps (anticipated for next adversarial round)

- The anchor-and-allowlist now has 12 entries across 5 anchors. Volume is manageable but growing. If a future iteration adds many more, the manual upkeep cost rises. Backlog candidate: parse anchors from the playbooks at script run time and require an explicit per-anchor pattern manifest in a sidecar file (rather than hand-curated `ALLOWLIST` Set) so adding an anchor is one edit, not two.
- Cross-cutting: this iteration touched playbook 05 for the first time in the adversarial loop. There may be other documentation drift in playbook 05 the env-var pass didn't surface — Codex didn't enumerate them. Backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-28 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
