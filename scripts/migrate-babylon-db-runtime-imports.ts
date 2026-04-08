#!/usr/bin/env bun
/**
 * Split imports: runtime symbols (db, table refs, …) → `@babylon/db/runtime`.
 * Replaces `@babylon/db/tables` → `@babylon/db/runtime`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.turbo',
  'drizzle',
]);

function buildRuntimeSymbolSet(): Set<string> {
  const s = new Set<string>();
  const tablesDir = join(ROOT, 'packages/db/src/tables');
  for (const f of readdirSync(tablesDir)) {
    if (!f.endsWith('.ts')) continue;
    const t = readFileSync(join(tablesDir, f), 'utf8');
    for (const m of t.matchAll(/^export const ([a-zA-Z0-9_]+)/gm)) {
      s.add(m[1]!);
    }
  }
  const dbText = readFileSync(join(ROOT, 'packages/db/src/db.ts'), 'utf8');
  for (const m of dbText.matchAll(
    /^export (?:async )?function ([a-zA-Z0-9_]+)/gm
  )) {
    s.add(m[1]!);
  }
  for (const m of dbText.matchAll(
    /^export const ([a-zA-Z0-9_]+)(?::|\s*=)/gm
  )) {
    s.add(m[1]!);
  }
  const exportBlock = dbText.match(
    /\/\/ Re-export JSON storage utilities\s*\nexport \{([^}]+)\}/s
  );
  if (exportBlock) {
    for (const part of exportBlock[1]!.split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name) s.add(name);
    }
  }
  const databaseServiceText = readFileSync(
    join(ROOT, 'packages/db/src/database-service.ts'),
    'utf8'
  );
  for (const m of databaseServiceText.matchAll(
    /^export (?:async )?function ([a-zA-Z0-9_]+)/gm
  )) {
    s.add(m[1]!);
  }
  for (const m of databaseServiceText.matchAll(/^export \{([^}]+)\}\s*;/gm)) {
    for (const part of m[1]!.split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name && !name.startsWith('type ')) s.add(name);
    }
  }
  s.add('tables');
  return s;
}

const RUNTIME = buildRuntimeSymbolSet();

function shouldSkipPath(abs: string): boolean {
  const rel = relative(ROOT, abs);
  if (rel.startsWith(`packages${join.sep}db${join.sep}src`)) return true;
  return rel.split(join.sep).some((p) => SKIP_DIR_NAMES.has(p));
}

function* walkFiles(dir: string): Generator<string> {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (shouldSkipPath(p)) continue;
    if (ent.isDirectory()) yield* walkFiles(p);
    else if (/\.(ts|tsx)$/.test(ent.name)) yield p;
  }
}

/** Split top-level import specifiers (commas not inside nested braces) */
function splitImportSpecifiers(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === '{' || ch === '<') depth++;
    if (ch === '}' || ch === '>') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const t = cur.trim();
      if (t) parts.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const t = cur.trim();
  if (t) parts.push(t);
  return parts;
}

function specifierMeta(spec: string): {
  isTypeOnly: boolean;
  baseName: string;
} {
  const trimmed = spec.trim();
  const isTypeOnly = /^type\s+/.test(trimmed);
  const rest = isTypeOnly ? trimmed.replace(/^type\s+/, '').trim() : trimmed;
  const beforeAs = rest.split(/\s+as\s+/)[0]?.trim() ?? rest;
  return { isTypeOnly, baseName: beforeAs };
}

function transformImportFromMain(matchFull: string): string {
  if (/^import\s+type\s+\{/.test(matchFull)) {
    return matchFull;
  }
  const m = matchFull.match(
    /^import\s+\{([\s\S]*)\}\s+from\s+['"]@babylon\/db['"]$/
  );
  if (!m) return matchFull;
  const inner = m[1] ?? '';
  const specs = splitImportSpecifiers(inner);
  const pub: string[] = [];
  const run: string[] = [];
  for (const raw of specs) {
    const { isTypeOnly, baseName } = specifierMeta(raw);
    if (isTypeOnly) {
      pub.push(raw);
      continue;
    }
    if (RUNTIME.has(baseName)) run.push(raw);
    else pub.push(raw);
  }
  const lines: string[] = [];
  if (pub.length > 0) {
    lines.push(`import { ${pub.join(', ')} } from '@babylon/db';`);
  }
  if (run.length > 0) {
    lines.push(`import { ${run.join(', ')} } from '@babylon/db/runtime'`);
  }
  return lines.join('\n');
}

function processFile(path: string): boolean {
  let s = readFileSync(path, 'utf8');
  const orig = s;
  s = s.replaceAll(`from '@babylon/db/runtime'`, `from '@babylon/db/runtime'`);
  s = s.replaceAll(`from "@babylon/db/runtime"`, `from "@babylon/db/runtime"`);

  const re = /^import\s+\{([\s\S]*?)\}\s+from\s+['"]@babylon\/db['"]/gm;
  const subs: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const full = m[0];
    subs.push({
      start: m.index,
      end: m.index + full.length,
      text: transformImportFromMain(full),
    });
  }
  subs.sort((a, b) => b.start - a.start);
  for (const sub of subs) {
    s = s.slice(0, sub.start) + sub.text + s.slice(sub.end);
  }

  if (s !== orig) {
    writeFileSync(path, s, 'utf8');
    return true;
  }
  return false;
}

let n = 0;
for (const dir of [
  join(ROOT, 'apps'),
  join(ROOT, 'packages'),
  join(ROOT, 'scripts'),
]) {
  try {
    for (const f of walkFiles(dir)) {
      if (processFile(f)) {
        n++;
        console.log(relative(ROOT, f));
      }
    }
  } catch {
    // missing dir
  }
}
console.log(`Updated ${n} files.`);
