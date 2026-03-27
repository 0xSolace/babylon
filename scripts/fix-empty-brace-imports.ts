/**
 * Remove invalid `import { , } from '...'` blocks left by bad merges.
 *
 * Run: bun run scripts/fix-empty-brace-imports.ts
 */

import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function splitImportSpecifiers(inner: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '<') depth++;
    else if (c === '>') depth--;
    else if (c === ',' && depth === 0) {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = '';
      continue;
    }
    buf += c;
  }
  const last = buf.trim();
  if (last) parts.push(last);
  return parts;
}

function specifierKey(spec: string): string {
  const t = spec.trim();
  const tm = /^type\s+(\w+)/.exec(t);
  if (tm) return tm[1];
  const asM = /^(\w+)\s+as\s+(\w+)/.exec(t);
  if (asM) return asM[2];
  return t.split(/\s+/)[0] ?? t;
}

function sortSpecs(specs: string[]): string[] {
  return [...specs].sort((a, b) =>
    specifierKey(a).localeCompare(specifierKey(b), 'en')
  );
}

/** Deduplicate named specifiers in each `@babylon/*` brace import. */
function dedupeBabylonNamedImports(src: string): string {
  const modRe =
    /import\s+\{([\s\S]*?)\}\s+from\s+(['"])(@babylon\/(?:a2a|api|agents|db|db\/runtime))\2\s*;/g;
  return src.replace(modRe, (full, inner: string, q: string, mod: string) => {
    const parts = splitImportSpecifiers(inner)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Map<string, string>();
    for (const p of parts) {
      const k = specifierKey(p);
      if (!seen.has(k)) seen.set(k, p);
    }
    const merged = sortSpecs([...seen.values()]);
    return `import {\n  ${merged.join(',\n  ')},\n} from ${q}${mod}${q};`;
  });
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    let st;
    try {
      st = lstatSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...walkTsFiles(p));
      continue;
    }
    if (st.isFile() && (name.endsWith('.ts') || name.endsWith('.tsx'))) {
      out.push(p);
    }
  }
  return out;
}

const babylonMod = String.raw`@babylon\/(?:a2a|api|agents|db|db\/runtime)`;
/** `import { , }` with no specifiers */
const emptyCommaImportRe = new RegExp(
  String.raw`import\s*\{\s*,\s*\}\s*from\s*['"]${babylonMod}['"]\s*;\s*\n?`,
  'g'
);
/** `import { }` with no specifiers */
const emptyBraceImportRe = new RegExp(
  String.raw`import\s*\{\s*\}\s*from\s*['"]${babylonMod}['"]\s*;\s*\n?`,
  'g'
);

let n = 0;
for (const f of walkTsFiles(join(root, 'apps/web/src'))) {
  const src = readFileSync(f, 'utf8');
  const next = dedupeBabylonNamedImports(
    src
      .replace(emptyCommaImportRe, '')
      .replace(emptyBraceImportRe, '')
      .replace(/import\s*\{\s*,/g, 'import {')
  );
  if (next !== src) {
    writeFileSync(f, next);
    console.log('fixed', f);
    n++;
  }
}
console.log('done,', n, 'files');
