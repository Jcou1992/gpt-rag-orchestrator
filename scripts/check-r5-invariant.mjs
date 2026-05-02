#!/usr/bin/env node
// scripts/check-r5-invariant.mjs
//
// Parser-level R5 invariant check.
//
// Walks `.junie/playbooks/**/*.md` (NOT `.junie/guides/**` — guides legitimately
// need didactic JSON-Schema examples that include both `oneOf` and
// `additionalProperties`).
//
// For every fenced ```json block, parses the contents as JSON and asserts that
// the parsed value does NOT contain BOTH `oneOf` and `additionalProperties`
// keys (at any nesting depth). If both keys appear in the same JSON document,
// that block is restating the canonical SSE schema inline — which violates R5
// (single-source-of-truth: the canonical schema lives only in
// `.junie/contracts/sse-events.schema.json`).
//
// Exit codes:
//   0 — clean, no violations
//   1 — violations found (each printed with file:line)
//
// Self-contained. ESM. No npm dependencies. Run with `node scripts/check-r5-invariant.mjs`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '..', '..');
// Target directory override. Production runs use the canonical
// `.junie/playbooks` tree. The harness in `tests/invariants/` overrides
// via `JUNIE_PLAYBOOKS_DIR` so the same script can be exercised against
// known-bad fixtures and asserted to exit non-zero.
const playbookDir = process.env.JUNIE_PLAYBOOKS_DIR
  ? resolve(process.env.JUNIE_PLAYBOOKS_DIR)
  : join(repoRoot, '.junie', 'playbooks');

/**
 * Recursively collect every `*.md` file under `dir`.
 * Returns absolute paths.
 */
function collectMarkdown(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(collectMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extract every fenced ```json block from `content`.
 * Returns an array of `{ body: string, startLine: number }`.
 *
 * Fence rules (CommonMark-ish, deliberately permissive):
 *   - Opening fence is a line whose first non-whitespace run is ``` followed by `json`
 *     (case-insensitive, allows `json` or `JSON` or `json5` — we only act on bare `json`).
 *   - Closing fence is a line whose first non-whitespace run is ``` (info string ignored).
 *   - We do not handle nested fences (Markdown doesn't support them at the same indent).
 */
function extractJsonBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const openMatch = line.match(/^\s*```json\s*$/i);
    if (openMatch) {
      const startLine = i + 1; // 1-indexed line of the opening fence
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) {
        j += 1;
      }
      // j is either the closing fence or end of file
      const body = lines.slice(bodyStart, j).join('\n');
      blocks.push({ body, startLine });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return blocks;
}

/**
 * Walk a parsed JSON value (object or array) and report whether `oneOf` and
 * `additionalProperties` both appear as keys somewhere in the tree.
 * Returns `true` if both keys are present at any depth (anywhere in the tree),
 * `false` otherwise.
 */
function hasBothOneOfAndAdditionalProperties(value) {
  let sawOneOf = false;
  let sawAdditionalProperties = false;
  const stack = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    for (const key of Object.keys(node)) {
      if (key === 'oneOf') sawOneOf = true;
      if (key === 'additionalProperties') sawAdditionalProperties = true;
      if (sawOneOf && sawAdditionalProperties) return true;
      stack.push(node[key]);
    }
  }
  return sawOneOf && sawAdditionalProperties;
}

const files = collectMarkdown(playbookDir).sort();
const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const blocks = extractJsonBlocks(content);
  for (const { body, startLine } of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      // Non-strict-JSON fenced blocks (e.g., illustrative `{ "...": "..." }`
      // pseudo-snippets) are ignored — R5 invariant only fires on parseable
      // JSON that restates the canonical schema.
      continue;
    }
    if (hasBothOneOfAndAdditionalProperties(parsed)) {
      violations.push({
        file: relative(repoRoot, file),
        line: startLine,
      });
    }
  }
}

if (violations.length === 0) {
  console.log('R5 invariant: clean (0 violations across', files.length, 'playbook files).');
  process.exit(0);
}

console.error(`R5 invariant: FAIL — ${violations.length} violation(s) in ${files.length} playbook file(s).`);
console.error('A fenced ```json block contains both `oneOf` and `additionalProperties`.');
console.error('That looks like an inline restatement of the canonical SSE schema.');
console.error('Canonical source: .junie/contracts/sse-events.schema.json');
console.error('');
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
}
process.exit(1);
