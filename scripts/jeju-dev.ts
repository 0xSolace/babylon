#!/usr/bin/env bun
/**
 * Jeju Dev Integration
 *
 * This script integrates Babylon with the Jeju CLI for seamless development.
 * It can be called directly or via `jeju dev` when Babylon is configured as a vendor app.
 *
 * Usage:
 *   bun run scripts/jeju-dev.ts          # Start with Jeju services
 *   JEJU_NETWORK=localnet bun run dev    # Start with existing Jeju services
 *
 * Environment:
 *   JEJU_RPC_URL: Set by Jeju CLI when running under `jeju dev`
 *   JEJU_NETWORK: localnet | testnet | mainnet
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
};

async function findJejuRoot(): Promise<string | null> {
  // Check common locations
  const candidates = [
    join(process.cwd(), '..', '..'), // vendor/babylon -> jeju
    process.env.JEJU_ROOT,
    join(process.env.HOME || '', 'jeju'),
    '/opt/jeju',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const jejuPackageJson = join(candidate, 'package.json');
    if (existsSync(jejuPackageJson)) {
      try {
        const pkg = await Bun.file(jejuPackageJson).json();
        if (pkg.name === 'jeju') {
          return candidate;
        }
      } catch {
        // Not a valid package.json
      }
    }
  }

  return null;
}

async function isJejuRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:4300/health', {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startJejuServices(jejuRoot: string): Promise<void> {
  console.log(`${COLORS.CYAN}Starting Jeju services...${COLORS.RESET}`);
  console.log(`${COLORS.DIM}Jeju root: ${jejuRoot}${COLORS.RESET}`);

  // Start Jeju in background
  const jejuProcess = spawn('bun', ['run', 'dev'], {
    cwd: jejuRoot,
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      JEJU_VENDOR_APPS: 'babylon',
    },
  });

  jejuProcess.unref();

  // Wait for services to be ready
  console.log(
    `${COLORS.DIM}Waiting for Jeju services to start...${COLORS.RESET}`
  );

  for (let i = 0; i < 60; i++) {
    if (await isJejuRunning()) {
      console.log(`${COLORS.GREEN}✓ Jeju services started${COLORS.RESET}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error('Jeju services failed to start within 60 seconds');
}

async function runBabylon(): Promise<void> {
  console.log(`${COLORS.CYAN}Starting Babylon...${COLORS.RESET}`);

  // Run pre-dev setup
  const { $ } = await import('bun');
  await $`bun run scripts/pre-dev/pre-dev-decentralized.ts`;

  // Start dev server
  const devProcess = spawn(
    'bun',
    ['run', 'turbo', 'run', 'dev', '--filter=web'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        JEJU_NETWORK: process.env.JEJU_NETWORK || 'localnet',
      },
    }
  );

  devProcess.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function main(): Promise<void> {
  console.log(
    `\n${COLORS.CYAN}=== Babylon + Jeju Development ===${COLORS.RESET}\n`
  );

  // Check if already running under Jeju
  if (process.env.JEJU_RPC_URL) {
    console.log(`${COLORS.GREEN}Running under Jeju CLI${COLORS.RESET}`);
    await runBabylon();
    return;
  }

  // Check if Jeju services are already running
  if (await isJejuRunning()) {
    console.log(`${COLORS.GREEN}Jeju services already running${COLORS.RESET}`);
    await runBabylon();
    return;
  }

  // Try to find and start Jeju
  const jejuRoot = await findJejuRoot();

  if (jejuRoot) {
    await startJejuServices(jejuRoot);
    await runBabylon();
  } else {
    console.log(
      `${COLORS.YELLOW}Jeju not found - attempting standalone mode${COLORS.RESET}`
    );
    console.log(
      `${COLORS.DIM}For full decentralization, install Jeju:${COLORS.RESET}`
    );
    console.log(
      `${COLORS.DIM}  git clone https://github.com/jeju-network/jeju.git${COLORS.RESET}`
    );
    console.log(
      `${COLORS.DIM}  cd jeju && bun install && bun run dev${COLORS.RESET}`
    );
    console.log('');

    // Try to run anyway - pre-dev will fail if services aren't available
    await runBabylon();
  }
}

main().catch((err) => {
  console.error(`${COLORS.RED}Error: ${err.message}${COLORS.RESET}`);
  process.exit(1);
});
