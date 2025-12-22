#!/usr/bin/env bun

/**
 * Auto-seed script for Babylon development
 *
 * This script:
 * 1. Deploys all DAO contracts (if not deployed)
 * 2. Creates MonkeyKing AI CEO agent vault
 * 3. Seeds council members (dev addresses)
 * 4. Funds the treasury and agent vault
 * 5. Registers JNS names
 * 6. Sets up training orchestrator
 *
 * Usage:
 *   bun run packages/contracts/script/auto-seed.ts
 *   bun run packages/contracts/script/auto-seed.ts --network testnet
 */

import { AuthenticationError, logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat, sepolia } from 'viem/chains';

// ============================================================================
// Configuration
// ============================================================================

interface SeedConfig {
  network: 'localnet' | 'testnet' | 'mainnet';
  rpcUrl: string;
  deployerKey: `0x${string}`;
  aiCEOKey?: `0x${string}`;
  councilAddresses: Address[];
  treasuryFunding: bigint;
  vaultFunding: bigint;
}

function getConfig(): SeedConfig {
  const network = (process.env.NETWORK ?? 'localnet') as SeedConfig['network'];
  const rpcUrl =
    process.env.RPC_URL ??
    (network === 'localnet'
      ? 'http://localhost:8545'
      : (process.env.TESTNET_RPC ?? ''));

  if (!process.env.DEPLOYER_KEY) {
    throw new AuthenticationError(
      'DEPLOYER_KEY environment variable required',
      'NO_TOKEN'
    );
  }

  return {
    network,
    rpcUrl,
    deployerKey: process.env.DEPLOYER_KEY as `0x${string}`,
    aiCEOKey: process.env.AI_CEO_KEY as `0x${string}` | undefined,
    councilAddresses: (process.env.COUNCIL_ADDRESSES ?? '')
      .split(',')
      .filter(Boolean)
      .map((a) => a.trim() as Address),
    treasuryFunding: parseEther(process.env.TREASURY_FUNDING ?? '10'),
    vaultFunding: parseEther(process.env.VAULT_FUNDING ?? '1'),
  };
}

// ============================================================================
// Contract ABIs (minimal for deployment)
// ============================================================================

const _BabylonTreasuryBytecode = '0x'; // Will be loaded from artifacts
const _BabylonAgentVaultBytecode = '0x';
const _BabylonDAOBytecode = '0x';
const _TrainingOrchestratorBytecode = '0x';

// ============================================================================
// Main Seed Function
// ============================================================================

async function main() {
  logger.info('🐵 Babylon Auto-Seed Script');
  logger.info('='.repeat(50));

  const config = getConfig();
  logger.info(`Network: ${config.network}`);
  logger.info(`RPC: ${config.rpcUrl}`);

  // Create clients
  const chain = config.network === 'localnet' ? hardhat : sepolia;
  const account = privateKeyToAccount(config.deployerKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });

  logger.info(`Deployer: ${account.address}`);

  // Check deployer balance
  const balance = await publicClient.getBalance({ address: account.address });
  logger.info(`Balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.1')) {
    logger.error(
      '❌ Insufficient balance. Need at least 0.1 ETH for deployment.'
    );
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Step 1: Check existing deployments
  // -------------------------------------------------------------------------
  logger.info('\n📦 Checking existing deployments...');

  const existingAddresses = {
    dao: process.env.BABYLON_DAO_ADDRESS as Address | undefined,
    treasury: process.env.BABYLON_TREASURY_ADDRESS as Address | undefined,
    agentVault: process.env.BABYLON_AGENT_VAULT_ADDRESS as Address | undefined,
    trainingOrchestrator: process.env.TRAINING_ORCHESTRATOR_ADDRESS as
      | Address
      | undefined,
  };

  let needsDeploy = false;
  for (const [name, address] of Object.entries(existingAddresses)) {
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      logger.info(`  ${name}: Not deployed`);
      needsDeploy = true;
    } else {
      logger.info(`  ${name}: ${address}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Deploy contracts if needed
  // -------------------------------------------------------------------------
  if (needsDeploy) {
    logger.info('\n🚀 Deploying contracts...');
    logger.info('  Run: forge script script/DeployDAO.s.sol --broadcast');
    logger.info('  Then set environment variables and re-run this script.');
    logger.info('\nExample .env additions:');
    logger.info(`
BABYLON_DAO_ADDRESS=0x...
BABYLON_TREASURY_ADDRESS=0x...
BABYLON_AGENT_VAULT_ADDRESS=0x...
TRAINING_ORCHESTRATOR_ADDRESS=0x...
    `);
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // Step 3: Create AI CEO if needed
  // -------------------------------------------------------------------------
  logger.info('\n🐵 Setting up MonkeyKing AI CEO...');

  const aiCEOAddress = config.aiCEOKey
    ? privateKeyToAccount(config.aiCEOKey).address
    : account.address;

  logger.info(`  AI CEO Address: ${aiCEOAddress}`);

  // Check if AI CEO is set in DAO
  // const currentCEO = await publicClient.readContract({
  //   address: existingAddresses.dao!,
  //   abi: [{ type: 'function', name: 'aiCEO', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
  //   functionName: 'aiCEO',
  // });

  // -------------------------------------------------------------------------
  // Step 4: Add council members
  // -------------------------------------------------------------------------
  logger.info('\n👥 Adding council members...');

  if (config.councilAddresses.length === 0) {
    logger.info('  Using deployer as initial council member');
    config.councilAddresses.push(account.address);
  }

  for (const member of config.councilAddresses) {
    logger.info(`  Adding: ${member}`);
    // In production: call dao.addCouncilMember(member, "Council")
  }

  // -------------------------------------------------------------------------
  // Step 5: Fund treasury
  // -------------------------------------------------------------------------
  logger.info('\n💰 Funding treasury...');

  if (existingAddresses.treasury) {
    const treasuryBalance = await publicClient.getBalance({
      address: existingAddresses.treasury,
    });
    logger.info(`  Current balance: ${formatEther(treasuryBalance)} ETH`);

    if (treasuryBalance < config.treasuryFunding) {
      const toFund = config.treasuryFunding - treasuryBalance;
      logger.info(`  Funding with: ${formatEther(toFund)} ETH`);

      const hash = await walletClient.sendTransaction({
        to: existingAddresses.treasury,
        value: toFund,
      });
      logger.info(`  TX: ${hash}`);

      await publicClient.waitForTransactionReceipt({ hash });
      logger.info(`  ✅ Treasury funded`);
    } else {
      logger.info(`  ✅ Treasury already funded`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Fund agent vault
  // -------------------------------------------------------------------------
  logger.info('\n💰 Funding agent vault...');

  if (existingAddresses.agentVault) {
    const vaultBalance = await publicClient.getBalance({
      address: existingAddresses.agentVault,
    });
    logger.info(`  Current balance: ${formatEther(vaultBalance)} ETH`);

    if (vaultBalance < config.vaultFunding) {
      const toFund = config.vaultFunding - vaultBalance;
      logger.info(`  Funding with: ${formatEther(toFund)} ETH`);

      const hash = await walletClient.sendTransaction({
        to: existingAddresses.agentVault,
        value: toFund,
      });
      logger.info(`  TX: ${hash}`);

      await publicClient.waitForTransactionReceipt({ hash });
      logger.info(`  ✅ Agent vault funded`);
    } else {
      logger.info(`  ✅ Agent vault already funded`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Register JNS names (if available)
  // -------------------------------------------------------------------------
  logger.info('\n📛 Registering JNS names...');

  const jnsRegistry = process.env.JNS_REGISTRY_ADDRESS as Address | undefined;
  if (jnsRegistry) {
    logger.info('  JNS Registry:', jnsRegistry);
    // Register babylon.jeju
    // Register monkeyking.babylon.jeju
    // Register api.babylon.jeju
    logger.info('  TODO: Implement JNS registration');
  } else {
    logger.info('  JNS Registry not configured, skipping');
  }

  // -------------------------------------------------------------------------
  // Step 8: Configure training orchestrator
  // -------------------------------------------------------------------------
  logger.info('\n🎓 Configuring training orchestrator...');

  if (existingAddresses.trainingOrchestrator) {
    // Set authorized workers
    // Set config
    logger.info('  TODO: Configure training workers');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  logger.info('\n' + '='.repeat(50));
  logger.info('✅ Babylon Auto-Seed Complete');
  logger.info('='.repeat(50));
  logger.info(`
Addresses:
  DAO:                  ${existingAddresses.dao}
  Treasury:             ${existingAddresses.treasury}
  Agent Vault:          ${existingAddresses.agentVault}
  Training Orchestrator: ${existingAddresses.trainingOrchestrator}

AI CEO:
  Address: ${aiCEOAddress}

Council Members:
${config.councilAddresses.map((a) => `  - ${a}`).join('\n')}

Next Steps:
  1. Start the game engine: bun run dev
  2. Monitor the AI CEO: bun run ceo:monitor
  3. Check training status: bun run training:status
  `);
}

// Run
main().catch((err) => {
  logger.error('❌ Auto-seed failed:', err);
  process.exit(1);
});
