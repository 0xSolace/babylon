/**
 * Contract Test Setup Utility
 *
 * Shared utilities for ensuring Hardhat is running and contracts are deployed
 * for integration tests
 */

import { isContractDeployed } from '@babylon/contracts';
import { LOCAL_CONTRACT_ADDRESSES } from '@babylon/shared';
import { $ } from 'bun';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createPublicClient, http } from 'viem';
import { localhost } from 'viem/chains';

const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || 'http://localhost:8545';

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
 * Check if Hardhat is running
 */
export async function ensureHardhatRunning(): Promise<boolean> {
  try {
    // Check if Hardhat is responding
    execSync(`cast block-number --rpc-url ${HARDHAT_RPC_URL}`, {
      stdio: 'ignore',
    });
    console.log('✅ Hardhat is running');
    return true;
  } catch {
    console.log(
      '⚠️  Hardhat node not detected. Please start it with: npx hardhat node'
    );
    return false;
  }
}

/**
 * Check if a contract address has deployed code
 */
async function checkContractDeployed(address: string): Promise<boolean> {
  try {
    const client = createPublicClient({
      chain: localhost,
      transport: http(HARDHAT_RPC_URL),
    });
    const code = await client.getBytecode({
      address: address as `0x${string}`,
    });
    return code !== undefined && code !== '0x';
  } catch {
    return false;
  }
}

/**
 * Check if contracts are deployed on-chain
 */
export async function areContractsDeployed(): Promise<boolean> {
  // Use canonical config addresses for local development
  const oracleAddress = LOCAL_CONTRACT_ADDRESSES.gameOracle;
  const diamondAddress = LOCAL_CONTRACT_ADDRESSES.diamond;

  // Check via contracts package helper (uses environment variables)
  const oracleDeployed = isContractDeployed('gameOracle');
  const diamondDeployed = isContractDeployed('diamond');

  if (!oracleDeployed && !diamondDeployed) {
    return false;
  }

  try {
    // Verify on-chain if addresses are configured
    if (oracleAddress) {
      const deployed = await checkContractDeployed(oracleAddress);
      if (!deployed) return false;
    }

    if (diamondAddress) {
      const deployed = await checkContractDeployed(diamondAddress);
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
    console.log('🔄 Deploying contracts to localnet (Hardhat)...');

    // Set environment variables for deployment
    process.env.DEPLOYER_PRIVATE_KEY =
      process.env.DEPLOYER_PRIVATE_KEY ||
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'dummy';

    // Run deployment via CLI
    await $`bun run apps/cli/src/index.ts deploy local`.quiet();

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
 * Ensure Hardhat is running and contracts are deployed
 * Returns true if everything is ready, false otherwise
 */
export async function ensureContractsReady(): Promise<boolean> {
  // Step 1: Ensure Hardhat is running
  const hardhatRunning = await ensureHardhatRunning();
  if (!hardhatRunning) {
    console.log('❌ Cannot proceed without Hardhat');
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
