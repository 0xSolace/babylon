/**
 * Test Infrastructure Setup
 *
 * Orchestrates Jeju service startup and test environment setup.
 * All services are managed by Jeju CLI - no Docker Compose fallback.
 *
 * Prerequisites:
 * - Jeju CLI installed: cd /path/to/jeju && bun install
 * - Services running: cd /path/to/jeju && bun run dev
 *
 * Test Modes:
 * 1. Unit tests: No infrastructure needed (mocks)
 * 2. Integration tests: Postgres + Redis + Hardhat (via Jeju)
 * 3. E2E tests: Full stack including web server
 * 4. Decentralized tests: Full Jeju stack (CQL, KMS, OAuth3, etc.)
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { checkMessagingContracts, ensureContractsDeployed } from './contracts';
import {
  checkAllServices,
  checkCoreServices,
  checkJejuServices,
  type InfrastructureStatus,
  isJejuRunning,
  printStatus,
} from './health-check';

export type TestMode = 'unit' | 'integration' | 'e2e' | 'decentralized' | 'all';
export type NetworkMode = 'localnet' | 'testnet';

interface SetupOptions {
  testMode: TestMode;
  network: NetworkMode;
  deployContracts: boolean;
  skipHealthCheck: boolean;
  timeout: number;
}

const DEFAULT_OPTIONS: SetupOptions = {
  testMode: 'integration',
  network: 'localnet',
  deployContracts: false,
  skipHealthCheck: false,
  timeout: 120000, // 2 minutes
};

function parseEnvFile(): Record<string, string> {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    }
  }

  return env;
}

function updateEnvFile(updates: Record<string, string>): void {
  const envPath = join(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    writeFileSync(
      envPath,
      Object.entries(updates)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n'
    );
    return;
  }

  let content = readFileSync(envPath, 'utf-8');

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  writeFileSync(envPath, content);
}

export async function setupTestInfrastructure(
  options: Partial<SetupOptions> = {}
): Promise<{
  healthy: boolean;
  services: InfrastructureStatus;
  contractsDeployed: boolean;
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log('\n' + '═'.repeat(60));
  console.log(`JEJU TEST INFRASTRUCTURE (${opts.network}, ${opts.testMode})`);
  console.log('═'.repeat(60) + '\n');

  // Load environment
  const env = parseEnvFile();
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.BUN_ENV = 'test';

  // For unit tests, no infrastructure needed
  if (opts.testMode === 'unit') {
    console.log('[Setup] Unit test mode - no infrastructure required');
    return {
      healthy: true,
      services: {
        healthy: true,
        services: [],
        missingServices: [],
        timestamp: Date.now(),
      },
      contractsDeployed: false,
    };
  }

  // Check if Jeju is running
  const jejuRunning = await isJejuRunning();
  if (!jejuRunning) {
    console.error('[Setup] ❌ Jeju CLI is not running');
    console.error('');
    console.error('To start Jeju services:');
    console.error('  cd /path/to/jeju && bun run dev');
    console.error('');

    if (!opts.skipHealthCheck) {
      throw new Error(
        'Jeju CLI is not running. Start it with: cd /path/to/jeju && bun run dev'
      );
    }
  } else {
    console.log('[Setup] ✅ Jeju CLI detected');
  }

  // Check core services
  console.log('[Setup] Checking core services...');
  const coreStatus = await checkCoreServices();

  if (!coreStatus.healthy && !opts.skipHealthCheck) {
    printStatus(coreStatus);
    console.error(
      `\n[Setup] ❌ Core services not healthy: ${coreStatus.missingServices.join(', ')}`
    );
    console.error(
      '[Setup] Make sure Jeju CLI is running: cd /path/to/jeju && bun run dev'
    );
    throw new Error(
      `Core services not healthy: ${coreStatus.missingServices.join(', ')}`
    );
  }

  console.log('[Setup] ✅ Core services ready');

  // For decentralized mode, check all Jeju services
  let contractsDeployed = false;

  if (opts.testMode === 'decentralized' || opts.testMode === 'e2e') {
    console.log('[Setup] Checking Jeju services...');
    const jejuStatus = await checkJejuServices();

    if (!jejuStatus.healthy && !opts.skipHealthCheck) {
      printStatus(jejuStatus);
      console.error('[Setup] ❌ Required Jeju services not healthy');
      console.error('[Setup] Run: cd /path/to/jeju && bun run dev');
      throw new Error(
        `Jeju services not healthy. Missing: ${jejuStatus.missingServices.join(', ')}`
      );
    }

    console.log('[Setup] ✅ Jeju services ready');

    // Check and deploy contracts if needed
    if (opts.deployContracts) {
      console.log('[Setup] Checking messaging contracts...');
      const contractStatus = await checkMessagingContracts(opts.network);

      if (!contractStatus.allDeployed) {
        console.log('[Setup] Deploying messaging contracts...');
        const addresses = await ensureContractsDeployed(opts.network);

        // Update .env with contract addresses
        updateEnvFile({
          KEY_REGISTRY_ADDRESS: addresses.keyRegistry,
          MESSAGE_NODE_REGISTRY_ADDRESS: addresses.messageNodeRegistry,
        });

        // Also set in process.env for current run
        process.env.KEY_REGISTRY_ADDRESS = addresses.keyRegistry;
        process.env.MESSAGE_NODE_REGISTRY_ADDRESS =
          addresses.messageNodeRegistry;

        contractsDeployed = true;
        console.log('[Setup] ✅ Contracts deployed');
      } else {
        contractsDeployed = true;
        console.log('[Setup] ✅ Contracts already deployed');
      }
    }
  }

  // Final status
  const finalStatus = await checkAllServices();
  printStatus(finalStatus);

  console.log('═'.repeat(60));
  console.log('SETUP COMPLETE');
  console.log('═'.repeat(60) + '\n');

  return {
    healthy: coreStatus.healthy,
    services: finalStatus,
    contractsDeployed,
  };
}

export async function teardownTestInfrastructure(): Promise<void> {
  console.log('\n[Teardown] Test infrastructure cleanup complete\n');
  // Don't stop Jeju services - they should keep running for other tests
}

// Export for preload usage
export {
  checkAllServices,
  checkCoreServices,
  checkJejuServices,
  isJejuRunning,
  printStatus,
};

// CLI entry point
if (import.meta.main) {
  const testMode = (process.argv
    .find((a) => a.startsWith('--mode='))
    ?.split('=')[1] ?? 'integration') as TestMode;
  const network = (process.argv
    .find((a) => a.startsWith('--network='))
    ?.split('=')[1] ?? 'localnet') as NetworkMode;
  const deployContracts = process.argv.includes('--deploy');
  const skipHealthCheck = process.argv.includes('--skip-health');

  const result = await setupTestInfrastructure({
    testMode,
    network,
    deployContracts,
    skipHealthCheck,
  });

  process.exit(result.healthy ? 0 : 1);
}
