#!/usr/bin/env bun
/**
 * Fix multiline `import { … } from '@babylon/db'` using brace depth, then split runtime symbols.
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

function transformBlock(full: string): string {
  if (/^import\s+type\s+\{/.test(full.trim())) {
    return full;
  }
  const m = full.match(
    /^import\s+\{([\s\S]*)\}\s+from\s+['"]@babylon\/db['"]\s*;?/
  );
  if (!m) return full;
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
    lines.push(`import { ${run.join(', ')} } from '@babylon/db/runtime';`);
  }
  return lines.join('\n');
}

/** Find all `import {` … `} from '@babylon/db'` spans with correct brace depth */
function extractDbImportRanges(
  source: string
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const _needle = "from '@babylon/db'";
  const _needle2 = 'from "@babylon/db"';
  let pos = 0;
  while (pos < source.length) {
    const idxImport = source.indexOf('import', pos);
    if (idxImport === -1) break;
    const braceStart = source.indexOf('{', idxImport);
    if (braceStart === -1 || braceStart - idxImport > 40) {
      pos = idxImport + 6;
      continue;
    }
    if (/^import\s+type\s+/.test(source.slice(idxImport, braceStart + 1))) {
      pos = braceStart + 1;
      continue;
    }
    let depth = 0;
    let i = braceStart;
    for (; i < source.length; i++) {
      const c = source[i]!;
      if (c === '{' || c === '<') depth++;
      if (c === '}' || c === '>') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    if (depth !== 0) {
      pos = braceStart + 1;
      continue;
    }
    const afterBrace = source.slice(i, i + 120);
    const fm = afterBrace.match(/^\s*from\s+(['"])@babylon\/db\1/);
    if (!fm) {
      pos = braceStart + 1;
      continue;
    }
    const _endFrom = i + afterBrace.indexOf(';');
    const semi = source.indexOf(';', i);
    const end = semi === -1 ? i + fm[0].length : semi + 1;
    ranges.push({ start: idxImport, end });
    pos = end;
  }
  return ranges;
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

/** Remove string literals so path segments like `./db` are not mistaken for the `db` symbol. */
function stripStringsAndComments(src: string): string {
  let s = stripTsComments(src);
  s = s.replace(/'(?:\\.|[^'])*'/g, ' ');
  s = s.replace(/"(?:\\.|[^"])*"/g, ' ');
  s = s.replace(/`(?:\\.|[^`])*`/g, ' ');
  return s;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Runtime symbols used as Drizzle values (not object keys like `posts:` in interfaces).
 */
function detectUsedRuntimeSymbols(src: string): string[] {
  const body = stripStringsAndComments(src);
  const found = new Set<string>();
  for (const sym of RUNTIME) {
    const esc = escapeRegExp(sym);
    const boundary = String.raw`\b${esc}\b`;
    const patterns = [
      new RegExp(String.raw`${boundary}\.`),
      new RegExp(String.raw`\.from\(\s*${boundary}`),
      new RegExp(String.raw`\.into\(\s*${boundary}`),
      new RegExp(String.raw`typeof\s+${boundary}`),
      new RegExp(String.raw`\.insert\(\s*${boundary}`),
      new RegExp(String.raw`\.update\(\s*${boundary}`),
      new RegExp(String.raw`\.delete\(\s*${boundary}`),
      new RegExp(String.raw`\$\{${boundary}\.`),
    ];
    if (patterns.some((r) => r.test(body))) {
      found.add(sym);
      continue;
    }
    if (new RegExp(String.raw`${boundary}\s*\(`).test(body)) {
      found.add(sym);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

type RuntimeImportSpan = { start: number; end: number };

function findRuntimeImportSpans(src: string): RuntimeImportSpan[] {
  const spans: RuntimeImportSpan[] = [];
  const re =
    /import\s+\{[\s\S]*?\}\s+from\s+['"]@babylon\/db\/runtime['"]\s*;?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

function getRuntimeImportInner(full: string): string {
  const m = full.match(
    /^import\s+\{([\s\S]*)\}\s+from\s+['"]@babylon\/db\/runtime['"]\s*;?/
  );
  return m?.[1] ?? '';
}

/** First `from '@babylon/db'` outside comments/strings (avoids JSDoc examples). */
function findInsertPointForRuntimeImport(src: string): number {
  let i = 0;
  let inBlockComment = false;
  let inLineComment = false;
  let inString: "'" | '"' | '`' | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inString) {
      if (c === '\\' && inString !== '`') {
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inString = c;
      i++;
      continue;
    }
    const rest = src.slice(i);
    const fromPub =
      rest.startsWith(`from '@babylon/db'`) ||
      rest.startsWith(`from "@babylon/db"`);
    if (fromPub) {
      const semi = src.indexOf(';', i);
      if (semi !== -1) {
        let end = semi + 1;
        if (src[end] === '\r') end++;
        if (src[end] === '\n') end++;
        return end;
      }
    }
    i++;
  }
  const m = src.match(/^\s*import\s/m);
  return m?.index ?? 0;
}

/**
 * Add or merge `@babylon/db/runtime` imports when the file references runtime symbols
 * (tables, db, etc.) but no longer imports them from the public `@babylon/db` barrel.
 */
function ensureRuntimeImports(src: string, absPath: string): string {
  const rel = relative(ROOT, absPath);
  if (rel.startsWith(`packages${join.sep}db${join.sep}src`)) return src;
  if (!/@babylon\/db/.test(src)) return src;

  const required = detectUsedRuntimeSymbols(src);
  const spans = findRuntimeImportSpans(src);

  if (required.length === 0 && spans.length === 0) return src;

  const specByBase = new Map<string, string>();
  for (const sp of spans) {
    const inner = getRuntimeImportInner(src.slice(sp.start, sp.end));
    for (const spec of splitImportSpecifiers(inner)) {
      const { baseName } = specifierMeta(spec);
      if (!specByBase.has(baseName)) specByBase.set(baseName, spec);
    }
  }

  for (const sym of required) {
    if (!specByBase.has(sym)) specByBase.set(sym, sym);
  }

  if (specByBase.size === 0) return src;

  const bases = [...specByBase.keys()].sort((a, b) => a.localeCompare(b));
  const finalSpecs = bases.map((b) => specByBase.get(b)!);
  const newLine = `import { ${finalSpecs.join(', ')} } from '@babylon/db/runtime';`;

  if (spans.length === 0) {
    const at = findInsertPointForRuntimeImport(src);
    const padBefore = at > 0 && src[at - 1] !== '\n' ? '\n' : '';
    return `${src.slice(0, at)}${padBefore}${newLine}\n${src.slice(at)}`;
  }

  const first = spans[0]!;
  let out = src.slice(0, first.start);
  out += `${newLine}\n`;
  let cur = first.end;
  for (let i = 1; i < spans.length; i++) {
    const sp = spans[i]!;
    out += src.slice(cur, sp.start);
    cur = sp.end;
  }
  out += src.slice(cur);
  return out;
}

function processFile(path: string): boolean {
  let s = readFileSync(path, 'utf8');
  const orig = s;
  s = s.replaceAll(`from '@babylon/db/tables'`, `from '@babylon/db/runtime'`);
  s = s.replaceAll(`from "@babylon/db/tables"`, `from "@babylon/db/runtime"`);

  const ranges = extractDbImportRanges(s);
  for (let r = ranges.length - 1; r >= 0; r--) {
    const { start, end } = ranges[r]!;
    const block = s.slice(start, end);
    const next = transformBlock(block.trimEnd());
    s = s.slice(0, start) + next + s.slice(end);
  }

  s = ensureRuntimeImports(s, path);

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
      if (f.endsWith('repair-babylon-db-imports.ts')) continue;
      if (f.endsWith('migrate-babylon-db-runtime-imports.ts')) continue;
      if (processFile(f)) {
        n++;
        console.log(relative(ROOT, f));
      }
    }
  } catch {
    /* skip */
  }
}
console.log(`Repaired ${n} files.`);
