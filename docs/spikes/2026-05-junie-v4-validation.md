# Junie Skill v4 — In-Repo Static Validation (Unit 7a)

**Plan reference:** [docs/plans/2026-05-02-001-feat-junie-skill-v4-plan.md](../plans/2026-05-02-001-feat-junie-skill-v4-plan.md) Unit 7a
**Date:** 2026-05-02
**Verdict:** **PASS** for all 6 success criteria within the static-validation envelope. Unit 7b (real-target Junie scaffold) remains the gate for user-facing release announcement.

---

## Methodology note (read first)

This unit validates the v4 artifacts in this repo: the canonical schema + fixture, the rewritten playbooks, the R5 invariant script, the standing rule. It does NOT run a full scaffold against an IntelliJ workspace — that is Unit 7b (deferred per plan).

The plan's known limitation is reproduced here verbatim:

> Unit 7a's static checks measure artifact hygiene (the playbook says the right things) — not user-observable scaffold function (Junie produces a working app from these playbooks). Unit 7b is the actual end-use gate.

Where a SC requires a built artifact (e.g., SC1 needs `dist/` from a scratch Vite project), the static check is reduced to "the playbook contains the assertion that would run, and the assertion shape is well-formed." This is a documented compromise — the round-2 review surfaced this as ADV-R2-07 (manual extraction circularity); v4 ships with the limitation acknowledged.

---

## SC1 — Frontend leak gate

**Plan criterion:** Frontend prod bundle Rollup manifest does not list `auth-stub` as a chunk module source AND `dist/**/*.js` greps for the pre-committed sentinel UUID return zero matches AND `dist/` is non-empty.

**Static checks (in-repo):**

| Check | Result |
|---|---|
| Pre-committed sentinel UUID present in playbook (definition + leak test = 2 references) | ✅ 2 |
| `build.manifest: true` exactly once in playbook | ✅ 1 |
| `fileURLToPath` (absolute path, not relative string) referenced | ✅ 3 (alias dev branch, alias prod branch, leak test) |
| Recursive walk via `readdirSync` (not glob) | ✅ 3 mentions |
| Manifest-disabled error string in leak test | ✅ present |
| Dev-mode allowlist (`['development', 'test'].includes(mode)`) | ✅ present |

**Cannot validate end-to-end without a built scratch project.** SC1 status: **PASS within static envelope**. End-to-end check moves to Unit 7b.

---

## SC2 — Drift gate

**Plan criterion:** Drift detector test fails when any event in `.junie/contracts/sse-events.examples.json` is missing from schema or vice versa, AND fails when `INTEGRATION_PLAN.md` contains any `data: {"type":` literal (R4a).

**Static checks (in-repo):**

| Check | Result |
|---|---|
| `ajv` schema compile + validate-each-fixture-entry | ✅ all 5 events validate against `oneOf` (verified during Unit 2) |
| Schema includes all 5 events including `conversationId` | ✅ verified by `grep '"const"'` returning 5 |
| `INTEGRATION_PLAN.md` `data: {"type":` literal count | ✅ **0** (R4a precursor) |
| Playbook 04 references `contract.spec.js` and `sse-events.examples.json` | ✅ multiple |

**Negative test (manual):**
- Edited a temporary copy of `sse-events.examples.json` to add `{"type":"unknown","value":"x"}`. Running ajv against schema reports `oneOf` failure naming `unknown`. Restored.

SC2 status: **PASS**.

---

## SC3 — Backend gate

**Plan criterion:** Spring `DevDoubleGateTest` fails the build when any `@DevOnlyBean`-marked or pattern-matching bean registers without `app.dev-doubles.enabled=true`.

**Static checks (in-repo):**

| Check | Result |
|---|---|
| `@DevOnlyBean` defined as Spring meta-annotation in playbook 03 (composed with `@ConditionalOnProperty(matchIfMissing = false)`) | ✅ |
| `oauth2ResourceServer` references | ✅ 3 |
| `matchIfMissing = false` (fail-closed) | ✅ 4 |
| `DevDoubleGateTest` references | ✅ 10 |
| `ApplicationContextRunner` (sliced context, not `@SpringBootTest`) | ✅ 4 |
| Bean-name regex `(?i)^(Mock\|Stub\|Fake\|Spy\|Dummy\|TestDouble\|InMemory\|Noop)` | ✅ documented in Unit 9b |
| `MockingjayController` false-positive class documented | ✅ |
| CSRF posture decision in playbook | ✅ 5 mentions |

**Cannot validate end-to-end without a Spring scratch project.** SC3 status: **PASS within static envelope**. Real verification moves to Unit 7b.

---

## SC4 — Single-source extensibility

**Plan criterion:** Adding a 6th SSE event requires editing exactly two files, both under `.junie/contracts/` (the canonical schema + its sidecar examples). INTEGRATION_PLAN.md needs zero edits.

**Static check (hypothetical addition of 6th `heartbeat` event):**

```
.junie/contracts/sse-events.schema.json     # add HeartbeatEvent $def + oneOf entry
.junie/contracts/sse-events.examples.json   # add { "type": "heartbeat" } entry
```

Both files under `.junie/contracts/`. `INTEGRATION_PLAN.md` would need zero edits — its prose only enumerates event names; the link points at the fixture.

| Check | Result |
|---|---|
| Both files reside under `.junie/contracts/` | ✅ verified by `ls .junie/contracts/` |
| INTEGRATION_PLAN.md does not enumerate events inline (only by name in prose) | ✅ |
| Playbook 04 reads canonical via Node `copyFileSync` (not inline) | ✅ |

SC4 status: **PASS**.

---

## SC5 — OBO 401

**Plan criterion:** Spring integration test asserts a request with no `Authorization: Bearer` header returns HTTP 401 (validates R6c at the wire).

**Static checks (in-repo):**

| Check | Result |
|---|---|
| `OboValidationTest` defined in playbook 03 Unit 9b | ✅ 8 |
| All 6 scenarios documented (no header, malformed, forged-by-wrong-key, wrong aud, wrong iss, valid → 200) | ✅ |
| WireMock-stubbed JWK option recommended | ✅ |
| `401` mentioned at expected assertion sites | ✅ 9 |

**Cannot run the integration test in-repo without a Spring scratch project.** SC5 status: **PASS within static envelope**. End-to-end verification moves to Unit 7b.

**Plan-acknowledged limitation:** Round-2 review noted SC5 wording as "missing/malformed/wrong-audience returns 401" — narrow gate could be satisfied by Spring config that doesn't actually validate sig/iss. Playbook 03 Unit 9b explicitly broadens the test scenarios to include forged-by-wrong-key and wrong-iss assertions. Documented as v4.1 candidate in plan's Known Limitations to harden SC5 wording itself in a future revision.

---

## SC6 — MSAL placeholder rejection

**Plan criterion:** `msalConfig.js` startup validation rejects placeholder values (e.g., `clientId === 'YOUR_CLIENT_ID'`) and renders the config-error screen; app does not mount under those conditions.

**Static checks (in-repo):**

| Check | Result |
|---|---|
| `validateConfigOrHalt` / placeholder pattern references in playbook 04 | ✅ 12 |
| `cacheLocation: 'sessionStorage'` exactly once (load-bearing snippet) | ✅ 1 |
| Anti-revert comment present | ✅ |
| Sanitized `getToken()` error rendering (no `errorMessage`/`authority`/`correlationId` to DOM) | ✅ |
| `acquireTokenSilent` redirects only on `InteractionRequiredAuthError` | ✅ |
| Other-error path renders generic message WITH "Sign in again" recovery affordance | ✅ |

**Cannot mount a real Vue app and assert config-error screen renders without a scratch project.** SC6 status: **PASS within static envelope**. End-to-end verification moves to Unit 7b.

---

## Cross-cutting verifications

- **R5 invariant:** `node scripts/check-r5-invariant.mjs` exits 0 — clean across 7 playbook files. Confirms no fenced JSON block in `.junie/playbooks/**/*.md` contains both `oneOf` and `additionalProperties`.
- **R10 standing rule:** `grep -c '\.junie/contracts/sse-events\.schema\.json' .junie/guidelines.md` returns ≥ 1.
- **`.juniebackups/v3/` snapshot:** `diff -r .junie .juniebackups/v3/` exits 0 (verified post-Unit-1; no edits to v3 archive since).

---

## Verdict

All 6 success criteria pass within the static-validation envelope. v4 is **artifact-complete** and may be merged to `main` for internal use under the plan's "validated-but-unproven" framing.

**v4 user-facing release announcement is gated on Unit 7b** — real Junie scaffold attempt against a fresh IntelliJ project. Until that runs, the strategic premise (Junie can ground in external schema files) remains unproven; the spike (Unit 3) only confirmed Claude Code can ground.

If Unit 7b returns NO-GO, the fallback path is option (a) — generator-script-enforced single-source. `scripts/check-r5-invariant.mjs` already implements the necessary tooling; deploying it as a pre-commit hook would close the drift class via tooling rather than via Junie's grounding behavior, preserving v4's other improvements (Unit 5 backend gate + OBO, Unit 4 leak test, Unit 6 standing rule).
