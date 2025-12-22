#!/usr/bin/env bun

/**
 * Deploy Hyperlane Warp Routes for BBLN Token
 *
 * Deploys our custom WarpRoute contracts to enable cross-chain transfers
 * between Base Sepolia and Sepolia testnets.
 *
 * Usage:
 *   bun run scripts/deploy-warp-routes.ts
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthenticationError, logger } from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatEther,
  type Hex,
  http,
  padHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, sepolia } from 'viem/chains';
import { deployContract } from '../src/deployer/contract-deployer';

// Load .env
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

// =============================================================================
// CONFIGURATION
// =============================================================================

// BBLN Token on Base Sepolia (already deployed)
const BBLN_BASE_SEPOLIA =
  '0x3586d05d61523c81d2d79c4e1132ffa1b3bcad5f' as Address;

// Hyperlane infrastructure
const HYPERLANE_CONFIG = {
  baseSepolia: {
    chainId: 84532,
    domainId: 84532,
    mailbox: '0x6966b0E55883d49BFB24539356a2f8A673E02039' as Address,
    igp: '0x28B02B97a850872C4D33C3E024fab6499ad96564' as Address,
    rpc: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
  },
  sepolia: {
    chainId: 11155111,
    domainId: 11155111,
    mailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766' as Address,
    igp: '0x6f2756380FD49228ae25Aa7F2817993cB74Ecc56' as Address,
    rpc:
      process.env.SEPOLIA_RPC_URL ??
      'https://ethereum-sepolia-rpc.publicnode.com',
  },
};

function addressToBytes32(address: Address): Hex {
  return padHex(address, { size: 32 });
}

// =============================================================================
// DEPLOYMENT
// =============================================================================

async function main() {
  logger.info('═'.repeat(60));
  logger.info('🚀 BBLN WARP ROUTE DEPLOYMENT');
  logger.info('═'.repeat(60));

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new AuthenticationError(
      'DEPLOYER_PRIVATE_KEY environment variable required',
      'NO_TOKEN'
    );
  }

  const account = privateKeyToAccount(privateKey as Hex);
  logger.info(`\n📍 Deployer: ${account.address}`);

  // Create clients for both chains
  const baseSepoliaPublic = createPublicClient({
    chain: baseSepolia,
    transport: http(HYPERLANE_CONFIG.baseSepolia.rpc),
  });
  const baseSepoliaWallet = createWalletClient({
    chain: baseSepolia,
    transport: http(HYPERLANE_CONFIG.baseSepolia.rpc),
    account,
  });

  const sepoliaPublic = createPublicClient({
    chain: sepolia,
    transport: http(HYPERLANE_CONFIG.sepolia.rpc),
  });
  const sepoliaWallet = createWalletClient({
    chain: sepolia,
    transport: http(HYPERLANE_CONFIG.sepolia.rpc),
    account,
  });

  // Check balances
  const baseBalance = await baseSepoliaPublic.getBalance({
    address: account.address,
  });
  const sepoliaBalance = await sepoliaPublic.getBalance({
    address: account.address,
  });

  logger.info(`\n💰 Base Sepolia Balance: ${formatEther(baseBalance)} ETH`);
  logger.info(`💰 Sepolia Balance: ${formatEther(sepoliaBalance)} ETH`);

  // ==========================================================================
  // Deploy Warp Route on Base Sepolia (Collateral mode)
  // ==========================================================================
  logger.info('\n' + '─'.repeat(60));
  logger.info('📦 Deploying WarpRoute on Base Sepolia (Collateral)...');

  const { address: warpRouteBaseSepolia, txHash: txBase } =
    await deployContract(baseSepoliaPublic, baseSepoliaWallet, 'WarpRoute', [
      HYPERLANE_CONFIG.baseSepolia.mailbox, // mailbox
      BBLN_BASE_SEPOLIA, // token
      true, // isCollateral
      account.address, // owner
    ]);

  logger.info(`   ✅ Base Sepolia WarpRoute: ${warpRouteBaseSepolia}`);
  logger.info(`   Tx: ${txBase}`);

  // ==========================================================================
  // Deploy BBLN Token on Sepolia (Synthetic)
  // Then deploy Warp Route
  // ==========================================================================
  logger.info('\n' + '─'.repeat(60));
  logger.info('📦 Deploying BBLN Token on Sepolia (Synthetic)...');

  const { address: bblnSepolia, txHash: txTokenSepolia } = await deployContract(
    sepoliaPublic,
    sepoliaWallet,
    'BabylonToken',
    [
      'Babylon', // name
      'BBLN', // symbol
      0n, // initial supply (synthetic - minted by warp route)
      account.address, // owner
      false, // isHomeChain (synthetic chain)
    ]
  );

  logger.info(`   ✅ Sepolia BBLN Token: ${bblnSepolia}`);
  logger.info(`   Tx: ${txTokenSepolia}`);

  logger.info('\n📦 Deploying WarpRoute on Sepolia (Synthetic)...');

  const { address: warpRouteSepolia, txHash: txWarpSepolia } =
    await deployContract(sepoliaPublic, sepoliaWallet, 'WarpRoute', [
      HYPERLANE_CONFIG.sepolia.mailbox, // mailbox
      bblnSepolia, // token
      false, // isCollateral (synthetic mode)
      account.address, // owner
    ]);

  logger.info(`   ✅ Sepolia WarpRoute: ${warpRouteSepolia}`);
  logger.info(`   Tx: ${txWarpSepolia}`);

  // ==========================================================================
  // Configure Warp Routes (enroll remote routers)
  // ==========================================================================
  logger.info('\n' + '─'.repeat(60));
  logger.info('🔧 Configuring Warp Routes...');

  // Enroll Sepolia router on Base Sepolia
  logger.info('   Enrolling Sepolia router on Base Sepolia...');
  const enrollBaseTx = await baseSepoliaWallet.writeContract({
    address: warpRouteBaseSepolia,
    abi: [
      {
        name: 'enrollRemoteRouter',
        type: 'function',
        inputs: [
          { name: '_domain', type: 'uint32' },
          { name: '_router', type: 'bytes32' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'enrollRemoteRouter',
    args: [
      HYPERLANE_CONFIG.sepolia.domainId,
      addressToBytes32(warpRouteSepolia),
    ],
  });
  await baseSepoliaPublic.waitForTransactionReceipt({ hash: enrollBaseTx });
  logger.info(`   ✅ Enrolled on Base Sepolia: ${enrollBaseTx}`);

  // Enroll Base Sepolia router on Sepolia
  logger.info('   Enrolling Base Sepolia router on Sepolia...');
  const enrollSepoliaTx = await sepoliaWallet.writeContract({
    address: warpRouteSepolia,
    abi: [
      {
        name: 'enrollRemoteRouter',
        type: 'function',
        inputs: [
          { name: '_domain', type: 'uint32' },
          { name: '_router', type: 'bytes32' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'enrollRemoteRouter',
    args: [
      HYPERLANE_CONFIG.baseSepolia.domainId,
      addressToBytes32(warpRouteBaseSepolia),
    ],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: enrollSepoliaTx });
  logger.info(`   ✅ Enrolled on Sepolia: ${enrollSepoliaTx}`);

  // Set IGP on both routes
  logger.info('   Setting IGP on Base Sepolia...');
  const igpBaseTx = await baseSepoliaWallet.writeContract({
    address: warpRouteBaseSepolia,
    abi: [
      {
        name: 'setInterchainGasPaymaster',
        type: 'function',
        inputs: [{ name: '_igp', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'setInterchainGasPaymaster',
    args: [HYPERLANE_CONFIG.baseSepolia.igp],
  });
  await baseSepoliaPublic.waitForTransactionReceipt({ hash: igpBaseTx });
  logger.info(`   ✅ IGP set on Base Sepolia: ${igpBaseTx}`);

  logger.info('   Setting IGP on Sepolia...');
  const igpSepoliaTx = await sepoliaWallet.writeContract({
    address: warpRouteSepolia,
    abi: [
      {
        name: 'setInterchainGasPaymaster',
        type: 'function',
        inputs: [{ name: '_igp', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'setInterchainGasPaymaster',
    args: [HYPERLANE_CONFIG.sepolia.igp],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: igpSepoliaTx });
  logger.info(`   ✅ IGP set on Sepolia: ${igpSepoliaTx}`);

  // ==========================================================================
  // Authorize WarpRoute as minter on Sepolia BBLN
  // ==========================================================================
  logger.info('\n' + '─'.repeat(60));
  logger.info('🔧 Authorizing WarpRoute as minter on Sepolia BBLN...');

  const setMinterTx = await sepoliaWallet.writeContract({
    address: bblnSepolia,
    abi: [
      {
        name: 'setMinter',
        type: 'function',
        inputs: [
          { name: 'minter', type: 'address' },
          { name: 'authorized', type: 'bool' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'setMinter',
    args: [warpRouteSepolia, true],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: setMinterTx });
  logger.info(`   ✅ WarpRoute authorized as minter: ${setMinterTx}`);

  // ==========================================================================
  // Summary
  // ==========================================================================
  const deployment = {
    timestamp: new Date().toISOString(),
    deployer: account.address,
    baseSepolia: {
      chainId: HYPERLANE_CONFIG.baseSepolia.chainId,
      domainId: HYPERLANE_CONFIG.baseSepolia.domainId,
      token: BBLN_BASE_SEPOLIA,
      warpRoute: warpRouteBaseSepolia,
      type: 'collateral',
    },
    sepolia: {
      chainId: HYPERLANE_CONFIG.sepolia.chainId,
      domainId: HYPERLANE_CONFIG.sepolia.domainId,
      token: bblnSepolia,
      warpRoute: warpRouteSepolia,
      type: 'synthetic',
    },
  };

  // Save deployment
  const deploymentPath = resolve(
    import.meta.dir,
    `../deployments/warp-routes-${Date.now()}.json`
  );
  await Bun.write(deploymentPath, JSON.stringify(deployment, null, 2));

  logger.info('\n' + '═'.repeat(60));
  logger.info('✅ WARP ROUTE DEPLOYMENT COMPLETE');
  logger.info('═'.repeat(60));
  logger.info(`
📋 Deployment Summary:

Base Sepolia (Collateral):
  Token: ${BBLN_BASE_SEPOLIA}
  WarpRoute: ${warpRouteBaseSepolia}
  Domain ID: ${HYPERLANE_CONFIG.baseSepolia.domainId}

Sepolia (Synthetic):
  Token: ${bblnSepolia}
  WarpRoute: ${warpRouteSepolia}
  Domain ID: ${HYPERLANE_CONFIG.sepolia.domainId}

Deployment saved: ${deploymentPath}

🔄 To test cross-chain transfer:
  1. Approve BBLN to WarpRoute on Base Sepolia
  2. Call transferRemote(${HYPERLANE_CONFIG.sepolia.domainId}, <recipient_bytes32>, <amount>)
  3. Wait for Hyperlane relayer to deliver message
  4. Check BBLN balance on Sepolia
`);
}

main().catch((error) => {
  logger.error('\n❌ Deployment failed:', error);
  process.exit(1);
});
