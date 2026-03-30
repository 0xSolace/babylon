#!/usr/bin/env bun

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const rootDir = path.resolve(import.meta.dir, '..');
const appDir = path.join(rootDir, 'apps/web');
const nextDevLockPath = path.join(appDir, '.next', 'dev', 'lock');
const requestedBaseUrl =
  process.env.TEST_BASE_URL ||
  process.env.TEST_API_URL ||
  'http://127.0.0.1:3100';
const requestedUrl = new URL(requestedBaseUrl);
const serverHostname = requestedUrl.hostname;
const serverPort = requestedUrl.port || '80';

type NextDevLock = {
  pid: number;
  port: number;
  hostname: string;
  appUrl: string;
  startedAt: number;
};

async function isServerReady(
  serverBaseUrl: string,
  timeoutMs: number = 30_000
): Promise<boolean> {
  try {
    const response = await fetch(`${serverBaseUrl}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function readExistingNextDevLock(): NextDevLock | null {
  if (!existsSync(nextDevLockPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      readFileSync(nextDevLockPath, 'utf-8')
    ) as Partial<NextDevLock> | null;
    if (
      !parsed ||
      typeof parsed.pid !== 'number' ||
      typeof parsed.port !== 'number' ||
      typeof parsed.hostname !== 'string' ||
      typeof parsed.appUrl !== 'string' ||
      typeof parsed.startedAt !== 'number'
    ) {
      return null;
    }

    return parsed as NextDevLock;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function removeNextDevLock() {
  if (existsSync(nextDevLockPath)) {
    rmSync(nextDevLockPath, { force: true });
  }
}

async function resolveReusableBaseUrl(): Promise<string | null> {
  if (await isServerReady(requestedBaseUrl, 10_000)) {
    return requestedBaseUrl;
  }

  const existingLock = readExistingNextDevLock();
  if (!existingLock?.appUrl) {
    return null;
  }

  if (await isServerReady(existingLock.appUrl, 10_000)) {
    return existingLock.appUrl;
  }

  return null;
}

async function waitForServer(
  server: ChildProcessWithoutNullStreams,
  serverBaseUrl: string
) {
  const deadline = Date.now() + 300_000;
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

    if (await isServerReady(serverBaseUrl, 10_000)) {
      return;
    }

    await delay(1000);
  }

  throw new Error(
    `Timed out waiting for integration test server at ${serverBaseUrl}\n` +
      stdoutBuffer +
      '\n' +
      stderrBuffer
  );
}

async function main() {
  let server: ChildProcessWithoutNullStreams | null = null;
  const testTargets =
    process.argv.length > 2
      ? process.argv.slice(2)
      : ['packages/testing/integration/'];
  const reusableBaseUrl = await resolveReusableBaseUrl();
  const existingLock = readExistingNextDevLock();
  const effectiveBaseUrl = reusableBaseUrl ?? requestedBaseUrl;
  const sharedEnv = {
    ...process.env,
    TEST_BASE_URL: effectiveBaseUrl,
    TEST_API_URL: effectiveBaseUrl,
    DISABLE_RATE_LIMITING: 'true',
    PERP_SETTLEMENT_MODE: 'simulation',
    NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'simulation',
  };

  if (reusableBaseUrl) {
    console.log(`♻️ Reusing integration server at ${reusableBaseUrl}`);
  } else if (existingLock) {
    if (!isProcessAlive(existingLock.pid)) {
      console.warn(
        `🧹 Removing stale Next dev lock for ${existingLock.appUrl} (pid ${existingLock.pid})`
      );
      removeNextDevLock();
    } else {
      throw new Error(
        `A Next dev server for ${appDir} is already registered at ${existingLock.appUrl} (pid ${existingLock.pid}) but it did not pass health checks. Stop or repair that server before running integration tests.`
      );
    }
  } else {
    server = spawn(
      'bunx',
      ['next', 'dev', '--hostname', serverHostname, '--port', serverPort],
      {
        cwd: appDir,
        env: sharedEnv,
        stdio: 'pipe',
      }
    );

    await waitForServer(server, effectiveBaseUrl);
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
        server.once('exit', () => resolve());
        setTimeout(() => {
          server.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }
}

await main();
