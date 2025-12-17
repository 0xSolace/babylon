#!/usr/bin/env bun

/**
 * Dev Command - Start the full Babylon development environment
 *
 * This command:
 * 1. Starts the Jeju localnet (L1, L2, CQL) via the Jeju CLI
 * 2. Deploys Babylon contracts
 * 3. Starts the Babylon web app
 *
 * Usage:
 *   babylon dev                 # Start everything
 *   babylon dev --minimal       # Chain only, no web app
 *   babylon dev --skip-chain    # Skip chain, just start web app
 *   babylon dev --stop          # Stop all services
 */

import { $ } from 'bun';
import { existsSync } from 'fs';
import { join } from 'path';
import { getFlag, parseArgs, wantsHelp } from '../lib/args.js';
import { logger } from '../lib/logger.js';

// Root directory of the Jeju monorepo
const JEJU_ROOT = join(process.cwd(), '..', '..');
const BABYLON_ROOT = process.cwd();

interface DevOptions {
  minimal: boolean;
  skipChain: boolean;
  skipContracts: boolean;
  stop: boolean;
}

function printHelp(): void {
  console.log(`
Dev Command - Start Babylon development environment

USAGE:
  babylon dev [options]

OPTIONS:
  --minimal         Start chain only (no web app)
  --skip-chain      Skip chain startup (assumes already running)
  --skip-contracts  Skip contract deployment
  --stop            Stop all services

ENVIRONMENT:
  JEJU_RPC_URL      Override L2 RPC URL (default: http://localhost:9545)
  CQL_ENDPOINT      Override CQL endpoint (default: http://localhost:4300)

EXAMPLES:
  babylon dev                    # Start everything
  babylon dev --minimal          # Chain only
  babylon dev --skip-chain       # Web app only
  babylon dev --stop             # Stop all services
`);
}

async function checkJejuCLI(): Promise<boolean> {
  try {
    await $`which jeju`.quiet();
    return true;
  } catch {
    // Try to find jeju in the monorepo
    const jejuBin = join(JEJU_ROOT, 'packages/cli/bin/jeju.js');
    return existsSync(jejuBin);
  }
}

async function runJejuCommand(args: string[]): Promise<void> {
  // Try global jeju first
  try {
    await $`which jeju`.quiet();
    const proc = Bun.spawn(['jeju', ...args], {
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await proc.exited;
    return;
  } catch {
    // Fall back to local
  }

  // Try local jeju
  const jejuBin = join(JEJU_ROOT, 'packages/cli/bin/jeju.js');
  if (existsSync(jejuBin)) {
    const proc = Bun.spawn(['bun', 'run', jejuBin, ...args], {
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await proc.exited;
    return;
  }

  throw new Error(
    'Jeju CLI not found. Install with: bun add -g @jejunetwork/cli'
  );
}

async function startChain(): Promise<void> {
  logger.header('Starting Jeju Chain');

  // Check if chain is already running
  try {
    const result =
      await $`curl -s -X POST http://localhost:9545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'`.quiet();
    if (result.text().includes('result')) {
      logger.success('Chain already running');
      return;
    }
  } catch {
    // Chain not running, continue
  }

  // Start via Jeju CLI
  logger.step('Starting Jeju localnet...');
  await runJejuCommand(['dev', '--minimal']);

  // Wait for chain to be ready
  logger.step('Waiting for chain...');
  let attempts = 0;
  while (attempts < 30) {
    try {
      const result =
        await $`curl -s -X POST http://localhost:9545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'`.quiet();
      if (result.text().includes('result')) {
        logger.success('Chain is ready');
        break;
      }
    } catch {
      // Keep trying
    }
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  if (attempts >= 30) {
    throw new Error('Chain failed to start in time');
  }
}

async function checkCQL(): Promise<boolean> {
  try {
    const result = await $`curl -s http://localhost:4300/health`.quiet();
    return result.text().includes('ok') || result.exitCode === 0;
  } catch {
    return false;
  }
}

async function deployContracts(): Promise<void> {
  logger.header('Deploying Contracts');

  // Check if contracts already deployed
  const envPath = join(BABYLON_ROOT, '.env.local');
  if (existsSync(envPath)) {
    const env = await Bun.file(envPath).text();
    if (env.includes('BABYLON_DIAMOND_ADDRESS=0x')) {
      logger.success('Contracts already deployed');
      return;
    }
  }

  logger.step('Deploying Babylon contracts...');
  const deployProc = Bun.spawn(['bun', 'run', 'babylon', 'deploy', 'local'], {
    cwd: BABYLON_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await deployProc.exited;
  logger.success('Contracts deployed');
}

async function startWebApp(): Promise<void> {
  logger.header('Starting Babylon');

  logger.step('Starting web app...');

  // Run turbo dev for web with Jeju environment
  const webProc = Bun.spawn(['bun', 'run', 'dev:web'], {
    cwd: BABYLON_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_RPC_URL: 'http://localhost:9545',
      CQL_BLOCK_PRODUCER_ENDPOINT: 'http://localhost:4300',
      MESSAGING_MODE: 'decentralized',
    },
  });
  await webProc.exited;
}

async function stopAll(): Promise<void> {
  logger.header('Stopping All Services');

  // Stop web app (kill Next.js processes)
  logger.step('Stopping web app...');
  await $`pkill -f "next dev" || true`.quiet().nothrow();

  // Stop chain via Jeju CLI
  logger.step('Stopping chain...');
  try {
    await runJejuCommand(['dev', '--stop']);
  } catch {
    // OK if it fails
  }

  logger.success('All services stopped');
}

export async function runDevCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (wantsHelp(parsed)) {
    printHelp();
    return;
  }

  const options: DevOptions = {
    minimal: getFlag(parsed, 'minimal'),
    skipChain: getFlag(parsed, 'skip-chain'),
    skipContracts: getFlag(parsed, 'skip-contracts'),
    stop: getFlag(parsed, 'stop'),
  };

  if (options.stop) {
    await stopAll();
    return;
  }

  // Check Jeju CLI is available
  if (!options.skipChain) {
    const hasJeju = await checkJejuCLI();
    if (!hasJeju) {
      logger.fail('Jeju CLI not found');
      console.log('\nInstall with:');
      console.log('  cd ' + JEJU_ROOT + ' && bun install && bun link');
      console.log('  # or');
      console.log('  bun add -g @jejunetwork/cli');
      process.exit(1);
    }
  }

  try {
    // Start chain (L1, L2, CQL)
    if (!options.skipChain) {
      await startChain();

      // Check CQL is available
      const cqlHealthy = await checkCQL();
      if (!cqlHealthy) {
        logger.warn(
          'CQL not responding - decentralized messaging may not work'
        );
        logger.info('CQL endpoint: http://localhost:4300');
      } else {
        logger.success('CQL is healthy');
      }
    }

    // Deploy contracts
    if (!options.skipContracts) {
      await deployContracts();
    }

    // Start web app
    if (!options.minimal) {
      await startWebApp();
    } else {
      logger.success('Minimal mode - chain is running');
      logger.info('L2 RPC: http://localhost:9545');
      logger.info('CQL API: http://localhost:4300');
      logger.info('\nPress Ctrl+C to stop');

      // Keep running
      await new Promise(() => {});
    }
  } catch (error) {
    const err = error as Error;
    logger.fail(err.message);
    process.exit(1);
  }
}
