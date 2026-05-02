#!/usr/bin/env node
// Scaffolding auth-policy invariant. Scans `.junie/playbooks/**/*.md`
// for JavaScript / TypeScript code blocks and prose that would re-introduce
// a dummy-token MSAL fallback OR catch-and-substitute auth pattern.
//
// The hardened auth boundary (R6 / R6a / R8 / R11 / SC1 / SC6) requires:
//   - Production `auth.js` delegates to `msalConfig.js`'s `hardenedGetToken`.
//   - Dev-only `auth-stub.js` carries the pre-committed sentinel UUID and is
//     resolved by Vite alias ONLY in `mode in ['development', 'test']`.
//   - No third auth module, no inline `getToken` mock, no
//     `.catch(() => 'STUB-JWT' / 'auth-stub-token' / 'dummy')` fallback.
//
// This invariant catches drift in the playbook templates BEFORE a scaffolded
// project ships the v3 leak class. Round-26 of the adversarial loop closed
// the most recent re-introduction (playbook 02 Step 3 told scaffolders to
// generate a mocked-getToken auth.js); this script makes a similar
// re-introduction surface as a CI failure.
//
// Exit codes:
//   0  clean — no forbidden patterns
//   1  one or more forbidden patterns detected (file:line + token printed)
//
// Run from repo root: `node scripts/check-auth-policy.mjs`

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TARGET_DIRS = [
  join(REPO_ROOT, '.junie/playbooks'),
];

// Each rule: { pattern, why }. Pattern is matched substring-style on every
// line inside JS / TS fenced blocks AND on prose lines. We scan prose too
// because playbook 02's regression was in narrative bullets, not in a code
// block.
const FORBIDDEN = [
  { pattern: 'STUB-JWT',                           why: 'v3 stub-JWT literal — auth-stub.js must not return a hardcoded token name' },
  { pattern: 'auth-stub-token',                    why: 'token-name literal that would survive tree-shaking and ship in prod' },
  { pattern: 'dummy JWT',                          why: 'auth.js must NOT generate a dummy JWT — it is the hardened MSAL delegator (playbook 04 Step 4)' },
  { pattern: 'dummy-token',                        why: 'same as above; alternate phrasing' },
  { pattern: 'mocked getToken',                    why: 'production auth.js must delegate to hardened MSAL; mocking is dev-stub only' },
  { pattern: 'mocked `getToken',                   why: 'backticked variant of the same prose pattern' },
  { pattern: 'mock getToken',                      why: 'imperative variant of the same prose pattern' },
  // Catch-and-substitute: `.catch(() => 'something')`. We match the most
  // common token-substitute literals so legitimate `.catch(() => null)` /
  // `.catch(err => log(err))` patterns continue to pass.
  { pattern: ".catch(() => 'STUB",                 why: "the v3 .catch(() => 'STUB-JWT') leak class — R8 forbids it" },
  { pattern: ".catch(() => 'stub",                 why: 'lowercase variant of the same leak class' },
  { pattern: '.catch(() => "STUB',                 why: 'double-quoted variant of the same leak class' },
  { pattern: ".catch(() => 'auth-stub",            why: 'auth-stub-token leak class' },
  { pattern: '.catch(() => "auth-stub',            why: 'double-quoted auth-stub-token leak class' },
];

// Allowlist of file:line:pattern triplets that are legitimate prose mentions
// of forbidden tokens — i.e., the playbooks explaining why these patterns
// are forbidden. Update sparingly. Each entry must include a justification
// comment.
const ALLOWLIST = new Set([
  // Playbook 02 Step 3 prose explaining what NOT to generate.
  '.junie/playbooks/02-frontend-scaffold.md:dummy JWT',
  '.junie/playbooks/02-frontend-scaffold.md:dummy-token',
]);

function listMarkdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listMarkdownFiles(path));
    } else if (path.endsWith('.md')) {
      out.push(path);
    }
  }
  return out;
}

function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of FORBIDDEN) {
      if (line.includes(rule.pattern)) {
        const rel = relative(REPO_ROOT, file);
        const allowKey = `${rel}:${rule.pattern}`;
        if (ALLOWLIST.has(allowKey)) continue;
        violations.push({
          file: rel,
          line: i + 1,
          pattern: rule.pattern,
          why: rule.why,
          excerpt: line.trim().slice(0, 120),
        });
      }
    }
  }
  return violations;
}

let totalFiles = 0;
let totalViolations = 0;
const allViolations = [];

for (const dir of TARGET_DIRS) {
  for (const file of listMarkdownFiles(dir)) {
    totalFiles++;
    const v = scanFile(file);
    if (v.length > 0) {
      totalViolations += v.length;
      allViolations.push(...v);
    }
  }
}

if (totalViolations === 0) {
  console.log(`Auth-policy invariant: clean (0 violations across ${totalFiles} playbook files).`);
  console.log('Hardened auth boundary (R6/R6a/R8/R11) — no dummy-JWT or catch-and-substitute patterns.');
  process.exit(0);
}

console.error(`Auth-policy invariant: FAIL — ${totalViolations} violation(s) in ${totalFiles} files.`);
console.error('Hardened auth boundary forbids dummy-JWT generation and catch-and-substitute fallbacks.');
console.error('');
for (const v of allViolations) {
  console.error(`  ${v.file}:${v.line}  pattern: ${v.pattern}`);
  console.error(`     → ${v.why}`);
  console.error(`     excerpt: ${v.excerpt}`);
}
process.exit(1);
