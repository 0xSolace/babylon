/**
 * Isolated Unit Test Runner
 *
 * Runs each unit test file in its own bun subprocess so mock.module()
 * calls in one file cannot leak into another. Bun's test runner shares
 * a single module registry across all files in a single invocation,
 * which means mock.module('@babylon/shared', ...) in file A replaces
 * the real module for file B too. This script works around that by
 * spawning a separate `bun test <file>` for each test file.
 *
 * Runs up to CONCURRENCY files at a time to speed up large suites while
 * keeping process isolation.
 */

import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const TEST_DIR = join(ROOT, 'packages/testing/unit');
const PRELOAD = join(ROOT, 'packages/testing/unit/preload.ts');
const CONCURRENCY = 4;

export function collectTestFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(full));
    } else if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.test.tsx')
    ) {
      files.push(full);
    }
  }
  return files.sort();
}

async function runOne(
  file: string
): Promise<{ rel: string; exitCode: number; stdout: string; stderr: string }> {
  const rel = relative(ROOT, file);
  const proc = Bun.spawn(['bun', 'test', file, '--preload', PRELOAD], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { rel, exitCode, stdout, stderr };
}

async function main() {
  const testFiles = collectTestFiles(TEST_DIR);
  console.log(
    `Running ${testFiles.length} test files in isolated subprocesses (concurrency ${CONCURRENCY})...\n`
  );

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < testFiles.length; i += CONCURRENCY) {
    const chunk = testFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(runOne));

    for (const { rel, exitCode, stdout, stderr } of results) {
      if (exitCode === 0) {
        const match = stdout.match(/(\d+) pass/);
        const count = match ? match[1] : '?';
        console.log(`  ✓ ${rel} (${count} pass)`);
        passed++;
      } else {
        console.log(`  ✗ ${rel}`);
        const failLines = (stdout + stderr)
          .split('\n')
          .filter(
            (l) =>
              l.includes('(fail)') ||
              l.includes('error:') ||
              l.includes('Error:')
          )
          .slice(0, 8);
        for (const line of failLines) {
          console.log(`    ${line.trim()}`);
        }
        failed++;
        failures.push(rel);
      }
    }
  }

  console.log(`\n${passed} files passed, ${failed} files failed`);
  if (failures.length > 0) {
    console.log('\nFailed files:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error running isolated unit tests:', err);
  process.exit(1);
});
