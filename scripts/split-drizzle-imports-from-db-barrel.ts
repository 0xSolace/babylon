#!/usr/bin/env bun
/**
 * Splits imports after `@babylon/db` stopped re-exporting Drizzle SQL builders.
 *
 * **Why brace-balanced extraction:** A regex like `\{[\s\S]*?\}` stops at the first
 * `}`, which breaks when nested objects appear *above* the real
 * `import { … } from '@babylon/db';
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

const DRIZZLE_BARREL_SYMBOLS = new Set([
  'InferInsertModel',
  'InferSelectModel',
  'SQL',
  'aliasedTable',
  'and',
  'asc',
  'avg',
  'between',
  'count',
  'desc',
  'eq',
  'exists',
  'gt',
  'gte',
  'ilike',
  'inArray',
  'isNotNull',
  'isNull',
  'like',
  'lt',
  'lte',
  'max',
  'min',
  'ne',
  'not',
  'notExists',
  'notInArray',
  'or',
  'sql',
  'sum',
]);

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

function specifierBaseName(raw: string): string {
  const trimmed = raw.trim();
  const noType = /^type\s+/.test(trimmed)
    ? trimmed.replace(/^type\s+/, '').trim()
    : trimmed;
  return noType.split(/\s+as\s+/)[0]?.trim() ?? noType;
}

function isDrizzleSpecifier(raw: string): boolean {
  return DRIZZLE_BARREL_SYMBOLS.has(specifierBaseName(raw));
}

function parseImportTypeOnly(full: string): boolean {
  return /^import\s+type\s+\{/.test(full.trim());
}

function extractInnerBraceContent(full: string): string | null {
  const braceStart = full.indexOf('{');
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < full.length; i++) {
    const c = full[i]!;
    if (c === '{' || c === '<') depth++;
    if (c === '}' || c === '>') {
      depth--;
      if (depth === 0) {
        return full.slice(braceStart + 1, i);
      }
    }
  }
  return null;
}

function transformBabylonDbImport(full: string): string | null {
  const trimmed = full.trimEnd();
  if (!/\}\s*from\s+['"]@babylon\/db['"]/.test(trimmed)) return null;

  const outerType = parseImportTypeOnly(full);
  const inner = extractInnerBraceContent(full);
  if (inner === null) return null;

  const specs = splitImportSpecifiers(inner);
  const drizzle: string[] = [];
  const babylon: string[] = [];
  for (const raw of specs) {
    if (isDrizzleSpecifier(raw)) drizzle.push(raw.trim());
    else babylon.push(raw.trim());
  }

  const lines: string[] = [];
  if (drizzle.length > 0) {
    if (outerType) {
      const innerD = drizzle
        .map((s) => s.replace(/^type\s+/, '').trim())
        .join(', ');
      lines.push(`import type { ${innerD} } from 'drizzle-orm';`);
    } else {
      lines.push(`import { ${drizzle.join(', ')} } from 'drizzle-orm';`);
    }
  }
  if (babylon.length > 0) {
    if (outerType) {
      const innerB = babylon
        .map((s) => s.replace(/^type\s+/, '').trim())
        .join(', ');
      lines.push(`import type { ${innerB} } from '@babylon/db';`);
    } else {
      lines.push(`import { ${babylon.join(', ')} } from '@babylon/db';`);
    }
  }
  if (lines.length === 0) return null;
  return lines.join('\n');
}

/** `import` / `import type` + `{` … `}` + `from '@babylon/db'` spans (brace-balanced). */
function extractBabylonDbImportRanges(
  source: string
): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let pos = 0;
  while (pos < source.length) {
    const imp = source.indexOf('import', pos);
    if (imp === -1) break;
    if (source.slice(imp, imp + 11) === 'import.meta') {
      pos = imp + 11;
      continue;
    }

    let i = imp + 6;
    while (i < source.length && /\s/.test(source[i]!)) i++;

    if (source.slice(i, i + 4) === 'type' && /\s/.test(source[i + 4] ?? '')) {
      i += 4;
      while (i < source.length && /\s/.test(source[i]!)) i++;
    }

    if (source[i] !== '{') {
      pos = imp + 6;
      continue;
    }

    const braceStart = i;
    let depth = 0;
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

    const after = source.slice(i, i + 120);
    const fm = after.match(/^\s*from\s+(['"])@babylon\/db\1\s*;?/);
    if (!fm) {
      pos = braceStart + 1;
      continue;
    }

    const semi = source.indexOf(';', i);
    const end = semi === -1 ? i + fm[0].length : semi + 1;
    ranges.push({ start: imp, end });
    pos = end;
  }
  return ranges;
}

function processFile(abs: string): boolean {
  let src = readFileSync(abs, 'utf8');
  if (!/@babylon\/db/.test(src)) return false;

  const ranges = extractBabylonDbImportRanges(src);
  if (ranges.length === 0) return false;

  let changed = false;
  for (let r = ranges.length - 1; r >= 0; r--) {
    const { start, end } = ranges[r]!;
    const full = src.slice(start, end);
    const next = transformBabylonDbImport(full);
    if (next && next !== full.trim()) {
      src = `${src.slice(0, start)}${next}${src.slice(end)}`;
      changed = true;
    }
  }
  if (changed) writeFileSync(abs, src, 'utf8');
  return changed;
}

let n = 0;
for (const f of walkFiles(ROOT)) {
  if (processFile(f)) {
    n++;
    console.log(relative(ROOT, f));
  }
}
console.error(`Updated ${n} files.`);
