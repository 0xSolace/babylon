#!/usr/bin/env bun

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const rootDir = path.resolve(import.meta.dir, '..');
const appDir = path.join(rootDir, 'apps/web');
const requestedBaseUrl =
  process.env.TEST_BASE_URL ||
  process.env.TEST_API_URL ||
  'http://127.0.0.1:3100';
const requestedUrl = new URL(requestedBaseUrl);
const serverHostname = requestedUrl.hostname;
const serverPort =
  requestedUrl.port || (requestedUrl.protocol === 'https:' ? '443' : '80');
const portReservationDir = path.join(
  tmpdir(),
  'babylon-integration-server-ports'
);

type NextDevLock = {
  pid: number;
  port: number;
  hostname: string;
  appUrl: string;
  startedAt: number;
};

type PortReservation = {
  port: number;
  lockPath: string;
};

const testPrivyDidPattern =
  /Authorization[\s\S]{0,200}did:privy:test-|Bearer did:privy:test-/;

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

function getNextDevLockPath(distDir: string): string {
  return path.join(appDir, distDir, 'dev', 'lock');
}

function readNextDevLock(distDir: string): NextDevLock | null {
  const nextDevLockPath = getNextDevLockPath(distDir);

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

function removeNextDevLock(distDir: string) {
  const nextDevLockPath = getNextDevLockPath(distDir);

  if (existsSync(nextDevLockPath)) {
    rmSync(nextDevLockPath, { force: true });
  }
}

async function supportsTestPrivyDidAuth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/waitlist/bonus/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer did:privy:test-123456789012345',
      },
      body: JSON.stringify({ email: 'probe@example.com' }),
      signal: AbortSignal.timeout(10_000),
    });

    return response.status !== 401;
  } catch {
    return false;
  }
}

async function isPortAvailable(
  hostname: string,
  port: number
): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.unref();

    server.once('error', () => resolve(false));
    server.listen({ host: hostname, port }, () => {
      server.close(() => resolve(true));
    });
  });
}

function reservePort(hostname: string, port: number): PortReservation | null {
  mkdirSync(portReservationDir, { recursive: true });

  const reservationPath = path.join(
    portReservationDir,
    `${hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}-${port}.json`
  );

  try {
    writeFileSync(
      reservationPath,
      JSON.stringify({
        pid: process.pid,
        hostname,
        port,
        reservedAt: Date.now(),
      }),
      { flag: 'wx' }
    );

    return { port, lockPath: reservationPath };
  } catch (error) {
    const reservationError = error as NodeJS.ErrnoException;
    if (reservationError.code !== 'EEXIST') {
      throw error;
    }

    try {
      const existingReservation = JSON.parse(
        readFileSync(reservationPath, 'utf-8')
      ) as { pid?: number } | null;

      if (
        typeof existingReservation?.pid === 'number' &&
        !isProcessAlive(existingReservation.pid)
      ) {
        rmSync(reservationPath, { force: true });
        return reservePort(hostname, port);
      }
    } catch {
      rmSync(reservationPath, { force: true });
      return reservePort(hostname, port);
    }

    return null;
  }
}

function releasePortReservation(reservation: PortReservation | null) {
  if (reservation) {
    rmSync(reservation.lockPath, { force: true });
  }
}

function collectTestFiles(targets: string[]): string[] {
  const files: string[] = [];

  const walk = (targetPath: string) => {
    for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
      const entryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.test.ts')) {
        files.push(entryPath);
      }
    }
  };

  for (const target of targets) {
    const resolvedTarget = path.resolve(rootDir, target);
    if (!existsSync(resolvedTarget)) {
      continue;
    }

    const targetStats = statSync(resolvedTarget);
    if (targetStats.isDirectory()) {
      walk(resolvedTarget);
      continue;
    }

    if (targetStats.isFile()) {
      files.push(resolvedTarget);
    }
  }

  return files;
}

function requiresTestPrivyDidAuth(targets: string[]): boolean {
  for (const filePath of collectTestFiles(targets)) {
    if (testPrivyDidPattern.test(readFileSync(filePath, 'utf-8'))) {
      return true;
    }
  }

  return false;
}

async function findAvailablePort(
  hostname: string,
  preferredPort: number
): Promise<PortReservation> {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await isPortAvailable(hostname, port)) {
      const reservation = reservePort(hostname, port);
      if (reservation) {
        return reservation;
      }
    }
  }

  throw new Error(
    `Unable to find an available port for integration server starting at ${preferredPort}`
  );
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

async function stopServer(server: ChildProcessWithoutNullStreams) {
  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    server.once('exit', () => resolve());
    setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 5000);
  });
}

async function runTestFile(filePath: string, env: NodeJS.ProcessEnv) {
  const proc = spawn(
    'bun',
    [
      'test',
      '--preload',
      './packages/testing/integration/preload.ts',
      '--max-concurrency',
      '1',
      filePath,
    ],
    {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    }
  );

  return await new Promise<number>((resolve, reject) => {
    proc.once('error', reject);
    proc.once('exit', (code) => resolve(code ?? 1));
  });
}

async function runWithOwnedServer(
  filePath: string,
  hostname: string,
  preferredPort: number
) {
  const portReservation = await findAvailablePort(hostname, preferredPort);
  const effectiveBaseUrl = `${requestedUrl.protocol}//${hostname}:${portReservation.port}`;
  const isolatedDistDir = `.next-integration-${portReservation.port}`;
  const isolatedLock = readNextDevLock(isolatedDistDir);
  const sharedEnv = {
    ...process.env,
    TEST_BASE_URL: effectiveBaseUrl,
    TEST_API_URL: effectiveBaseUrl,
    DISABLE_RATE_LIMITING: 'true',
    ALLOW_TEST_PRIVY_DID_AUTH: 'true',
    PERP_SETTLEMENT_MODE: 'simulation',
    NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'simulation',
  };

  if (isolatedLock && !isProcessAlive(isolatedLock.pid)) {
    console.warn(
      `🧹 Removing stale isolated Next dev lock for ${isolatedLock.appUrl} (pid ${isolatedLock.pid})`
    );
    removeNextDevLock(isolatedDistDir);
  }

  console.warn(
    `🧪 Starting isolated integration server at ${effectiveBaseUrl}`
  );

  const server = spawn(
    'bunx',
    [
      'next',
      'dev',
      '--hostname',
      hostname,
      '--port',
      `${portReservation.port}`,
    ],
    {
      cwd: appDir,
      env: {
        ...sharedEnv,
        NEXT_DIST_DIR: isolatedDistDir,
      },
      stdio: 'pipe',
    }
  );

  try {
    await waitForServer(server, effectiveBaseUrl);
    return await runTestFile(filePath, sharedEnv);
  } finally {
    await stopServer(server);
    releasePortReservation(portReservation);
  }
}

async function main() {
  const testTargets =
    process.argv.length > 2
      ? process.argv.slice(2)
      : ['packages/testing/integration/'];
  const testFiles = [...new Set(collectTestFiles(testTargets))].sort();
  const hasExplicitBaseUrl =
    process.env.TEST_BASE_URL !== undefined ||
    process.env.TEST_API_URL !== undefined;
  const needsTestPrivyDidAuth = requiresTestPrivyDidAuth(testTargets);
  const explicitServerReady =
    hasExplicitBaseUrl && (await isServerReady(requestedBaseUrl, 10_000));
  const canReuseServer =
    explicitServerReady &&
    (!needsTestPrivyDidAuth ||
      (await supportsTestPrivyDidAuth(requestedBaseUrl)));

  if (explicitServerReady && needsTestPrivyDidAuth && !canReuseServer) {
    throw new Error(
      `Explicit integration server at ${requestedBaseUrl} does not support test Privy DID auth`
    );
  }

  if (testFiles.length === 0) {
    throw new Error(
      `No integration test files found for targets: ${testTargets.join(', ')}`
    );
  }

  const requestedPortNumber = Number(serverPort);

  if (canReuseServer) {
    console.log(`♻️ Reusing integration server at ${requestedBaseUrl}`);
  }

  for (const filePath of testFiles) {
    console.log(
      `\n🧪 Running integration file: ${path.relative(rootDir, filePath)}`
    );

    const exitCode = canReuseServer
      ? await runTestFile(filePath, {
          ...process.env,
          TEST_BASE_URL: requestedBaseUrl,
          TEST_API_URL: requestedBaseUrl,
          DISABLE_RATE_LIMITING: 'true',
          ALLOW_TEST_PRIVY_DID_AUTH: 'true',
          PERP_SETTLEMENT_MODE: 'simulation',
          NEXT_PUBLIC_PERP_SETTLEMENT_MODE: 'simulation',
        })
      : await runWithOwnedServer(filePath, serverHostname, requestedPortNumber);

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

await main();
