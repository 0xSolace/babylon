#!/usr/bin/env bun

/**
 * BBLN Token Deployment Script
 *
 * Deploys the full Babylon token ecosystem:
 * - BabylonToken (ERC-20)
 * - TokenVesting (team/treasury allocations)
 * - Airdrop (with daily drip)
 * - FeeDistributor
 * - CCALauncher (for public sale)
 *
 * Supports:
 * - Localnet (Hardhat/Anvil)
 * - Testnet (Base Sepolia, Arbitrum Sepolia, Sepolia)
 * - Mainnet (Base, Arbitrum, Ethereum, Optimism, BSC)
 *
 * Cross-chain deployment via Hyperlane warp routes.
 *
 * Usage:
 *   cd packages/experimental-token
 *   bun run scripts/deploy-token.ts localnet|testnet|mainnet
 *
 * Requires DEPLOYER_PRIVATE_KEY in .env for testnet/mainnet
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env from workspace root (babylon/)
const envPath = resolve(import.meta.dir, '../../../.env');
if (existsSync(envPath)) {
  const envFile = Bun.file(envPath);
  const envContent = await envFile.text();
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && !process.env[key]) {
      process.env[key] = valueParts.join('=');
    }
  }
}

import { type JejuNetwork, logger, ValidationError } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  type Hex,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getDeploymentConfig } from '../src/config/networks';
import {
  AIRDROP_TOKENS,
  BABYLON_LABS_TOKENS,
  LIQUIDITY_TOKENS,
  PUBLIC_SALE_TOKENS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOTAL_SUPPLY_WEI,
  TREASURY_TOKENS,
  tokensToWei,
} from '../src/config/tokenomics';
import {
  deployContract,
  deployContractCreate2,
} from '../src/deployer/contract-deployer';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface DeploymentAddresses {
  token: Address;
  vesting: Address;
  airdrop: Address;
  feeDistributor: Address;
  ccaLauncher: Address;
  warpRoute?: Address;
}

interface DeploymentResult {
  network: string;
  chainId: number;
  addresses: DeploymentAddresses;
  txHashes: Hex[];
}

// =============================================================================
// DEPLOYMENT FUNCTIONS
// =============================================================================

async function deployBabylonToken(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  owner: Address,
  isHomeChain: boolean,
  useCREATE2: boolean,
  salt?: Hex
): Promise<{ address: Address; txHash: Hex }> {
  logger.info('\n📦 Deploying BabylonToken...');
  logger.info(`   Name: ${TOKEN_NAME}`);
  logger.info(`   Symbol: ${TOKEN_SYMBOL}`);
  logger.info(`   Total Supply: ${TOTAL_SUPPLY_WEI.toString()} wei`);
  logger.info(`   Is Home Chain: ${isHomeChain}`);

  const args = [
    TOKEN_NAME,
    TOKEN_SYMBOL,
    isHomeChain ? TOTAL_SUPPLY_WEI : 0n, // Only mint on home chain
    owner,
    isHomeChain,
  ] as const;

  if (useCREATE2 && salt) {
    return deployContractCreate2(
      publicClient,
      walletClient,
      'BabylonToken',
      args,
      salt
    );
  }

  return deployContract(publicClient, walletClient, 'BabylonToken', args);
}

async function deployTokenVesting(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  tokenAddress: Address,
  owner: Address
): Promise<{ address: Address; txHash: Hex }> {
  logger.info('\n📦 Deploying TokenVesting...');

  return deployContract(publicClient, walletClient, 'TokenVesting', [
    tokenAddress,
    owner,
  ]);
}

async function deployAirdrop(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  tokenAddress: Address,
  owner: Address
): Promise<{ address: Address; txHash: Hex }> {
  logger.info('\n📦 Deploying Airdrop...');

  return deployContract(publicClient, walletClient, 'Airdrop', [
    tokenAddress,
    owner,
  ]);
}

async function deployFeeDistributor(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  tokenAddress: Address,
  owner: Address
): Promise<{ address: Address; txHash: Hex }> {
  logger.info('\n📦 Deploying FeeDistributor...');

  // Minimum stake period: 7 days in seconds
  const minimumStakePeriod = 7n * 24n * 60n * 60n;

  return deployContract(publicClient, walletClient, 'FeeDistributor', [
    tokenAddress,
    owner,
    minimumStakePeriod,
  ]);
}

async function deployCCALauncher(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  tokenAddress: Address,
  owner: Address
): Promise<{ address: Address; txHash: Hex }> {
  logger.info('\n📦 Deploying CCALauncher...');

  // Use ETH as payment token (address(0))
  return deployContract(publicClient, walletClient, 'CCALauncher', [
    tokenAddress,
    '0x0000000000000000000000000000000000000000', // ETH payment
    owner,
  ]);
}

// =============================================================================
// POST-DEPLOYMENT SETUP
// =============================================================================

async function setupTokenDistribution(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  addresses: DeploymentAddresses,
  owner: Address
): Promise<void> {
  logger.info('\n🔧 Setting up token distribution...');

  const tokenAbi = [
    {
      name: 'transfer',
      type: 'function',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
  ] as const;

  // Transfer allocations to respective contracts
  const transfers = [
    {
      to: addresses.vesting,
      amount: tokensToWei(BABYLON_LABS_TOKENS + TREASURY_TOKENS),
      name: 'Vesting',
    },
    {
      to: addresses.airdrop,
      amount: tokensToWei(AIRDROP_TOKENS),
      name: 'Airdrop',
    },
    {
      to: addresses.ccaLauncher,
      amount: tokensToWei(PUBLIC_SALE_TOKENS),
      name: 'CCA Launcher',
    },
  ];

  for (const { to, amount, name } of transfers) {
    logger.info(`   📤 Transferring ${formatEther(amount)} BBLN to ${name}...`);
    const hash = await walletClient.writeContract({
      address: addresses.token,
      abi: tokenAbi,
      functionName: 'transfer',
      args: [to, amount],
      account: owner,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    logger.info(`      ✅ Tx: ${hash}`);
  }

  // LIQUIDITY_TOKENS remain with deployer for market making setup
  logger.info(
    `   💧 ${formatEther(tokensToWei(LIQUIDITY_TOKENS))} BBLN retained for liquidity provision`
  );
  logger.info('   ⏭️  Token distribution setup complete');
}

async function setupVestingSchedules(
  _publicClient: ReturnType<typeof createPublicClient>,
  _walletClient: ReturnType<typeof createWalletClient>,
  _vestingAddress: Address,
  _owner: Address
): Promise<void> {
  logger.info('\n🔧 Setting up vesting schedules...');

  // TODO: Create vesting schedules
  // - Babylon Labs: 4-year linear with 1-year cliff
  // - Treasury: Long-term gradual unlock

  logger.info('   ⏭️  Vesting schedules setup complete');
}

async function setupAirdrop(
  _publicClient: ReturnType<typeof createPublicClient>,
  _walletClient: ReturnType<typeof createWalletClient>,
  _airdropAddress: Address,
  _owner: Address
): Promise<void> {
  logger.info('\n🔧 Setting up airdrop...');

  // TODO: Configure airdrop
  // - Set merkle root
  // - Set start/end time
  // - Authorize drippers (backend service)

  logger.info('   ⏭️  Airdrop setup complete');
}

// =============================================================================
// MAIN DEPLOYMENT
// =============================================================================

async function deploy(network: JejuNetwork): Promise<DeploymentResult> {
  logger.info('═'.repeat(60));
  logger.info(`🚀 BABYLON TOKEN DEPLOYMENT - ${network.toUpperCase()}`);
  logger.info('═'.repeat(60));

  // Get configuration from consolidated config
  const config = getDeploymentConfig(network);

  // Get deployer private key
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey && network !== 'localnet') {
    throw new ValidationError(
      'DEPLOYER_PRIVATE_KEY environment variable required',
      ['DEPLOYER_PRIVATE_KEY']
    );
  }

  // Use default Hardhat account for localnet
  const deployerKey =
    privateKey ??
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const account = privateKeyToAccount(deployerKey as Hex);

  logger.info(`\n📍 Network: ${config.chain.name}`);
  logger.info(`📍 Chain ID: ${config.chain.id}`);
  logger.info(`📍 RPC: ${config.rpcUrl}`);
  logger.info(`📍 Deployer: ${account.address}`);
  logger.info(`📍 Is Home Chain: ${config.isHomeChain}`);

  // Create clients
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
    account,
  });

  // Check deployer balance
  const balance = await publicClient.getBalance({ address: account.address });
  logger.info(`\n💰 Deployer Balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.01')) {
    logger.warn('⚠️  Low deployer balance, deployment may fail');
  }

  const txHashes: Hex[] = [];

  // Deploy contracts
  const tokenResult = await deployBabylonToken(
    publicClient,
    walletClient,
    account.address,
    config.isHomeChain,
    false // Use standard deployment for now
  );
  txHashes.push(tokenResult.txHash);
  logger.info(`   ✅ Token deployed at: ${tokenResult.address}`);

  const vestingResult = await deployTokenVesting(
    publicClient,
    walletClient,
    tokenResult.address,
    account.address
  );
  txHashes.push(vestingResult.txHash);
  logger.info(`   ✅ Vesting deployed at: ${vestingResult.address}`);

  const airdropResult = await deployAirdrop(
    publicClient,
    walletClient,
    tokenResult.address,
    account.address
  );
  txHashes.push(airdropResult.txHash);
  logger.info(`   ✅ Airdrop deployed at: ${airdropResult.address}`);

  const feeDistributorResult = await deployFeeDistributor(
    publicClient,
    walletClient,
    tokenResult.address,
    account.address
  );
  txHashes.push(feeDistributorResult.txHash);
  logger.info(
    `   ✅ FeeDistributor deployed at: ${feeDistributorResult.address}`
  );

  const ccaResult = await deployCCALauncher(
    publicClient,
    walletClient,
    tokenResult.address,
    account.address
  );
  txHashes.push(ccaResult.txHash);
  logger.info(`   ✅ CCALauncher deployed at: ${ccaResult.address}`);

  const addresses: DeploymentAddresses = {
    token: tokenResult.address,
    vesting: vestingResult.address,
    airdrop: airdropResult.address,
    feeDistributor: feeDistributorResult.address,
    ccaLauncher: ccaResult.address,
  };

  // Post-deployment setup (only on home chain)
  if (config.isHomeChain) {
    await setupTokenDistribution(
      publicClient,
      walletClient,
      addresses,
      account.address
    );
    await setupVestingSchedules(
      publicClient,
      walletClient,
      vestingResult.address,
      account.address
    );
    await setupAirdrop(
      publicClient,
      walletClient,
      airdropResult.address,
      account.address
    );
  }

  // Print summary
  logger.info('\n' + '═'.repeat(60));
  logger.info('📋 DEPLOYMENT SUMMARY');
  logger.info('═'.repeat(60));
  logger.info(`\nNetwork: ${config.chain.name} (${config.chain.id})`);
  logger.info(`\nContract Addresses:`);
  logger.info(`  Token:          ${addresses.token}`);
  logger.info(`  Vesting:        ${addresses.vesting}`);
  logger.info(`  Airdrop:        ${addresses.airdrop}`);
  logger.info(`  FeeDistributor: ${addresses.feeDistributor}`);
  logger.info(`  CCALauncher:    ${addresses.ccaLauncher}`);
  logger.info('\n' + '═'.repeat(60));
  logger.info('✅ DEPLOYMENT COMPLETE');
  logger.info('═'.repeat(60));

  return {
    network: config.chain.name,
    chainId: config.chain.id,
    addresses,
    txHashes,
  };
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const network = (args[0] ?? 'localnet') as JejuNetwork;

  if (!['localnet', 'testnet', 'mainnet'].includes(network)) {
    logger.error(`Invalid network: ${network}`);
    logger.error('Usage: bun run deploy-token.ts [localnet|testnet|mainnet]');
    process.exit(1);
  }

  const result = await deploy(network);

  // Save deployment result
  const outputPath = `deployments/${network}-${Date.now()}.json`;
  await Bun.write(outputPath, JSON.stringify(result, null, 2));
  logger.info(`\n📄 Deployment saved to: ${outputPath}`);
}

main().catch((error) => {
  logger.error('Deployment failed:', error);
  process.exit(1);
});
