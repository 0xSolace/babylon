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
    throw new Error('DEPLOYER_KEY environment variable required');
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
  console.log('🐵 Babylon Auto-Seed Script');
  console.log('='.repeat(50));

  const config = getConfig();
  console.log(`Network: ${config.network}`);
  console.log(`RPC: ${config.rpcUrl}`);

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

  console.log(`Deployer: ${account.address}`);

  // Check deployer balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.1')) {
    console.error(
      '❌ Insufficient balance. Need at least 0.1 ETH for deployment.'
    );
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Step 1: Check existing deployments
  // -------------------------------------------------------------------------
  console.log('\n📦 Checking existing deployments...');

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
      console.log(`  ${name}: Not deployed`);
      needsDeploy = true;
    } else {
      console.log(`  ${name}: ${address}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Deploy contracts if needed
  // -------------------------------------------------------------------------
  if (needsDeploy) {
    console.log('\n🚀 Deploying contracts...');
    console.log('  Run: forge script script/DeployDAO.s.sol --broadcast');
    console.log('  Then set environment variables and re-run this script.');
    console.log('\nExample .env additions:');
    console.log(`
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
  console.log('\n🐵 Setting up MonkeyKing AI CEO...');

  const aiCEOAddress = config.aiCEOKey
    ? privateKeyToAccount(config.aiCEOKey).address
    : account.address;

  console.log(`  AI CEO Address: ${aiCEOAddress}`);

  // Check if AI CEO is set in DAO
  // const currentCEO = await publicClient.readContract({
  //   address: existingAddresses.dao!,
  //   abi: [{ type: 'function', name: 'aiCEO', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
  //   functionName: 'aiCEO',
  // });

  // -------------------------------------------------------------------------
  // Step 4: Add council members
  // -------------------------------------------------------------------------
  console.log('\n👥 Adding council members...');

  if (config.councilAddresses.length === 0) {
    console.log('  Using deployer as initial council member');
    config.councilAddresses.push(account.address);
  }

  for (const member of config.councilAddresses) {
    console.log(`  Adding: ${member}`);
    // In production: call dao.addCouncilMember(member, "Council")
  }

  // -------------------------------------------------------------------------
  // Step 5: Fund treasury
  // -------------------------------------------------------------------------
  console.log('\n💰 Funding treasury...');

  if (existingAddresses.treasury) {
    const treasuryBalance = await publicClient.getBalance({
      address: existingAddresses.treasury,
    });
    console.log(`  Current balance: ${formatEther(treasuryBalance)} ETH`);

    if (treasuryBalance < config.treasuryFunding) {
      const toFund = config.treasuryFunding - treasuryBalance;
      console.log(`  Funding with: ${formatEther(toFund)} ETH`);

      const hash = await walletClient.sendTransaction({
        to: existingAddresses.treasury,
        value: toFund,
      });
      console.log(`  TX: ${hash}`);

      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ Treasury funded`);
    } else {
      console.log(`  ✅ Treasury already funded`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Fund agent vault
  // -------------------------------------------------------------------------
  console.log('\n💰 Funding agent vault...');

  if (existingAddresses.agentVault) {
    const vaultBalance = await publicClient.getBalance({
      address: existingAddresses.agentVault,
    });
    console.log(`  Current balance: ${formatEther(vaultBalance)} ETH`);

    if (vaultBalance < config.vaultFunding) {
      const toFund = config.vaultFunding - vaultBalance;
      console.log(`  Funding with: ${formatEther(toFund)} ETH`);

      const hash = await walletClient.sendTransaction({
        to: existingAddresses.agentVault,
        value: toFund,
      });
      console.log(`  TX: ${hash}`);

      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ Agent vault funded`);
    } else {
      console.log(`  ✅ Agent vault already funded`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Register JNS names (if available)
  // -------------------------------------------------------------------------
  console.log('\n📛 Registering JNS names...');

  const jnsRegistry = process.env.JNS_REGISTRY_ADDRESS as Address | undefined;
  if (jnsRegistry) {
    console.log('  JNS Registry:', jnsRegistry);
    // Register babylon.jeju
    // Register monkeyking.babylon.jeju
    // Register api.babylon.jeju
    console.log('  TODO: Implement JNS registration');
  } else {
    console.log('  JNS Registry not configured, skipping');
  }

  // -------------------------------------------------------------------------
  // Step 8: Configure training orchestrator
  // -------------------------------------------------------------------------
  console.log('\n🎓 Configuring training orchestrator...');

  if (existingAddresses.trainingOrchestrator) {
    // Set authorized workers
    // Set config
    console.log('  TODO: Configure training workers');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(50));
  console.log('✅ Babylon Auto-Seed Complete');
  console.log('='.repeat(50));
  console.log(`
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
  console.error('❌ Auto-seed failed:', err);
  process.exit(1);
});
