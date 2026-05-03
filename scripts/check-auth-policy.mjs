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
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
// Target dirs. Auth-policy invariant covers playbooks AND guides
// (round-43 closure: `.junie/guides/REFACTORING_SUMMARY.md` carried
// stale "stub JWT in localStorage" wording that contradicted the
// hardened auth invariant; the playbook-only scan never caught it).
//
// Override env var (`JUNIE_PLAYBOOKS_DIR`) replaces both — the harness
// in `tests/invariants/` points at a fixture dir to exercise the script
// against known-bad inputs and asserts non-zero exit.
const TARGET_DIRS = process.env.JUNIE_PLAYBOOKS_DIR
  ? [resolve(process.env.JUNIE_PLAYBOOKS_DIR)]
  : [
      join(REPO_ROOT, '.junie/playbooks'),
      join(REPO_ROOT, '.junie/guides'),
    ];

// Substring-matched forbidden tokens. Each rule: { pattern, why }.
// Matched substring-style on every line inside JS / TS fenced blocks AND
// on prose lines. We scan prose too because playbook 02's regression
// was in narrative bullets, not in a code block.
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
  // Obsolete env-var names that drift the scaffold away from playbook 04
  // Step 6's startup validator. Substring-matched because each name is a
  // unique full identifier (no parent name embeds it).
  { pattern: 'VITE_MSAL_TENANT_ID',                 why: 'obsolete env-var name; validator does NOT look it up — use VITE_MSAL_AUTHORITY instead' },
  { pattern: 'VITE_MSAL_API_SCOPE',                 why: 'obsolete env-var name; validator does NOT look it up — use VITE_API_SCOPE instead' },
  // localStorage-backed JWT phrases — round-44 closure. Round 43 expanded
  // the scan to guides AFTER the v3 phrases were rewritten, but the rule
  // list never matched the actual phrases. A future contributor could
  // re-introduce the same wording with CI green. These exact substrings
  // are flagged as a defense-in-depth complement to the structural rules
  // above.
  { pattern: 'localStorage-backed JWT',             why: 'R6a: dev stub token MUST be module-scoped, never persisted to localStorage (XSS / extension exfil resistance)' },
  { pattern: 'stub JWT in localStorage',            why: 'R6a: dev stub token MUST be module-scoped, never persisted to localStorage' },
  { pattern: 'JWT in localStorage',                 why: 'R6a: tokens MUST NOT be persisted in localStorage — module-scoped dev stub only' },
  { pattern: 'token in localStorage',               why: 'R6a: tokens MUST NOT be persisted in localStorage — module-scoped dev stub only' },
];

// Word-boundary / structural regex rules.
const FORBIDDEN_REGEX = [
  {
    regex: /\bRAG_API_URL\b/,
    label: 'RAG_API_URL',
    why: 'env var must be VITE_RAG_API_URL — Vite exposes only VITE_-prefixed names to the bundle',
  },
  // localStorage API access — round-45 closure. R6a forbids ANY token
  // persistence in localStorage; the iter-44 phrase rules only matched
  // English prose, so a code regression like
  // `localStorage.setItem('jwt', token)` would have shipped uncaught.
  // Method-call form covers `setItem` / `getItem` / `removeItem` / `clear`
  // / `key` / `length` API surface. Any legitimate use (e.g., a debug
  // flag) needs an explicit allow-anchor.
  {
    regex: /\blocalStorage\s*\.\s*(setItem|getItem|removeItem|clear|key|length)\b/,
    label: 'localStorage-api-call',
    why: 'R6a: tokens MUST NOT be persisted in localStorage. ANY localStorage API access in a scaffolded auth/api surface is forbidden by default; allow-anchor explicitly if non-token use is unavoidable.',
  },
  // Bracket-access form covers `localStorage['jwt']` / `localStorage["x"]`.
  {
    regex: /\blocalStorage\s*\[\s*['"]/,
    label: 'localStorage-bracket-access',
    why: 'R6a: tokens MUST NOT be persisted in localStorage; bracket access is the same anti-pattern as setItem/getItem.',
  },
  // Structural catch-and-substitute (round-33 / round-34 closures).
  //
  // Catches every `.catch(... => <body>)` shape — including:
  //   - `async` arrow heads:        `.catch(async () => fallback)`
  //   - multi-line catches:         `.catch(\n  () => fallback\n)`
  //   - non-literal substitutes:    `.catch(() => makeDevToken())`,
  //                                  `.catch(() => cachedToken)`
  //
  // The `[\s\S]` runs match across newlines and the `multiline: false`
  // semantics of `^/$` are not needed here. The rule is applied on the
  // entire file contents (`scanFileMultiline`), not line-by-line, so a
  // cross-line catch can't slip past.
  //
  // Legitimate uses (e.g., re-throwing) need an explicit allow-anchor
  // (the multi-line scan also resolves anchors against the line of the
  // `.catch(` head).
  {
    multiline: true,
    regex: /\.catch\s*\(\s*(?:async\s+)?(?:\([\s\S]*?\)|[A-Za-z_$][\w$]*)?\s*=>\s*[^)\s][\s\S]*?\)/g,
    label: 'catch-and-substitute',
    why: 'production auth.js / ragApi.js MUST throw on getToken failure (R8) — any `.catch(... => ...)` substitution silently downgrades the auth boundary',
  },
  // Round-35 + round-36 closures: function-expression catch handler in
  // ANY shape — bare, async-prefixed, parenthesized, or with intervening
  // comments. Match `.catch(<anything-but-paren-or-curly>* function ...)`.
  //
  // The `[^){}]*?` segment between `.catch(` and `function` allows:
  //   - whitespace                    `.catch(  function ...)`
  //   - `async` keyword               `.catch(async function ...)`
  //   - block comments                `.catch(/* note */ function ...)`
  //   - line comments (no newline)    `.catch(// note\n function ...)` *
  //   - extra parenthesization        `.catch((function ...))`
  //   - combinations                  `.catch(async /* note */ function ...)`
  //
  // (* the [\s\S] in the lazy quantifier crosses newlines, so a `//`
  // comment that ends with a newline followed by `function` on the next
  // line still resolves.)
  //
  // Excluded by `[^){}]`: `)` (would close the `.catch(`), `{` and `}`
  // (would suggest we already passed into a function body or another
  // block — keeps the regex from spanning into unrelated code).
  //
  // Legitimate re-throw handlers need an explicit allow-anchor.
  {
    multiline: true,
    regex: /\.catch\s*\(\s*[^){}]*?\bfunction\b[\s\S]*?\)\s*\{[\s\S]*?\}/g,
    label: 'catch-fn-substitute',
    why: 'production auth.js / ragApi.js MUST throw on getToken failure (R8) — any `.catch(... function ...)` handler is forbidden (parenthesized, async, commented variants included) unless the body re-throws unconditionally (use an explicit allow-anchor)',
  },
];

// Allowlist of legitimate prose mentions of forbidden tokens. Each entry
// names the playbook anchor (a stable `<!-- auth-policy-allow:<id> -->`
// HTML comment placed immediately before the prose line) plus the exact
// pattern that line is allowed to contain. Anchor-based allowlisting means
// adding a new prose mention REQUIRES adding a new anchor + a new allowlist
// entry; it is not enough to be in the same file. This closes the round-27
// allowlist-too-broad finding (file-scope allowlist allowed any future
// `dummy JWT` anywhere in the same playbook to silently pass).
//
// To allow-list a new line: add `<!-- auth-policy-allow:my-anchor -->`
// immediately before the line, then add `'my-anchor:exact pattern'` here.
const ALLOWLIST = new Set([
  // Playbook 02 Step 3 prose explaining what NOT to generate. Same
  // anchor allows both patterns at the same prose location.
  'pb02-step3-no-dummy-token:dummy JWT',
  'pb02-step3-no-dummy-token:dummy-token',
  // Playbook 02 Step 1 .env.example callout: explicitly names obsolete
  // env-var forms in negative ("do NOT emit") prose.
  'pb02-step1-env-do-not-emit:VITE_MSAL_TENANT_ID',
  'pb02-step1-env-do-not-emit:VITE_MSAL_API_SCOPE',
  'pb02-step1-env-do-not-emit:RAG_API_URL',
  // Playbook 02 Step 3 MSAL-now branch: same negative-prose pattern.
  'pb02-step3-env-do-not-use:VITE_MSAL_TENANT_ID',
  'pb02-step3-env-do-not-use:VITE_MSAL_API_SCOPE',
  // Playbook 02 Environment-variables docs section: lead-in negative prose.
  'pb02-envvars-do-not-use:VITE_MSAL_TENANT_ID',
  'pb02-envvars-do-not-use:VITE_MSAL_API_SCOPE',
  // Playbook 05 .env.local example block: negative reminder for the
  // obsolete env-var names so the docs explicitly warn against them.
  'pb05-env-do-not-use:VITE_MSAL_TENANT_ID',
  'pb05-env-do-not-use:VITE_MSAL_API_SCOPE',
  // Playbook 04 retry click handler — fire-and-forget catch on a UI
  // re-trigger of ensureInitialized. NOT a credential substitution: the
  // bootstrap's own try/catch re-renders the recovery UI on failure.
  'pb04-retry-noop-catch:catch-and-substitute',
  // Playbook 05 DEBUG-flag localStorage usage — explicitly NOT a token
  // store. Documented for browser-console debugging only; the scaffolder
  // does not generate this code path into the application.
  'pb05-debug-flag-localstorage:localStorage-api-call',
]);

// Pattern used by every allow-listed prose line to mark itself as exempt.
// Must be on the line IMMEDIATELY ABOVE the line that contains the
// forbidden token. The anchor id is captured into capture group 1.
const ALLOW_ANCHOR_RE = /<!--\s*auth-policy-allow:([a-z0-9][a-z0-9-]*)\s*-->/i;

// Anchored variant — matches ONLY when the entire trimmed line is the
// marker (start-of-string + end-of-string), so a line that mixes the
// marker with arbitrary other text is NOT skipped during scanning. Used
// in the per-line short-circuit; ALLOW_ANCHOR_RE remains the form used
// when resolving the anchor id during the backwards walk.
//
// Allows an optional `//` prefix so the anchor can be embedded inside a
// JS/TS code block as a JS line comment. Markdown prose still works
// without the prefix.
const STANDALONE_ANCHOR_RE = /^(?:\/\/\s*)?<!--\s*auth-policy-allow:([a-z0-9][a-z0-9-]*)\s*-->$/i;

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
    // Skip allowlist-anchor lines themselves — anchor IDs may contain
    // forbidden tokens (e.g., `pb02-step3-no-dummy-token`) and would
    // otherwise self-trigger a violation. Strict: the entire trimmed
    // line must be JUST the anchor marker. Anything else on the line
    // (e.g. `<!-- auth-policy-allow:foo --> Generate a dummy-token...`)
    // is scanned normally — this closes the round-28 same-line bypass
    // where forbidden prose could ride on an anchor line.
    if (STANDALONE_ANCHOR_RE.test(line.trim())) continue;

    // Helper: resolve allowlist by walking backwards over blank lines to
    // the nearest non-blank line. The previous line must be a STANDALONE
    // anchor (entire trimmed content is the marker, nothing else) — a
    // mixed line like `<!-- auth-policy-allow:foo --> harmless prose`
    // is rejected because it would otherwise let an anchor resolve for
    // the line *after* it without any explicit allowlist intent.
    // Round-29 closed this drift class.
    const isAllowed = (label) => {
      for (let k = i - 1; k >= 0; k--) {
        const prev = lines[k];
        if (prev.trim() === '') continue;
        const trimmed = prev.trim();
        if (!STANDALONE_ANCHOR_RE.test(trimmed)) return false;
        const m = trimmed.match(ALLOW_ANCHOR_RE);
        if (m && ALLOWLIST.has(`${m[1]}:${label}`)) return true;
        return false;
      }
      return false;
    };

    const rel = relative(REPO_ROOT, file);

    // Substring rules.
    for (const rule of FORBIDDEN) {
      if (!line.includes(rule.pattern)) continue;
      if (isAllowed(rule.pattern)) continue;
      violations.push({
        file: rel,
        line: i + 1,
        pattern: rule.pattern,
        why: rule.why,
        excerpt: line.trim().slice(0, 120),
      });
    }

    // Regex rules — line-scoped only (skip multiline rules, handled below).
    for (const rule of FORBIDDEN_REGEX) {
      if (rule.multiline) continue;
      if (!rule.regex.test(line)) continue;
      if (isAllowed(rule.label)) continue;
      violations.push({
        file: rel,
        line: i + 1,
        pattern: rule.label,
        why: rule.why,
        excerpt: line.trim().slice(0, 120),
      });
    }
  }

  // Multi-line regex rules — applied to the entire file content so that
  // catch-substitute patterns split across lines (round-34 bypass) are
  // caught. Line number derived from the match's index.
  const rel = relative(REPO_ROOT, file);

  // Strip JS/TS comments before applying multiline regexes — closes the
  // round-37 bypass class where a `.catch(/* fallback {tok} */ function ...)`
  // comment containing `{` defeated the `[^){}]*?` gap regex. We replace
  // every comment with whitespace of the same length so line/column
  // offsets are preserved (line numbers we report still match the user's
  // editor view). Substring/line-scoped rules above continue to scan the
  // RAW text — they intentionally still flag forbidden tokens hidden in
  // comments (e.g., `// dummy JWT`).
  const commentStripped = text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))   // /* ... */
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (full, p1) => p1 + ' '.repeat(full.length - p1.length));  // // ... (avoid eating URLs like https://)

  for (const rule of FORBIDDEN_REGEX) {
    if (!rule.multiline) continue;
    // Ensure the regex has the `g` flag for repeated `exec`.
    const re = rule.regex.flags.includes('g')
      ? rule.regex
      : new RegExp(rule.regex.source, rule.regex.flags + 'g');
    let m;
    while ((m = re.exec(commentStripped)) !== null) {
      const lineNumber = commentStripped.slice(0, m.index).split('\n').length;
      // Allowlist resolution: walk backwards from the line of the match
      // for a STANDALONE anchor (same semantics as the line-scoped path).
      let allowed = false;
      for (let k = lineNumber - 2; k >= 0; k--) {
        const prev = lines[k];
        if (prev.trim() === '') continue;
        const trimmed = prev.trim();
        if (!STANDALONE_ANCHOR_RE.test(trimmed)) break;
        const am = trimmed.match(ALLOW_ANCHOR_RE);
        if (am && ALLOWLIST.has(`${am[1]}:${rule.label}`)) { allowed = true; }
        break;
      }
      if (allowed) continue;
      violations.push({
        file: rel,
        line: lineNumber,
        pattern: rule.label,
        why: rule.why,
        excerpt: m[0].replace(/\s+/g, ' ').slice(0, 120),
      });
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
