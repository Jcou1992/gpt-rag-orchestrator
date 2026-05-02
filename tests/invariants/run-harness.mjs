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

const cases = [
  {
    name: 'R5 (inline-schema)',
    script: 'scripts/check-r5-invariant.mjs',
    fixtureDir: resolve(__dirname, 'fixtures/bad-r5'),
    sentinel: 'oneOf',  // R5 violation message includes the offending key set
  },
  {
    name: 'stack (servlet imports)',
    script: 'scripts/check-stack-invariant.mjs',
    fixtureDir: resolve(__dirname, 'fixtures/bad-stack'),
    sentinel: 'HttpSecurity',
  },
  {
    name: 'auth-policy (dummy JWT + catch-substitute + obsolete env vars)',
    script: 'scripts/check-auth-policy.mjs',
    fixtureDir: resolve(__dirname, 'fixtures/bad-auth'),
    sentinel: 'STUB-JWT',
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
  if (!combined.includes(c.sentinel)) {
    console.error(`[harness] FAIL: ${c.name} — script exited non-zero but stderr+stdout does NOT contain sentinel "${c.sentinel}".`);
    console.error(`         The script may have failed for an unrelated reason (launch error, missing dep, etc.) rather than rejecting the known-bad fixture.`);
    console.error(`         Got:`);
    console.error(combined.split('\n').slice(0, 10).map((l) => '            ' + l).join('\n'));
    failures++;
    continue;
  }

  console.log(`[harness] PASS: ${c.name} — script correctly rejected fixture (sentinel "${c.sentinel}" present).`);
}

if (failures > 0) {
  console.error('');
  console.error(`[harness] ${failures} case(s) failed. Invariant scripts are not reliably enforcing their boundaries.`);
  process.exit(1);
}

console.log('');
console.log(`[harness] All ${cases.length} invariant scripts correctly reject their known-bad fixtures.`);
process.exit(0);
