/**
 * 1) Split `import { ... } from '@babylon/db';` when specifiers include runtime-only
 *    symbols (`db`, tables, `asUser`, …). Keeps `type` specifiers on `@babylon/db`.
 * 2) Split `import { ... } from '@babylon/db/runtime'` when specifiers include
 *    non-runtime symbols (e.g. Drizzle `eq`, `and`) → `@babylon/db`.
 *
 * Run: bun run scripts/split-web-db-runtime-imports.ts
 */

import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as runtime from '@babylon/db/runtime';

const RUNTIME = new Set(Object.keys(runtime));
/** Bun/ESM `import *` may omit some live bindings from `Object.keys`; never route these to `@babylon/db`. */
const RUNTIME_CORE = new Set([
  'asPublic',
  'asSystem',
  'asUser',
  'DatabaseService',
  'db',
  'dbRead',
  'dbWrite',
  'getDbInstance',
  'withTransaction',
]);

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
  return t.split(/\s+/)[0] ?? t;
}

function processImportBlock(
  fullMatch: string,
  inner: string,
  quote: string
): string {
  const parts = splitImportSpecifiers(inner);
  const dbSpecs: string[] = [];
  const runtimeSpecs: string[] = [];

  for (const raw of parts) {
    const t = raw.trim();
    if (!t) continue;
    if (/^type\s+/.test(t)) {
      dbSpecs.push(t);
      continue;
    }
    const key = specifierKey(t);
    if (RUNTIME_CORE.has(key) || RUNTIME.has(key)) {
      runtimeSpecs.push(t);
    } else {
      dbSpecs.push(t);
    }
  }

  if (runtimeSpecs.length === 0) {
    return fullMatch;
  }

  const mod = `${quote}@babylon/db${quote}`;
  const rtMod = `${quote}@babylon/db/runtime${quote}`;

  const blocks: string[] = [];
  if (dbSpecs.length > 0) {
    blocks.push(
      `import {\n  ${[...dbSpecs].sort((a, b) => specifierKey(a).localeCompare(specifierKey(b), 'en')).join(',\n  ')},\n} from ${mod};`
    );
  }
  blocks.push(
    `import {\n  ${[...runtimeSpecs].sort((a, b) => specifierKey(a).localeCompare(specifierKey(b), 'en')).join(',\n  ')},\n} from ${rtMod};`
  );

  return blocks.join('\n');
}

/** Non-runtime specifiers (e.g. `eq`) off the runtime barrel → `@babylon/db`. */
function processRuntimeImportBlock(
  fullMatch: string,
  inner: string,
  quote: string
): string {
  const parts = splitImportSpecifiers(inner);
  const dbSpecs: string[] = [];
  const runtimeSpecs: string[] = [];

  for (const raw of parts) {
    const t = raw.trim();
    if (!t) continue;
    if (/^type\s+/.test(t)) {
      runtimeSpecs.push(t);
      continue;
    }
    const key = specifierKey(t);
    if (RUNTIME_CORE.has(key) || RUNTIME.has(key)) {
      runtimeSpecs.push(t);
    } else {
      dbSpecs.push(t);
    }
  }

  if (dbSpecs.length === 0) {
    return fullMatch;
  }

  const mod = `${quote}@babylon/db${quote}`;
  const rtMod = `${quote}@babylon/db/runtime${quote}`;
  const sort = (a: string, b: string) =>
    specifierKey(a).localeCompare(specifierKey(b), 'en');

  const blocks: string[] = [];
  if (runtimeSpecs.length > 0) {
    blocks.push(
      `import {\n  ${[...runtimeSpecs].sort(sort).join(',\n  ')},\n} from ${rtMod};`
    );
  }
  blocks.push(
    `import {\n  ${[...dbSpecs].sort(sort).join(',\n  ')},\n} from ${mod};`
  );

  return blocks.join('\n');
}

function processFile(path: string): boolean {
  let content = readFileSync(path, 'utf8');
  const original = content;

  const reDb = /import\s+\{([\s\S]*?)\}\s+from\s+(['"])@babylon\/db\2\s*;/g;
  content = content.replace(reDb, (full, inner: string, quote: string) =>
    processImportBlock(full, inner, quote)
  );

  const reRt =
    /import\s+\{([\s\S]*?)\}\s+from\s+(['"])@babylon\/db\/runtime\2\s*;/g;
  content = content.replace(reRt, (full, inner: string, quote: string) =>
    processRuntimeImportBlock(full, inner, quote)
  );

  if (content === original) {
    return false;
  }
  writeFileSync(path, content);
  return true;
}

const root = fileURLToPath(new URL('..', import.meta.url));

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

const files = walkTsFiles(join(root, 'apps/web/src'));
let n = 0;
for (const f of files) {
  if (processFile(f)) {
    console.log('updated', f);
    n++;
  }
}
console.log('done,', n, 'files');
