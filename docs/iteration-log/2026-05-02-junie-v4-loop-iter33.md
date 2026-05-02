# Junie Skill v4 — Iteration 33

**Date:** 2026-05-02
**Loop step:** post-iteration-33 (adversarial)

## Pre-iteration state

Round 33 adversarial verdict: **needs-attention**. Two new mediums — both are real bypass classes the production scripts left open even though the harness from iteration 32 verified the existing rules:

1. Auth-policy `.catch(... => ...)` rule was literal-only. A template using `.catch(() => makeDevToken())` / `.catch(() => cachedToken)` / `.catch(() => 'FAKE_JWT')` slips past the hand-curated `'STUB'` / `'auth-stub'` token list.
2. Stack invariant rules required an `import ` prefix. A fully-qualified usage like `var http: org.springframework.security.config.annotation.web.builders.HttpSecurity` (no import line) compiles against a transitively-available servlet type and silently re-introduces Spring MVC wiring on a WebFlux scaffold.

## Codex adversarial review — findings

1. **[medium]** `scripts/check-auth-policy.mjs:51-58` — literal-only catch-substitute coverage. Document a structural regex matching every `.catch(... => <body>)` shape, regardless of token contents.
2. **[medium]** `scripts/check-stack-invariant.mjs:30-52` — `import `-prefixed substring rules. Convert to FQN regex with `\b` boundaries so usage-without-import flags too.

## Brainstorming summary

- For (1), auth-policy: add a single structural `FORBIDDEN_REGEX` entry `/\.catch\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)?\s*=>\s*[^)\s][^)]*\)/`. Matches `.catch(() => x)`, `.catch(arg => x)`, `.catch((arg) => x)` for any non-trivial body `x`. Doesn't match `.catch()` alone or `.catch(handler)` (no arrow). Doubles up on the existing literal rules — same line gets matched by BOTH the literal substring rule AND the structural regex (defense in depth; count assertion in the harness verifies the structural rule actually fires for every `.catch` line).
- For (2), stack: convert the `FORBIDDEN` substring list to regex with `\b...\b` boundaries; drop the `import ` prefix so each FQN matches both as an import AND as a usage. `\b` ensures `MockMvc` matches but `MockMvcRequestBuilders` (separate rule) does not — the round-32 prefix-overlap class stays closed.
- The `scanFile` body in `check-stack-invariant.mjs` switches from `line.text.includes(rule.token)` to `rule.regex.exec(line.text)`. Match `m[0]` becomes the violation token (the actual matched substring rather than the rule's literal).
- Fixture additions:
  - bad-stack: a `class BadFqnUsage` that uses `org.springframework...HttpSecurity` and `org.springframework...SecurityFilterChain` as types in a function signature WITHOUT `import` lines. Two new violations.
  - bad-auth: four new `.catch(... => ...)` lines exercising different non-literal substitute shapes (`makeDevToken()`, `cachedToken`, `'FAKE_JWT'`, `(err) => fallbackTokenFor(err)`). Each line gets matched once by the new structural regex; the existing literal `.catch(... => 'STUB...')` lines now match TWICE (literal + structural).
- Harness updates:
  - `expectedViolations` for stack: 13 → 15 (+2 FQN-without-import lines).
  - `expectedViolations` for auth-policy: 16 → 25 (+9 from the structural rule firing on every `.catch(... =>` plus the new fixture lines).
  - `sentinels` for auth-policy gains `'catch-and-substitute'` (the new rule's `label`) so the harness explicitly verifies the structural rule fires.

## Plan summary

| Phase | Objective | Files | Validation |
|---|---|---|---|
| 1 | Convert stack invariant rules to FQN regex with `\b...\b`; update scanFile | `scripts/check-stack-invariant.mjs` | Production scan still `clean`; harness still PASS |
| 2 | Add structural `.catch(... => ...)` rule to auth-policy `FORBIDDEN_REGEX` | `scripts/check-auth-policy.mjs` | Production scan still `clean`; harness count rises (literal + structural double-match) |
| 3 | Extend fixtures: 2 FQN-without-import lines (bad-stack), 4 non-literal catch-substitute lines (bad-auth) | `tests/invariants/fixtures/bad-stack/servlet-import.md`, `tests/invariants/fixtures/bad-auth/dummy-token-fallback.md` | Fixture violation counts match new harness expectations |
| 4 | Update harness `expectedViolations` + sentinels | `tests/invariants/run-harness.mjs` | All 3 cases PASS; production scripts still clean |

## Changes made

- **`scripts/check-stack-invariant.mjs` rules converted to regex form.**
  - `FORBIDDEN` is now an array of `{ regex, why }` entries. Each rule uses `/\b...\b/` boundaries on the FQN — drops the `import ` prefix so the rule matches both `import org.springframework...HttpSecurity` AND `var x: org.springframework...HttpSecurity` (the FQN-without-import bypass).
  - `@EnableWebSecurity` and `@AutoConfigureMockMvc` annotation rules retain their `@`-prefixed shape; converted to `/@.../` regex form for consistency.
  - `scanFile` now uses `rule.regex.exec(line.text)` and stores `m[0]` (the actual matched substring) in the violation report, so error output continues to show the offending fragment verbatim.
- **`scripts/check-auth-policy.mjs` structural catch-substitute rule.**
  - New `FORBIDDEN_REGEX` entry `{ regex: /\.catch\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)?\s*=>\s*[^)\s][^)]*\)/, label: 'catch-and-substitute', why: '...' }`.
  - Comment block above the entry explicitly cites the round-33 bypass class so future contributors can't "simplify" the rule away.
  - Defense-in-depth: each `.catch(... => 'STUB...')` line now triggers BOTH the literal rule (substring `.catch(() => 'STUB`) AND the structural rule. Removing either rule still leaves the other catching the same line — but the count drops by exactly the number of catch-lines, and the harness's count assertion fires.
- **Fixture additions.**
  - `bad-stack/servlet-import.md` gains a new Kotlin block: `class BadFqnUsage` whose function signature uses `org.springframework...HttpSecurity` and `org.springframework...SecurityFilterChain` directly — no `import` lines. Adds 2 violations.
  - `bad-auth/dummy-token-fallback.md` gains four `.catch(... => ...)` lines: `makeDevToken()`, `cachedToken`, `'FAKE_JWT'`, `(err) => fallbackTokenFor(err)`. Adds 4 violations from the structural regex.
- **Harness counts + sentinels updated.**
  - stack: `expectedViolations: 13 → 15`.
  - auth-policy: `expectedViolations: 16 → 25` (existing 5 catch-lines × 2 rules each + 4 new catch-lines × 1 rule each + 11 other fixture violations = 25).
  - auth-policy `sentinels` gains `'catch-and-substitute'` so the harness explicitly verifies the new rule's label appears in the violation report.

## Verification

- `node scripts/check-r5-invariant.mjs` → clean.
- `node scripts/check-stack-invariant.mjs` → clean.
- `node scripts/check-auth-policy.mjs` → clean.
- `node tests/invariants/run-harness.mjs` → 3 PASS (R5: 1/1; stack: 15/15; auth-policy: 25/25).
- Manual round-33 bypass exercises:
  - Stack FQN-without-import: appended `var x: org.springframework.security.web.SecurityFilterChain = TODO()` to a Kotlin block in a temp playbook copy. Production scan flagged it (`SecurityFilterChain` regex match). Reverted.
  - Auth catch-and-substitute: appended `.catch(() => makeDevToken())` to a temp JS block. Production scan flagged it (`catch-and-substitute` regex match). Reverted.

## Remaining gaps (anticipated for next adversarial round)

- The structural catch-and-substitute regex is greedy on `[^)]*` after `=>`. A `.catch(err => { ... })` body that contains a `)` somewhere inside curly braces still terminates the match early, but the match still fires (which is fine — the rule is layered defense). A future iteration could distinguish between throwing and returning bodies via lightweight AST parsing.
- `\b` regex boundary semantics treat `_` as a word char. For type names containing `_` (none in current FORBIDDEN), the boundary would not match between a `_` and another word char. Not currently an issue; backlog candidate.
- Unit 7b (real-target Junie scaffold) still deferred.

## Next loop actions

- Commit + push iteration-33 changes.
- Re-run `/codex:adversarial-review`. Loop terminates when verdict is `ready` / no findings.
