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

import { isContractDeployed } from '@babylon/contracts';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import { OnchainPerpService } from '@babylon/engine';
import { LOCAL_CONTRACT_ADDRESSES } from '@babylon/shared';
import { $ } from 'bun';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const DEFAULT_LOCAL_RPC_URL = 'http://localhost:8545';
const DEFAULT_LOCAL_DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEFAULT_LOCAL_ORACLE_PRIVATE_KEY =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const DEFAULT_LOCAL_ORACLE_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const LOCAL_CHAIN_MISSING_MESSAGE =
  '⚠️  Local Anvil RPC not detected. Please start it with: bun run anvil';

type LocalDeploymentAddresses = {
  diamondAddress?: string;
  oracleAddress?: string;
  predictionAmmRouter?: string;
  predictionOracleAdapter?: string;
  mockUsdc?: string;
};

function resolveConfiguredLocalRpcUrl(): string {
  return (
    process.env.LOCAL_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.RPC_URL ||
    process.env.HARDHAT_RPC_URL ||
    DEFAULT_LOCAL_RPC_URL
  );
}

function setMissingEnv(key: string, value: string): void {
  process.env[key] ??= value;
}

function deriveAddressFromPrivateKey(privateKey: string): string {
  return privateKeyToAccount(privateKey as Hex).address;
}

function isValidOracleEncryptionKey(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return (
    /^[a-fA-F0-9]{64}$/.test(value) || Buffer.from(value, 'utf8').length === 32
  );
}

async function readLocalDeploymentAddresses(): Promise<LocalDeploymentAddresses> {
  const deployment = await loadDeploymentFromDisk('localnet');

  return {
    oracleAddress:
      deployment?.contracts.babylonOracle ||
      LOCAL_CONTRACT_ADDRESSES.babylonOracle,
    diamondAddress:
      deployment?.contracts.diamond || LOCAL_CONTRACT_ADDRESSES.diamond,
    predictionAmmRouter: deployment?.contracts.predictionAmmRouter,
    predictionOracleAdapter: deployment?.contracts.predictionOracleAdapter,
    mockUsdc: deployment?.contracts.mockUsdc,
  };
}

async function readLocalBlockNumber(): Promise<string | null> {
  const response = await fetch(getLocalRpcUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json()) as { result?: string };
  return typeof payload.result === 'string' ? payload.result : null;
}

async function isLocalOnchainPerpDiamondReady(
  diamondAddress: string
): Promise<boolean> {
  if (!(await isContractDeployed(getLocalRpcUrl(), diamondAddress))) {
    return false;
  }

  try {
    const service = new OnchainPerpService({
      diamondAddress: diamondAddress as `0x${string}`,
      rpcUrl: getLocalRpcUrl(),
    });
    await service.getMarketIds();
    return true;
  } catch {
    return false;
  }
}

export function configureLocalChainEnvironment(): void {
  const localRpcUrl = resolveConfiguredLocalRpcUrl();

  setMissingEnv('DEPLOYMENT_ENV', 'localnet');
  setMissingEnv('NEXT_PUBLIC_CHAIN_ID', '31337');
  setMissingEnv('CHAIN_ID', '31337');
  setMissingEnv('NEXT_PUBLIC_RPC_URL', localRpcUrl);
  setMissingEnv('RPC_URL', localRpcUrl);
  setMissingEnv('LOCAL_RPC_URL', localRpcUrl);
  setMissingEnv('NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS', 'true');
  setMissingEnv('NEXT_PUBLIC_PERP_SETTLEMENT_MODE', 'onchain');
  setMissingEnv('PERP_SETTLEMENT_MODE', 'onchain');
  process.env.DEPLOYER_PRIVATE_KEY = DEFAULT_LOCAL_DEPLOYER_PRIVATE_KEY;
  process.env.ORACLE_PRIVATE_KEY = DEFAULT_LOCAL_ORACLE_PRIVATE_KEY;
  process.env.ORACLE_SIGNER = deriveAddressFromPrivateKey(
    DEFAULT_LOCAL_ORACLE_PRIVATE_KEY
  );
  if (!isValidOracleEncryptionKey(process.env.ORACLE_ENCRYPTION_KEY)) {
    process.env.ORACLE_ENCRYPTION_KEY = DEFAULT_LOCAL_ORACLE_ENCRYPTION_KEY;
  }
}

export function getLocalRpcUrl(): string {
  configureLocalChainEnvironment();
  return process.env.LOCAL_RPC_URL || DEFAULT_LOCAL_RPC_URL;
}

async function applyLocalDeploymentEnvironment(): Promise<void> {
  const {
    diamondAddress,
    oracleAddress,
    predictionAmmRouter,
    predictionOracleAdapter,
    mockUsdc,
  } = await readLocalDeploymentAddresses();

  if (!diamondAddress) {
    return;
  }

  process.env.NEXT_PUBLIC_DIAMOND_ADDRESS = diamondAddress;
  process.env.BABYLON_DIAMOND_ADDRESS = diamondAddress;
  if (oracleAddress) {
    process.env.NEXT_PUBLIC_BABYLON_ORACLE = oracleAddress;
    process.env.BABYLON_ORACLE = oracleAddress;
  }
  if (predictionAmmRouter) {
    process.env.NEXT_PUBLIC_PREDICTION_AMM_ROUTER = predictionAmmRouter;
    process.env.BABYLON_PREDICTION_AMM_ROUTER = predictionAmmRouter;
  }
  if (predictionOracleAdapter) {
    process.env.NEXT_PUBLIC_PREDICTION_ORACLE_ADAPTER = predictionOracleAdapter;
    process.env.BABYLON_PREDICTION_ORACLE_ADAPTER = predictionOracleAdapter;
  }
  if (mockUsdc) {
    process.env.NEXT_PUBLIC_MOCK_USDC = mockUsdc;
    process.env.PREDICTION_COLLATERAL_TOKEN = mockUsdc;
  }
}

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
export async function ensureLocalChainRunning(): Promise<boolean> {
  const blockNumber = await readLocalBlockNumber();
  const ready = typeof blockNumber === 'string' && blockNumber.startsWith('0x');

  if (!ready) {
    console.log(LOCAL_CHAIN_MISSING_MESSAGE);
    return false;
  }

  console.log('✅ Local chain RPC is running');
  return true;
}

export async function ensureHardhatRunning(): Promise<boolean> {
  return await ensureLocalChainRunning();
}

/**
 * Check if contracts are deployed on-chain
 */
export async function areContractsDeployed(): Promise<boolean> {
  configureLocalChainEnvironment();
  await applyLocalDeploymentEnvironment();
  const {
    oracleAddress,
    diamondAddress,
    predictionAmmRouter,
    predictionOracleAdapter,
  } = await readLocalDeploymentAddresses();

  if (
    !oracleAddress ||
    !diamondAddress ||
    !predictionAmmRouter ||
    !predictionOracleAdapter
  ) {
    return false;
  }

  try {
    const deployedContracts = await Promise.all(
      [oracleAddress, predictionAmmRouter, predictionOracleAdapter].map(
        (address) => isContractDeployed(getLocalRpcUrl(), address)
      )
    );
    const diamondReady = diamondAddress
      ? await isLocalOnchainPerpDiamondReady(diamondAddress)
      : false;

    return deployedContracts.every(Boolean) && diamondReady;
  } catch {
    return false;
  }
}

/**
 * Deploy contracts to localnet
 */
export async function deployContracts(): Promise<boolean> {
  try {
    configureLocalChainEnvironment();
    console.log('🔄 Bootstrapping local Anvil contracts and market state...');

    // Set environment variables for deployment
    process.env.ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'dummy';

    // Run the same full bootstrap path used by local development.
    await $`BABYLON_LOCAL_BOOTSTRAP_ONCE=1 bun run scripts/wait-for-local-chain-and-deploy.ts --once`.quiet();

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
  configureLocalChainEnvironment();
  // Step 1: Ensure the local chain is running
  const localChainRunning = await ensureLocalChainRunning();
  if (!localChainRunning) {
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

  await applyLocalDeploymentEnvironment();
  console.log('✅ Contracts are ready for testing');
  return true;
}
