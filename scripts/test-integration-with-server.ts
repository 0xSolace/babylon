#!/usr/bin/env bun

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const rootDir = path.resolve(import.meta.dir, '..');
const appDir = path.join(rootDir, 'apps/web');
const baseUrl =
  process.env.TEST_BASE_URL ||
  process.env.TEST_API_URL ||
  'http://127.0.0.1:3000';

async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(server: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 120_000;
  let stdoutBuffer = '';
  let stderrBuffer = '';

  server.stdout.on('data', (chunk) => {
    stdoutBuffer = (stdoutBuffer + chunk.toString()).slice(-12000);
  });
  server.stderr.on('data', (chunk) => {
    stderrBuffer = (stderrBuffer + chunk.toString()).slice(-12000);
  });

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Integration test server exited early with code ${server.exitCode}\n` +
          stdoutBuffer +
          '\n' +
          stderrBuffer
      );
    }

    if (await isServerReady()) {
      return;
    }

    await delay(1000);
  }

  throw new Error(
    `Timed out waiting for integration test server at ${baseUrl}\n` +
      stdoutBuffer +
      '\n' +
      stderrBuffer
  );
}

async function main() {
  const alreadyRunning = await isServerReady();
  let server: ChildProcessWithoutNullStreams | null = null;
  const testTargets =
    process.argv.length > 2
      ? process.argv.slice(2)
      : ['packages/testing/integration/'];
  const sharedEnv = {
    ...process.env,
    TEST_BASE_URL: baseUrl,
    TEST_API_URL: baseUrl,
    DISABLE_RATE_LIMITING: 'true',
  };

  if (!alreadyRunning) {
    server = spawn(
      'bunx',
      ['next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'],
      {
        cwd: appDir,
        env: sharedEnv,
        stdio: 'pipe',
      }
    );

    await waitForServer(server);
  }

  try {
    const proc = spawn(
      'bun',
      [
        'test',
        '--preload',
        './packages/testing/integration/preload.ts',
        '--max-concurrency',
        '1',
        ...testTargets,
      ],
      {
        cwd: rootDir,
        env: sharedEnv,
        stdio: 'inherit',
      }
    );

    const exitCode = await new Promise<number>((resolve, reject) => {
      proc.once('error', reject);
      proc.once('exit', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  } finally {
    if (server) {
      server.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        server!.once('exit', () => resolve());
        setTimeout(() => {
          server!.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }
}

await main();
