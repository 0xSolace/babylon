#!/usr/bin/env bun
/**
 * Standalone Development Bootstrap
 *
 * Starts Babylon with its own local development network when running
 * outside of Jeju. This allows development without the full Jeju stack.
 *
 * Features:
 * - Local Anvil chain for contracts
 * - Mock storage (MinIO)
 * - Local inference (Ollama or mock)
 * - Deploys BabylonTreasury contract
 *
 * Usage:
 *   bun run scripts/standalone-dev.ts
 *
 * Environment:
 *   USE_JEJU=false (default in standalone)
 *   STANDALONE_MODE=true
 */

import { type ChildProcess, spawn } from 'child_process';
import { JsonRpcProvider, parseEther, Wallet } from 'ethers';

// ============================================================================
// Configuration
// ============================================================================

const ANVIL_PORT = 8545;
const MINIO_PORT = 9000;
const GAME_PORT = 5007;
const ANVIL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil default

const _BABYLON_TREASURY_ABI = [
  'constructor(uint256 _dailyLimit)',
  'function deposit() payable',
  'function registerOperator(address _operator, bytes _attestation)',
  'function getBalance() view returns (uint256)',
];

const _BABYLON_TREASURY_BYTECODE = '0x'; // Placeholder - would be compiled from Solidity

// ============================================================================
// Process Management
// ============================================================================

const processes: Map<string, ChildProcess> = new Map();

async function startProcess(
  name: string,
  command: string,
  args: string[],
  cwd?: string
): Promise<void> {
  console.log(`[${name}] Starting: ${command} ${args.join(' ')}`);

  const proc = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  processes.set(name, proc);

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.log(`[${name}] ${line}`);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.error(`[${name}] ${line}`);
    }
  });

  proc.on('error', (err) => {
    console.error(`[${name}] Error:`, err);
  });

  proc.on('exit', (code) => {
    console.log(`[${name}] Exited with code ${code}`);
    processes.delete(name);
  });
}

async function waitForPort(port: number, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`).catch(
        () => null
      );
      if (response) return true;
    } catch {
      // Continue waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function waitForRpc(url: string, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const provider = new JsonRpcProvider(url);
      await provider.getBlockNumber();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

// ============================================================================
// Services
// ============================================================================

async function startAnvil(): Promise<void> {
  await startProcess('anvil', 'anvil', [
    '--port',
    ANVIL_PORT.toString(),
    '--host',
    '0.0.0.0',
    '--accounts',
    '10',
    '--balance',
    '10000',
    '--block-time',
    '1',
  ]);

  console.log('[anvil] Waiting for RPC...');
  const ready = await waitForRpc(`http://localhost:${ANVIL_PORT}`);
  if (!ready) {
    throw new Error('Anvil failed to start');
  }
  console.log('[anvil] Ready!');
}

async function startMinio(): Promise<void> {
  // Check if MinIO is already running
  const alreadyRunning = await waitForPort(MINIO_PORT, 1000);
  if (alreadyRunning) {
    console.log('[minio] Already running');
    return;
  }

  // Try to start MinIO container
  await startProcess('minio', 'docker', [
    'run',
    '--rm',
    '-p',
    `${MINIO_PORT}:9000`,
    '-p',
    '9001:9001',
    '-e',
    'MINIO_ROOT_USER=babylon',
    '-e',
    'MINIO_ROOT_PASSWORD=babylon_dev_password',
    'minio/minio',
    'server',
    '/data',
    '--console-address',
    ':9001',
  ]);

  console.log('[minio] Waiting for startup...');
  await new Promise((r) => setTimeout(r, 3000));
  console.log('[minio] Ready!');
}

async function deployContracts(): Promise<{ treasuryAddress: string }> {
  console.log('[contracts] Deploying BabylonTreasury...');

  const provider = new JsonRpcProvider(`http://localhost:${ANVIL_PORT}`);
  const wallet = new Wallet(ANVIL_PRIVATE_KEY, provider);

  // For now, return a mock address - in production we'd compile and deploy
  // the actual contract from packages/contracts/src/games/BabylonTreasury.sol

  // Simulate deployment by just using a deterministic address
  const mockTreasuryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  console.log('[contracts] Treasury deployed (mock) at:', mockTreasuryAddress);

  // Fund the treasury
  const tx = await wallet.sendTransaction({
    to: mockTreasuryAddress,
    value: parseEther('100'),
  });
  await tx.wait();

  console.log('[contracts] Treasury funded with 100 ETH');

  return { treasuryAddress: mockTreasuryAddress };
}

async function startGame(treasuryAddress: string): Promise<void> {
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    STANDALONE_MODE: 'true',
    USE_JEJU: 'false',
    RPC_URL: `http://localhost:${ANVIL_PORT}`,
    BABYLON_TREASURY_ADDRESS: treasuryAddress,
    MINIO_ENDPOINT: `http://localhost:${MINIO_PORT}`,
    MINIO_ACCESS_KEY: 'babylon',
    MINIO_SECRET_KEY: 'babylon_dev_password',
    MINIO_BUCKET: 'babylon-uploads',
    PORT: GAME_PORT.toString(),
  };

  // Export env for child processes
  for (const [key, value] of Object.entries(env)) {
    if (value) process.env[key] = value;
  }

  await startProcess('game', 'bun', ['run', 'dev'], process.cwd());

  console.log(`[game] Starting on port ${GAME_PORT}...`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('          Babylon Standalone Development Mode              ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Check if we should use Jeju instead
  if (process.env.USE_JEJU === 'true' || process.env.JEJU_NETWORK) {
    console.log(
      'USE_JEJU is set - use the Jeju development environment instead'
    );
    console.log('Run: bun run dev (from jeju root)');
    process.exit(1);
  }

  // Start services
  try {
    await startAnvil();
    await startMinio();

    const { treasuryAddress } = await deployContracts();

    await startGame(treasuryAddress);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Babylon is running in standalone development mode!       ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Services:');
    console.log(`    - Game:     http://localhost:${GAME_PORT}`);
    console.log(`    - Anvil:    http://localhost:${ANVIL_PORT}`);
    console.log(`    - MinIO:    http://localhost:${MINIO_PORT}`);
    console.log(`    - Treasury: ${treasuryAddress}`);
    console.log('');
    console.log('  Press Ctrl+C to stop all services');
    console.log('');

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      for (const [name, proc] of processes) {
        console.log(`  Stopping ${name}...`);
        proc.kill('SIGTERM');
      }
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('Failed to start:', error);
    for (const proc of processes.values()) {
      proc.kill('SIGTERM');
    }
    process.exit(1);
  }
}

main();
