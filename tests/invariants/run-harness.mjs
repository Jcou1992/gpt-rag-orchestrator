#!/usr/bin/env node
// tests/invariants/run-harness.mjs
//
// Negative-control harness for the three repo-side invariant scripts.
// Closes /codex:adversarial-review round-31 finding: a CI gate that only
// runs the production scan can be made green by weakening the script
// itself in the same PR. This harness exercises each script against
// committed known-bad fixtures and asserts non-zero exit + the expected
// violation text in stderr/stdout. If any script silently stops rejecting
// its known-bad input, this harness fails the build.
//
// Each case picks ONE fixture directory and ONE invariant script, runs
// the script with `JUNIE_PLAYBOOKS_DIR` pointed at the fixture, and
// asserts:
//   - exit status is non-zero (FAIL on clean exit — the script forgot to
//     reject known-bad input)
//   - stderr+stdout contains a sentinel substring proving the script
//     failed for the RIGHT reason (FAIL on launch errors / unrelated
//     failures masquerading as a successful rejection)
//
// Run from repo root: `node tests/invariants/run-harness.mjs`

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

// Each case asserts (a) script exits non-zero, (b) violation count matches
// the expected count exactly, and (c) every per-rule "sentinel substring"
// appears at least once in the output.
//
// Why both checks? Sentinel substrings can overlap (e.g., the stack
// invariant's `import ...MockMvc` is a prefix of `import ...MockMvcRequest
// Builders`), so a removed rule may still appear to "match" a substring
// from a different rule. The exact violation-count assertion is the
// real guard against partial rule removal: removing any rule drops the
// count by at least one. The sentinel list is the additional guard
// against a script that exits non-zero for an unrelated reason.
//
// `expectedViolations` is the count of fixture lines that should trigger
// the script. Update this when you add or remove a forbidden entry from
// the corresponding fixture file.
const cases = [
  {
    name: 'R5 (inline-schema)',
    script: 'scripts/check-r5-invariant.mjs',
    fixtureDir: resolve(__dirname, 'fixtures/bad-r5'),
    expectedViolations: 1,                  // one inline-schema block
    sentinels: ['oneOf'],
  },
  {
    name: 'stack (servlet imports)',
    script: 'scripts/check-stack-invariant.mjs',
    fixtureDir: resolve(__dirname, 'fixtures/bad-stack'),
    // 23 entries in FORBIDDEN (13 FQN + 10 wildcard). Fixture coverage:
    //  - 11 FQN imports (one per FQN rule that has an import line)
    //  - 1  @AutoConfigureMockMvc usage line (annotation rule firing
    //       alongside the import rule)
    //  - 1  @EnableWebSecurity usage line
    //  - 2  FQN-without-import lines (round-33: HttpSecurity + SecurityFilterChain)
    //  - 10 wildcard import lines (round-34); two of them
    //       (`jakarta.servlet.*`, `javax.servlet.*`) double-match because
    //       the `\bjakarta\.servlet\b` / `\bjavax\.servlet\b` rules also
    //       match the prefix.
    expectedViolations: 27,
    sentinels: [
      'HttpSecurity',
      'SecurityFilterChain',
      'EnableWebSecurity',
      'JwtDecoder',
      'NimbusJwtDecoder',
      'MockMvc',
      'AutoConfigureMockMvc',
      'MockMvcRequestBuilders',
      'MockMvcResultMatchers',
      'jakarta.servlet',
      'javax.servlet',
    ],
  },
  {
    name: 'auth-policy (dummy JWT + catch-substitute + obsolete env vars)',
    script: 'scripts/check-auth-policy.mjs',
    fixtureDir: resolve(__dirname, 'fixtures/bad-auth'),
    // Set during the harness build-out; re-confirmed after every rule
    // change. Maintains the same property: removing a rule drops the
    // count and the harness fails.
    expectedViolations: 58,                 // 49 (round-45) + 9 round-46 indirection lines (3 alias + 2 destructure + 2 bracket-indirect + 2 calls on indirect bracket)
    sentinels: [
      'STUB-JWT',
      'auth-stub-token',
      'dummy JWT',
      'dummy-token',
      'mocked getToken',
      'mock getToken',
      ".catch(() => 'STUB",
      ".catch(() => 'stub",
      '.catch(() => "STUB',
      ".catch(() => 'auth-stub",
      '.catch(() => "auth-stub',
      'VITE_MSAL_TENANT_ID',
      'VITE_MSAL_API_SCOPE',
      'RAG_API_URL',
      'catch-and-substitute',     // structural regex label — proves the
                                   // round-33 non-literal substitute rule fires
      'catch-fn-substitute',      // round-35 function-expression handler rule
      'localStorage-backed JWT',  // round-44 localStorage-JWT phrase rule
      'stub JWT in localStorage', // round-44 alternate phrasing
      'JWT in localStorage',      // round-44 generic
      'token in localStorage',    // round-44 token variant
      'localStorage-api-call',    // round-45 localStorage method-call regex
      'localStorage-bracket-access', // round-45 localStorage bracket-access regex
      'localStorage-alias',       // round-46 alias declaration
      'localStorage-destructure', // round-46 destructuring
      'localStorage-bracket-indirect', // round-46 ['localStorage']
    ],
  },
];

let failures = 0;

for (const c of cases) {
  const scriptPath = resolve(repoRoot, c.script);
  if (!existsSync(scriptPath)) {
    console.error(`[harness] FAIL: invariant script missing at ${c.script}`);
    failures++;
    continue;
  }
  if (!existsSync(c.fixtureDir)) {
    console.error(`[harness] FAIL: fixture dir missing at ${c.fixtureDir}`);
    failures++;
    continue;
  }

  const result = spawnSync(
    process.execPath,
    [scriptPath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
      env: {
        ...process.env,
        JUNIE_PLAYBOOKS_DIR: c.fixtureDir,
      },
    },
  );

  if (result.error) {
    console.error(`[harness] FAIL: ${c.name} — could not launch script: ${result.error.message}`);
    failures++;
    continue;
  }

  if (result.status === 0) {
    console.error(`[harness] FAIL: ${c.name} — script EXITED ZERO against known-bad fixture.`);
    console.error(`         Script: ${c.script}`);
    console.error(`         Fixture: ${c.fixtureDir}`);
    console.error(`         The invariant has been weakened or the fixture no longer triggers it.`);
    console.error(`         stdout: ${(result.stdout || '').slice(0, 200)}`);
    failures++;
    continue;
  }

  const combined = (result.stderr || '') + (result.stdout || '');

  // Parse the violation count from the script's `FAIL — N violation(s)`
  // line. Each invariant script emits this exact phrasing on its first
  // error line; pinning to it avoids regex drift on per-rule wording.
  const countMatch = combined.match(/FAIL[^\n]*?(\d+)\s+violation\(s\)/i);
  if (!countMatch) {
    console.error(`[harness] FAIL: ${c.name} — could not parse violation count from output.`);
    console.error(`         Expected line matching /FAIL[^\\n]*?(\\d+)\\s+violation\\(s\\)/.`);
    console.error(`         Output (first 20 lines):`);
    console.error(combined.split('\n').slice(0, 20).map((l) => '            ' + l).join('\n'));
    failures++;
    continue;
  }
  const actualViolations = parseInt(countMatch[1], 10);
  if (c.expectedViolations >= 0 && actualViolations !== c.expectedViolations) {
    console.error(`[harness] FAIL: ${c.name} — violation count mismatch.`);
    console.error(`         Expected: ${c.expectedViolations}`);
    console.error(`         Got:      ${actualViolations}`);
    console.error(`         A drop in count means a forbidden rule was removed or disabled.`);
    console.error('         A rise means a new fixture line lacks an `expectedViolations` bump.');
    console.error(`         Output (first 30 lines):`);
    console.error(combined.split('\n').slice(0, 30).map((l) => '            ' + l).join('\n'));
    failures++;
    continue;
  }

  // Sentinel-substring check. Catches scripts that exit non-zero for an
  // unrelated reason (launch error, malformed fixture) or that produce
  // the right count via redirection to a different set of rules.
  const missing = c.sentinels.filter((s) => !combined.includes(s));
  if (missing.length > 0) {
    console.error(`[harness] FAIL: ${c.name} — ${missing.length} of ${c.sentinels.length} expected sentinels were NOT in output.`);
    console.error(`         Missing sentinels:`);
    for (const s of missing) console.error(`           - "${s}"`);
    failures++;
    continue;
  }

  const countNote = c.expectedViolations >= 0 ? `${actualViolations}/${c.expectedViolations}` : `${actualViolations}`;
  console.log(`[harness] PASS: ${c.name} — fixture rejected correctly (violations: ${countNote}; ${c.sentinels.length} sentinels present).`);
}

if (failures > 0) {
  console.error('');
  console.error(`[harness] ${failures} case(s) failed. Invariant scripts are not reliably enforcing their boundaries.`);
  process.exit(1);
}

console.log('');
console.log(`[harness] All ${cases.length} invariant scripts correctly reject their known-bad fixtures.`);
process.exit(0);
