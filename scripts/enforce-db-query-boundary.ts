#!/usr/bin/env bun
/**
 * Enforce DB layer boundaries:
 *
 * 1. `@babylon/db/runtime` — only exempt paths (see EXEMPT_PREFIXES). Everywhere
 *    else use `@babylon/db/engine-storage` (same exports; not flagged).
 * 2. `drizzle-orm` (any subpath) — only `packages/db/src/**`, `packages/db/drizzle/**`,
 *    `packages/db/drizzle.config.*`, or exempt paths.
 *
 * Untracked files are not scanned (`git ls-files`); add and commit new modules before CI.
 *
 * Usage:
 *   bun run scripts/enforce-db-query-boundary.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const RUNTIME_IMPORT_RE =
  /(?:from\s+['"]@babylon\/db\/runtime['"]|import\s*\(\s*['"]@babylon\/db\/runtime['"]\s*\))/;

/** `drizzle-orm` or `drizzle-orm/...` in static or dynamic imports. */
const DRIZZLE_ORM_IMPORT_RE =
  /(?:from\s+['"]drizzle-orm(?:\/[^'"]*)?['"]|import\s*\(\s*['"]drizzle-orm(?:\/[^'"]*)?['"]\s*\))/;

/** Path prefixes (repo-relative, posix) that may import runtime / drizzle-orm. */
const EXEMPT_PREFIXES = [
  'scripts/',
  'packages/testing/',
  'packages/examples/',
  'apps/cli/',
  'packages/training/scripts/',
  'packages/db/scripts/',
];

function isExemptPath(relativePath: string): boolean {
  const p = relativePath.replaceAll('\\', '/');
  if (EXEMPT_PREFIXES.some((prefix) => p.startsWith(prefix))) return true;
  if (p.includes('/__tests__/')) return true;
  if (
    p.endsWith('.test.ts') ||
    p.endsWith('.test.tsx') ||
    p.endsWith('.spec.ts') ||
    p.endsWith('.spec.tsx')
  ) {
    return true;
  }
  return false;
}

/** drizzle-orm is allowed in db package source, Drizzle kit output, and config. */
function isNativeDrizzlePackagePath(relativePath: string): boolean {
  const p = relativePath.replaceAll('\\', '/');
  if (p.startsWith('packages/db/src/')) return true;
  if (p.startsWith('packages/db/drizzle/')) return true;
  if (
    p === 'packages/db/drizzle.config.ts' ||
    p === 'packages/db/drizzle.config.cjs'
  ) {
    return true;
  }
  return false;
}

function stripLineComments(line: string): string {
  const idx = line.indexOf('//');
  if (idx === -1) return line;
  return line.slice(0, idx);
}

function scanSourceForPattern(source: string, pattern: RegExp): boolean {
  let inBlockComment = false;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      continue;
    }
    if (line.startsWith('*') || line.startsWith('/**')) continue;
    const code = stripLineComments(rawLine);
    if (pattern.test(code)) return true;
  }
  return false;
}

async function gitTrackedTsFiles(): Promise<string[]> {
  const proc = Bun.spawn(['git', 'ls-files', '*.ts', '*.tsx'], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error('git ls-files failed');
  }
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const files = await gitTrackedTsFiles();
  const runtimeViolations: string[] = [];
  const drizzleViolations: string[] = [];

  for (const file of files) {
    if (isExemptPath(file)) continue;
    const abs = join(REPO_ROOT, file);
    let source: string;
    try {
      source = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    if (scanSourceForPattern(source, RUNTIME_IMPORT_RE)) {
      runtimeViolations.push(file);
    }

    if (
      scanSourceForPattern(source, DRIZZLE_ORM_IMPORT_RE) &&
      !isNativeDrizzlePackagePath(file)
    ) {
      drizzleViolations.push(file);
    }
  }

  let failed = false;
  if (runtimeViolations.length > 0) {
    failed = true;
    console.error(
      'DB boundary: @babylon/db/runtime is only allowed under exempt path prefixes (see EXEMPT_PREFIXES in scripts/enforce-db-query-boundary.ts). Prefer @babylon/db/engine-storage.\n'
    );
    console.error('Violations:\n');
    for (const v of runtimeViolations.sort((a, b) => a.localeCompare(b))) {
      console.error(`  - ${v}`);
    }
    console.error('');
  }

  if (drizzleViolations.length > 0) {
    failed = true;
    console.error(
      'DB boundary: drizzle-orm imports belong under packages/db/src or packages/db/drizzle (or exempt path prefixes).\n'
    );
    console.error('Violations:\n');
    for (const v of drizzleViolations.sort((a, b) => a.localeCompare(b))) {
      console.error(`  - ${v}`);
    }
    console.error('');
  }

  if (failed) {
    console.error(
      'Fix: use @babylon/db/engine-storage instead of runtime; move SQL into packages/db query modules.\n'
    );
    process.exit(1);
  }

  console.error(
    'DB boundary: OK (no unexpected @babylon/db/runtime or drizzle-orm imports).'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
