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
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TARGET_DIRS = [
  join(REPO_ROOT, '.junie/playbooks'),
];

// Forbidden tokens, scoped to Kotlin/Java fenced blocks. Each entry: { token, why }.
// Match by substring, line-by-line, inside Kotlin/Java code blocks.
const FORBIDDEN = [
  // Servlet Spring Security (must use ServerHttpSecurity / SecurityWebFilterChain instead)
  { token: 'import org.springframework.security.config.annotation.web.builders.HttpSecurity', why: 'use ServerHttpSecurity (WebFlux)' },
  { token: 'import org.springframework.security.web.SecurityFilterChain',                     why: 'use SecurityWebFilterChain (WebFlux)' },
  { token: 'import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity', why: 'use @EnableWebFluxSecurity (WebFlux)' },
  { token: '@EnableWebSecurity',                                                              why: 'use @EnableWebFluxSecurity (WebFlux)' },

  // Servlet JWT decoder (must use ReactiveJwtDecoder / NimbusReactiveJwtDecoder)
  { token: 'import org.springframework.security.oauth2.jwt.JwtDecoder',                       why: 'use ReactiveJwtDecoder (WebFlux)' },
  { token: 'import org.springframework.security.oauth2.jwt.NimbusJwtDecoder',                 why: 'use NimbusReactiveJwtDecoder (WebFlux)' },

  // Servlet test stack (must use WebTestClient)
  { token: 'import org.springframework.test.web.servlet.MockMvc',                             why: 'use WebTestClient (WebFlux)' },
  { token: '@AutoConfigureMockMvc',                                                           why: 'use @AutoConfigureWebTestClient (WebFlux)' },
  { token: 'import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc', why: 'use @AutoConfigureWebTestClient (WebFlux)' },
  { token: 'import org.springframework.test.web.servlet.request.MockMvcRequestBuilders',      why: 'use WebTestClient request DSL (WebFlux)' },
  { token: 'import org.springframework.test.web.servlet.result.MockMvcResultMatchers',        why: 'use WebTestClient assertion DSL (WebFlux)' },

  // Servlet API
  { token: 'import jakarta.servlet',                                                          why: 'WebFlux has no servlet API (use Spring WebFlux types)' },
  { token: 'import javax.servlet',                                                            why: 'WebFlux has no servlet API (use Spring WebFlux types)' },
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
        if (line.text.includes(rule.token)) {
          violations.push({
            file: relative(REPO_ROOT, file),
            line: line.n,
            token: rule.token,
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
