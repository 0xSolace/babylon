/**
 * Contract Test Setup Utility
 *
 * Shared utilities for ensuring the local chain is running and contracts are deployed
 * for integration tests.
 *
 * Set SKIP_CHAIN_TESTS=1 (or "true") to disable chain-dependent tests (e.g. in CI
 * when no local chain/localnet is available). When set, ensureContractsReady() returns
 * false immediately and tests that rely on it will skip.
 */

import { isContractDeployed, loadDeployment } from '@babylon/contracts';
import { LOCAL_CONTRACT_ADDRESSES } from '@babylon/shared';
import { $ } from 'bun';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const LOCAL_RPC_URL =
  process.env.LOCAL_RPC_URL ||
  process.env.HARDHAT_RPC_URL ||
  'http://localhost:8545';

/** True when chain-dependent tests should be skipped (e.g. SKIP_CHAIN_TESTS=1 in CI). */
export function skipChainTests(): boolean {
  const v = process.env.SKIP_CHAIN_TESTS;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Load environment variables from .env.local file
 */
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

/**
 * Check if the local chain is running
 */
export async function ensureHardhatRunning(): Promise<boolean> {
  try {
    // Check if the local JSON-RPC endpoint is responding
    execSync(`cast block-number --rpc-url ${LOCAL_RPC_URL}`, {
      stdio: 'ignore',
    });
    console.log('✅ Local chain RPC is running');
    return true;
  } catch {
    console.log(
      '⚠️  Local Anvil RPC not detected. Please start it with: bun run anvil'
    );
    return false;
  }
}

/**
 * Check if contracts are deployed on-chain
 */
export async function areContractsDeployed(): Promise<boolean> {
  // Use canonical config addresses for local development
  let oracleAddress: string | undefined =
    LOCAL_CONTRACT_ADDRESSES.babylonOracle;
  let diamondAddress: string | undefined = LOCAL_CONTRACT_ADDRESSES.diamond;

  // Try to load from deployment file to check for fresh deployments
  try {
    const deployment = await loadDeployment('localnet');
    if (deployment) {
      if (deployment.contracts.babylonOracle) {
        oracleAddress = deployment.contracts.babylonOracle;
      }
      if (deployment.contracts.diamond) {
        diamondAddress = deployment.contracts.diamond;
      }
    }
  } catch {
    // Deployment file might not exist yet, use canonical config
  }

  if (!oracleAddress && !diamondAddress) {
    return false;
  }

  try {
    // Check oracle if available
    if (oracleAddress) {
      const deployed = await isContractDeployed(LOCAL_RPC_URL, oracleAddress);
      if (!deployed) return false;
    }

    // Check diamond if available
    if (diamondAddress) {
      const deployed = await isContractDeployed(LOCAL_RPC_URL, diamondAddress);
      if (!deployed) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Deploy contracts to localnet
 */
export async function deployContracts(): Promise<boolean> {
  try {
    console.log('🔄 Bootstrapping local Anvil contracts and market state...');

    // Set environment variables for deployment
    process.env.DEPLOYER_PRIVATE_KEY =
      process.env.DEPLOYER_PRIVATE_KEY ||
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'dummy';
    process.env.NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS = 'true';
    process.env.NEXT_PUBLIC_PERP_SETTLEMENT_MODE = 'onchain';
    process.env.PERP_SETTLEMENT_MODE = 'onchain';

    // Run the same full bootstrap path used by local development.
    await $`BABYLON_LOCAL_BOOTSTRAP_ONCE=1 bun run scripts/wait-for-hardhat-and-deploy.ts`.quiet();

    // Wait a moment for files to be written
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Reload environment variables from both .env.local and .env
    const cwd = process.cwd();
    loadEnvFile(join(cwd, '.env.local'));
    loadEnvFile(join(cwd, '.env'));

    console.log('✅ Contracts deployed successfully');
    return true;
  } catch (error) {
    console.log(
      '❌ Contract deployment failed:',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/**
 * Ensure the local chain is running and contracts are deployed
 * Returns true if everything is ready, false otherwise
 */
export async function ensureContractsReady(): Promise<boolean> {
  if (skipChainTests()) return false;
  // Step 1: Ensure the local chain is running
  const hardhatRunning = await ensureHardhatRunning();
  if (!hardhatRunning) {
    console.log('❌ Cannot proceed without the local chain');
    return false;
  }

  // Step 2: Check if contracts are deployed
  let contractsDeployed = await areContractsDeployed();

  // Step 3: Deploy contracts if needed
  if (!contractsDeployed) {
    console.log('⚠️  Contracts not deployed, deploying now...');
    const deployed = await deployContracts();
    if (deployed) {
      // Verify deployment
      contractsDeployed = await areContractsDeployed();
    }
  }

  if (!contractsDeployed) {
    console.log('❌ Contracts are not deployed and deployment failed');
    return false;
  }

  console.log('✅ Contracts are ready for testing');
  return true;
}
