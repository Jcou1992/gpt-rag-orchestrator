#!/usr/bin/env node
// Scaffolding stack invariant: scan .junie/playbooks/**/*.md for forbidden
// servlet/MVC imports inside Kotlin/Java code blocks. The locked stack is
// Vue 3 + Vite 5+ + Kotlin + Spring Boot WebFlux (NOT Spring MVC). Servlet
// templates in a WebFlux scaffold either fail to compile or wire the wrong
// runtime path (auth boundary missing on the reactive endpoints).
//
// Exit codes:
//   0  clean — no forbidden imports
//   1  one or more forbidden imports detected (file:line + token printed)
//
// Run from repo root: `node scripts/check-stack-invariant.mjs`

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
// Target dir override (see check-r5-invariant.mjs for rationale —
// the harness in `tests/invariants/` exercises the script against
// fixtures and asserts non-zero exit). `resolve` accepts both absolute
// and relative paths; relative paths resolve against the current cwd
// of the harness, which is what we want.
const TARGET_DIRS = [
  process.env.JUNIE_PLAYBOOKS_DIR
    ? resolve(process.env.JUNIE_PLAYBOOKS_DIR)
    : join(REPO_ROOT, '.junie/playbooks'),
];

// Forbidden patterns scoped to Kotlin/Java fenced blocks. Each entry:
// { regex, label, why }. We use regex with `\b...\b` boundaries (instead of
// substring with an `import ` prefix) so FORBIDDEN types are caught both
// as imports AND as fully-qualified-name usages without an import — the
// round-33 bypass: `var http: org.springframework...HttpSecurity` would
// otherwise compile against an unimported but transitively available
// servlet type and silently re-introduce Spring MVC wiring on a WebFlux
// scaffold. `\b` ensures `MockMvc` matches but `MockMvcRequestBuilders`
// does not (separate rule for the longer FQN).
const FORBIDDEN = [
  // Servlet Spring Security (must use ServerHttpSecurity / SecurityWebFilterChain instead)
  { regex: /\borg\.springframework\.security\.config\.annotation\.web\.builders\.HttpSecurity\b/,                why: 'use ServerHttpSecurity (WebFlux)' },
  { regex: /\borg\.springframework\.security\.web\.SecurityFilterChain\b/,                                       why: 'use SecurityWebFilterChain (WebFlux)' },
  { regex: /\borg\.springframework\.security\.config\.annotation\.web\.configuration\.EnableWebSecurity\b/,      why: 'use @EnableWebFluxSecurity (WebFlux)' },
  { regex: /@EnableWebSecurity\b/,                                                                                why: 'use @EnableWebFluxSecurity (WebFlux)' },

  // Servlet JWT decoder (must use ReactiveJwtDecoder / NimbusReactiveJwtDecoder)
  { regex: /\borg\.springframework\.security\.oauth2\.jwt\.JwtDecoder\b/,                                         why: 'use ReactiveJwtDecoder (WebFlux)' },
  { regex: /\borg\.springframework\.security\.oauth2\.jwt\.NimbusJwtDecoder\b/,                                   why: 'use NimbusReactiveJwtDecoder (WebFlux)' },

  // Servlet test stack (must use WebTestClient)
  { regex: /\borg\.springframework\.test\.web\.servlet\.MockMvc\b/,                                               why: 'use WebTestClient (WebFlux)' },
  { regex: /@AutoConfigureMockMvc\b/,                                                                              why: 'use @AutoConfigureWebTestClient (WebFlux)' },
  { regex: /\borg\.springframework\.boot\.test\.autoconfigure\.web\.servlet\.AutoConfigureMockMvc\b/,             why: 'use @AutoConfigureWebTestClient (WebFlux)' },
  { regex: /\borg\.springframework\.test\.web\.servlet\.request\.MockMvcRequestBuilders\b/,                       why: 'use WebTestClient request DSL (WebFlux)' },
  { regex: /\borg\.springframework\.test\.web\.servlet\.result\.MockMvcResultMatchers\b/,                         why: 'use WebTestClient assertion DSL (WebFlux)' },

  // Servlet API (matches fully-qualified usage like `jakarta.servlet.http.HttpServletRequest`)
  { regex: /\bjakarta\.servlet\b/,                                                                                 why: 'WebFlux has no servlet API (use Spring WebFlux types)' },
  { regex: /\bjavax\.servlet\b/,                                                                                   why: 'WebFlux has no servlet API (use Spring WebFlux types)' },
];

// Scan helpers
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

function* iterateCodeBlocks(text) {
  // Yields { lang, startLine (1-based), lines: [{ n, text }] } for each fenced block.
  const lines = text.split('\n');
  let inBlock = false;
  let blockLang = null;
  let blockStart = -1;
  let buffer = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Markdown spec allows up to 3 leading spaces before a fenced block.
    // Without the prefix, indented Kotlin/Java fences silently bypass the scan.
    const fence = line.match(/^\s{0,3}```([a-zA-Z0-9_+-]*)\s*$/);
    if (fence) {
      if (!inBlock) {
        inBlock = true;
        blockLang = (fence[1] || '').toLowerCase();
        blockStart = i + 2; // first content line is 1-based after the fence
        buffer = [];
      } else {
        if (blockLang === 'kotlin' || blockLang === 'java') {
          yield {
            lang: blockLang,
            lines: buffer.map((t, idx) => ({ n: blockStart + idx, text: t })),
          };
        }
        inBlock = false;
        blockLang = null;
        buffer = [];
      }
      continue;
    }
    if (inBlock) buffer.push(line);
  }
}

function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const violations = [];
  for (const block of iterateCodeBlocks(text)) {
    for (const line of block.lines) {
      for (const rule of FORBIDDEN) {
        const m = rule.regex.exec(line.text);
        if (m) {
          violations.push({
            file: relative(REPO_ROOT, file),
            line: line.n,
            token: m[0],
            why: rule.why,
            lang: block.lang,
          });
        }
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
  console.log(`Stack invariant: clean (0 violations across ${totalFiles} playbook files).`);
  console.log('Locked stack: Vue 3 + Vite 5+ + Kotlin + Spring Boot WebFlux. No servlet imports allowed.');
  process.exit(0);
}

console.error(`Stack invariant: FAIL — ${totalViolations} violation(s) in ${totalFiles} files.`);
console.error('Locked stack: Spring Boot WebFlux (reactive). Servlet imports are forbidden.');
console.error('');
for (const v of allViolations) {
  console.error(`  ${v.file}:${v.line}  [${v.lang}]  ${v.token}`);
  console.error(`     → ${v.why}`);
}
process.exit(1);
