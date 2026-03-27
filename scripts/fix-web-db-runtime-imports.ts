/**
 * One-off repair: split merge-corrupted imports where @babylon/api (and @babylon/db)
 * symbols were stuffed into `from '@babylon/db/runtime'`.
 *
 * Run: bun run scripts/fix-web-db-runtime-imports.ts
 */

import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as runtime from '@babylon/db/runtime';

const RUNTIME = new Set(Object.keys(runtime));

const AGENTS_SYMBOLS = new Set([
  'getAgent0SDK',
  'AgentSummary',
  'SearchFilters',
]);

function parseDbIndexExports(indexPath: string): Set<string> {
  const src = readFileSync(indexPath, 'utf8');
  const names = new Set<string>();
  const braceBlocks = src.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}\s+from/g);
  for (const m of braceBlocks) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const typeM = /^type\s+(\w+)/.exec(t);
      if (typeM) {
        names.add(typeM[1]);
        continue;
      }
      const asM = /^(\w+)\s+as\s+/.exec(t);
      if (asM) {
        names.add(asM[1]);
        continue;
      }
      const word = t.split(/\s+/)[0];
      if (word && /^[A-Za-z_]/.test(word)) names.add(word);
    }
  }
  return names;
}

const DB_EXPORTS = parseDbIndexExports(
  fileURLToPath(new URL('../packages/db/src/index.ts', import.meta.url))
);

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

function classify(spec: string): 'runtime' | 'db' | 'agents' | 'api' {
  const key = specifierKey(spec);
  if (AGENTS_SYMBOLS.has(key)) return 'agents';
  if (RUNTIME.has(key)) return 'runtime';
  if (DB_EXPORTS.has(key)) return 'db';
  return 'api';
}

function sortSpecsForOutput(specs: string[]): string[] {
  return [...specs].sort((a, b) =>
    specifierKey(a).localeCompare(specifierKey(b), 'en')
  );
}

function formatImportBlock(specs: string[]): string {
  if (specs.length === 0) return '';
  const sorted = sortSpecsForOutput(specs);
  const inner = sorted.join(',\n  ');
  return `import {\n  ${inner},\n} from`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Merge new specs into existing `import { ... } from module` (non-type). */
function mergeValueImports(
  content: string,
  modulePath: string,
  newSpecs: string[]
): string {
  if (newSpecs.length === 0) return content;

  const re = new RegExp(
    `import\\s+\\{([\\s\\S]*?)\\}\\s+from\\s+['"]${escapeRe(modulePath)}['"]\\s*;`,
    'g'
  );

  const matches: Array<{ start: number; end: number; inner: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, inner: m[1] });
  }

  const seen = new Map<string, string>();

  function addSpec(raw: string) {
    const t = raw.trim();
    if (!t) return;
    const k = specifierKey(t);
    if (!seen.has(k)) seen.set(k, t);
  }

  for (const hit of matches) {
    for (const s of splitImportSpecifiers(hit.inner)) {
      addSpec(s);
    }
  }
  for (const s of newSpecs) {
    addSpec(s);
  }

  const merged = sortSpecsForOutput([...seen.values()]);
  const block = `import {\n  ${merged.join(',\n  ')},\n} from '${modulePath}';`;

  if (matches.length > 0) {
    let out = '';
    let last = 0;
    for (let i = 0; i < matches.length; i++) {
      const hit = matches[i];
      out += content.slice(last, hit.start);
      if (i === 0) out += block;
      last = hit.end;
    }
    out += content.slice(last);
    return out;
  }

  const lines = content.split('\n');
  const idx = lines.findIndex((line) => {
    const t = line.trimStart();
    return t.startsWith('import ') && !t.startsWith('import type ');
  });
  if (idx >= 0) {
    lines.splice(idx, 0, block);
    return lines.join('\n');
  }
  lines.unshift(block);
  return lines.join('\n');
}

function stripEmptyApiImport(content: string): string {
  return content.replace(
    /import\s+\{\s*\}\s+from\s+['"]@babylon\/api['"]\s*;\n?/g,
    ''
  );
}

function processFile(path: string): boolean {
  const content = readFileSync(path, 'utf8');
  const runtimeRe =
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]@babylon\/db\/runtime['"]\s*;/g;

  const hits = [...content.matchAll(runtimeRe)];
  if (hits.length === 0) return false;

  const allApi: string[] = [];
  const allDb: string[] = [];
  const allAgents: string[] = [];
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const m of hits) {
    const inner = m[1];
    const parts = splitImportSpecifiers(inner);
    if (parts.length === 0) continue;

    const by: Record<'runtime' | 'db' | 'agents' | 'api', string[]> = {
      runtime: [],
      db: [],
      agents: [],
      api: [],
    };
    const seenKey = new Set<string>();

    for (const p of parts) {
      const t = p.trim();
      if (!t) continue;
      const k = specifierKey(t);
      if (seenKey.has(k)) continue;
      seenKey.add(k);
      by[classify(t)].push(t);
    }

    const origHadDupes = parts.length !== seenKey.size;
    const needsSplit =
      by.api.length > 0 || by.db.length > 0 || by.agents.length > 0;

    if (!needsSplit && !origHadDupes) continue;

    allApi.push(...by.api);
    allDb.push(...by.db);
    allAgents.push(...by.agents);

    const rtBlock =
      by.runtime.length > 0
        ? `${formatImportBlock(by.runtime)} '@babylon/db/runtime';`
        : '';
    const idx = m.index ?? 0;
    replacements.push({ start: idx, end: idx + m[0].length, text: rtBlock });
  }

  if (replacements.length === 0) return false;

  replacements.sort((a, b) => b.start - a.start);
  let next = content;
  for (const r of replacements) {
    next = next.slice(0, r.start) + r.text + next.slice(r.end);
  }

  next = stripEmptyApiImport(next);
  next = mergeValueImports(next, '@babylon/api', allApi);
  next = mergeValueImports(next, '@babylon/db', allDb);
  next = mergeValueImports(next, '@babylon/agents', allAgents);

  if (next !== content) {
    writeFileSync(path, next);
    return true;
  }
  return false;
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

const files = [
  ...walkTsFiles(join(root, 'apps/web/src')),
  ...readdirSync(join(root, 'apps/web'))
    .filter((n) => n.endsWith('.ts') || n.endsWith('.tsx'))
    .map((n) => join(root, 'apps/web', n))
    .filter((p) => {
      try {
        return lstatSync(p).isFile();
      } catch {
        return false;
      }
    }),
];

let n = 0;
for (const f of files) {
  if (processFile(f)) {
    console.log('fixed', f);
    n++;
  }
}
console.log('done,', n, 'files');
