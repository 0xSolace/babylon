/**
 * Move symbols misclassified after db/runtime split:
 * - From `@babylon/db` → `@babylon/api` when the name is exported from the API package.
 * - From `@babylon/api` → `@babylon/db` when the name is a Drizzle op (or other db-barrel value).
 * - From `@babylon/db/runtime` → correct package when symbols were merged incorrectly.
 * - Same for `@babylon/agents` when mixed with db/api/runtime.
 *
 * Run: bun run scripts/repair-web-db-api-imports.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as runtime from '@babylon/db/runtime';

const RUNTIME = new Set(Object.keys(runtime));
const RUNTIME_CORE = new Set([
  'asPublic',
  'asSystem',
  'asUser',
  'db',
  'dbRead',
  'dbWrite',
  'withTransaction',
]);

const root = fileURLToPath(new URL('..', import.meta.url));
const apiSrc = join(root, 'packages/api/src');
const agentsSrc = join(root, 'packages/agents/src');
const a2aSrc = join(root, 'packages/a2a/src');
const dbIndex = join(root, 'packages/db/src/index.ts');

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

const DB_EXPORTS = parseDbIndexExports(dbIndex);

/** Recursively collect value export names from a package `src/index.ts` barrel. */
function collectBarrelValueExports(
  entryPath: string,
  seen = new Set<string>()
): Set<string> {
  const abs = resolve(entryPath);
  if (seen.has(abs)) return new Set();
  seen.add(abs);

  let src: string;
  try {
    src = readFileSync(abs, 'utf8');
  } catch {
    return new Set();
  }

  const out = new Set<string>();

  const starFrom = src.matchAll(/export\s+\*\s+from\s+['"](\.\/[^'"]+)['"]/g);
  for (const m of starFrom) {
    const next = resolve(dirname(abs), m[1]);
    const tryPaths = [`${next}.ts`, join(next, 'index.ts')];
    for (const p of tryPaths) {
      const sub = collectBarrelValueExports(p, seen);
      for (const s of sub) out.add(s);
    }
  }

  const braceBlocks = src.matchAll(
    /export\s+\{([^}]+)\}\s+from\s+['"](\.\/[^'"]+)['"]/g
  );
  for (const m of braceBlocks) {
    const inner = m[1];
    const rel = m[2];
    const next = resolve(dirname(abs), `${rel}.ts`);
    const nextIdx = join(dirname(abs), rel, 'index.ts');
    if (inner.includes('*')) {
      for (const p of [next, nextIdx]) {
        const sub = collectBarrelValueExports(p, seen);
        for (const s of sub) out.add(s);
      }
      continue;
    }
    for (const part of inner.split(',')) {
      const t = part.trim();
      if (!t || /^type\s+/.test(t)) continue;
      const asM = /^(\w+)\s+as\s+(\w+)/.exec(t);
      if (asM) {
        out.add(asM[2]);
        continue;
      }
      const word = t.split(/\s+/)[0];
      if (word && /^[A-Za-z_]/.test(word)) out.add(word);
    }
  }

  const rootExports = src.matchAll(/^export\s+\{([^}]+)\}\s*;/gm);
  for (const m of rootExports) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t || /^type\s+/.test(t)) continue;
      const asM = /^(\w+)\s+as\s+(\w+)/.exec(t);
      if (asM) {
        out.add(asM[2]);
        continue;
      }
      const word = t.split(/\s+/)[0];
      if (word && /^[A-Za-z_]/.test(word)) out.add(word);
    }
  }

  const fnExports = src.matchAll(
    /^export\s+async\s+function\s+(\w+)|^export\s+function\s+(\w+)/gm
  );
  for (const m of fnExports) {
    const name = m[1] || m[2];
    if (name) out.add(name);
  }

  const constExports = src.matchAll(/^export\s+const\s+(\w+)/gm);
  for (const m of constExports) {
    out.add(m[1]);
  }

  const enumExports = src.matchAll(/^export\s+enum\s+(\w+)/gm);
  for (const m of enumExports) {
    out.add(m[1]);
  }

  return out;
}

const API_VALUE_EXPORTS = collectBarrelValueExports(join(apiSrc, 'index.ts'));
const AGENTS_VALUE_EXPORTS = collectBarrelValueExports(
  join(agentsSrc, 'index.ts')
);
const A2A_VALUE_EXPORTS = collectBarrelValueExports(join(a2aSrc, 'index.ts'));

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

/** Balanced `{`…`}` — avoids `import { ([\s\S]*?) }` spanning multiple statements. */
function findNamedImportBlocks(content: string): Array<{
  start: number;
  end: number;
  inner: string;
  modulePath: string;
  quote: "'" | '"';
}> {
  const out: Array<{
    start: number;
    end: number;
    inner: string;
    modulePath: string;
    quote: "'" | '"';
  }> = [];
  const re = /import\s+\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const matchStart = m.index;
    const openBrace = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = openBrace; i < content.length; i++) {
      const c = content[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const tail = content.slice(i + 1);
          const fm =
            /^\s*from\s+(["'])(@babylon\/a2a|@babylon\/db|@babylon\/db\/runtime|@babylon\/api|@babylon\/agents)\1\s*;/.exec(
              tail
            );
          if (fm) {
            const quote = fm[1] as "'" | '"';
            const modulePath = fm[2];
            const end = i + 1 + fm[0].length;
            const inner = content.slice(openBrace + 1, i);
            out.push({
              start: matchStart,
              end,
              inner,
              modulePath,
              quote,
            });
          }
          break;
        }
      }
    }
  }
  return out;
}

type ExportHome = 'a2a' | 'api' | 'agents' | 'db' | 'runtime' | 'unknown';

function exportHome(key: string): ExportHome {
  if (API_VALUE_EXPORTS.has(key)) return 'api';
  if (AGENTS_VALUE_EXPORTS.has(key)) return 'agents';
  if (A2A_VALUE_EXPORTS.has(key)) return 'a2a';
  if (DB_EXPORTS.has(key)) return 'db';
  if (RUNTIME_CORE.has(key) || RUNTIME.has(key)) return 'runtime';
  return 'unknown';
}

function mergeBlocks(
  content: string,
  modulePath: string,
  newSpecs: string[],
  quote: "'" | '"'
): string {
  if (newSpecs.length === 0) return content;
  const q = quote;
  const modLiteral = `${q}${modulePath}${q}`;
  const matches = findNamedImportBlocks(content).filter(
    (b) => b.modulePath === modulePath && b.quote === q
  );

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

  const merged = sortSpecs([...seen.values()]);
  const block = `import {\n  ${merged.join(',\n  ')},\n} from ${modLiteral};`;

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

function processFile(path: string): boolean {
  let content = readFileSync(path, 'utf8');
  const original = content;

  const modules = findNamedImportBlocks(content);

  if (modules.length === 0) return false;

  const moves: Array<{
    from: string;
    to: string;
    spec: string;
    quote: "'" | '"';
  }> = [];

  const homeToPath: Record<Exclude<ExportHome, 'unknown'>, string> = {
    a2a: '@babylon/a2a',
    api: '@babylon/api',
    agents: '@babylon/agents',
    db: '@babylon/db',
    runtime: '@babylon/db/runtime',
  };

  for (const block of modules) {
    const parts = splitImportSpecifiers(block.inner);
    for (const raw of parts) {
      const t = raw.trim();
      if (!t) continue;
      if (/^type\s+/.test(t)) continue;
      const key = specifierKey(t);
      const home = exportHome(key);
      if (home === 'unknown') continue;

      const cur = block.modulePath;
      const want = homeToPath[home];
      if (cur === want) continue;

      if (
        cur === '@babylon/a2a' ||
        cur === '@babylon/db' ||
        cur === '@babylon/db/runtime' ||
        cur === '@babylon/api' ||
        cur === '@babylon/agents'
      ) {
        moves.push({ from: cur, to: want, spec: t, quote: block.quote });
      }
    }
  }

  if (moves.length === 0) return false;

  for (const mv of moves) {
    content = removeSpecifierFromModule(content, mv.from, mv.spec, mv.quote);
  }

  const byTarget = new Map<string, { quote: "'" | '"'; specs: string[] }>();
  for (const mv of moves) {
    const k = `${mv.to}\0${mv.quote}`;
    let g = byTarget.get(k);
    if (!g) {
      g = { quote: mv.quote, specs: [] };
      byTarget.set(k, g);
    }
    g.specs.push(mv.spec);
  }

  for (const [key, { quote, specs }] of byTarget) {
    const mod = key.split('\0')[0];
    content = mergeBlocks(content, mod, specs, quote);
  }

  if (content === original) return false;
  writeFileSync(path, content);
  return true;
}

function removeSpecifierFromModule(
  content: string,
  modulePath: string,
  specToRemove: string,
  quote: "'" | '"'
): string {
  const blocks = findNamedImportBlocks(content).filter(
    (b) => b.modulePath === modulePath && b.quote === quote
  );
  let result = content;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const parts = splitImportSpecifiers(b.inner)
      .map((s) => s.trim())
      .filter((s) => s && s !== specToRemove.trim());
    let replacement: string;
    if (parts.length === 0) {
      replacement = '';
    } else {
      const seen = new Map<string, string>();
      for (const p of parts) {
        const k = specifierKey(p);
        if (!seen.has(k)) seen.set(k, p);
      }
      const deduped = sortSpecs([...seen.values()]);
      replacement = `import {\n  ${deduped.join(',\n  ')},\n} from ${quote}${modulePath}${quote};`;
    }
    result = result.slice(0, b.start) + replacement + result.slice(b.end);
  }
  return result;
}

import { lstatSync, readdirSync } from 'node:fs';

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

let n = 0;
for (const f of walkTsFiles(join(root, 'apps/web/src'))) {
  if (processFile(f)) {
    console.log('repaired', f);
    n++;
  }
}
console.log('done,', n, 'files');
console.log(
  'API export names',
  API_VALUE_EXPORTS.size,
  'agents',
  AGENTS_VALUE_EXPORTS.size,
  'a2a',
  A2A_VALUE_EXPORTS.size
);
