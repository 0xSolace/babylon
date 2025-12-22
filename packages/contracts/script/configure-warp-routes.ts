#!/usr/bin/env bun

/**
 * Configure Deployed Warp Routes
 *
 * Completes configuration for already deployed warp routes
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPublicClient, createWalletClient, type Hex, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

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

import { DEPLOYED_NETWORKS } from '../src/config/networks';

// =============================================================================
// DEPLOYED CONTRACTS (using consolidated config)
// =============================================================================

const DEPLOYED = {
  baseSepolia: DEPLOYED_NETWORKS.baseSepolia,
  sepolia: DEPLOYED_NETWORKS.sepolia,
};

const WARP_ABI = [
  {
    name: 'setInterchainGasPaymaster',
    type: 'function',
    inputs: [{ name: '_igp', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const TOKEN_ABI = [
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
] as const;

async function main() {
  console.log('═'.repeat(60));
  console.log('🔧 CONFIGURING WARP ROUTES');
  console.log('═'.repeat(60));

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY required');
  }

  const account = privateKeyToAccount(privateKey as Hex);
  console.log(`\n📍 Deployer: ${account.address}`);

  // Sepolia client
  const sepoliaPublic = createPublicClient({
    chain: sepolia,
    transport: http(DEPLOYED.sepolia.rpc),
  });
  const sepoliaWallet = createWalletClient({
    chain: sepolia,
    transport: http(DEPLOYED.sepolia.rpc),
    account,
  });

  // Set IGP on Sepolia WarpRoute
  console.log('\n📦 Setting IGP on Sepolia WarpRoute...');
  const igpTx = await sepoliaWallet.writeContract({
    address: DEPLOYED.sepolia.warpRoute,
    abi: WARP_ABI,
    functionName: 'setInterchainGasPaymaster',
    args: [DEPLOYED.sepolia.igp],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: igpTx });
  console.log(`   ✅ IGP set: ${igpTx}`);

  // Authorize WarpRoute as minter
  console.log('\n📦 Authorizing WarpRoute as minter on Sepolia BBLN...');
  const minterTx = await sepoliaWallet.writeContract({
    address: DEPLOYED.sepolia.token,
    abi: TOKEN_ABI,
    functionName: 'setMinter',
    args: [DEPLOYED.sepolia.warpRoute, true],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: minterTx });
  console.log(`   ✅ WarpRoute authorized as minter: ${minterTx}`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ CONFIGURATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`
📋 Deployed Contracts:

Base Sepolia (Collateral):
  Token: ${DEPLOYED.baseSepolia.token}
  WarpRoute: ${DEPLOYED.baseSepolia.warpRoute}

Sepolia (Synthetic):
  Token: ${DEPLOYED.sepolia.token}
  WarpRoute: ${DEPLOYED.sepolia.warpRoute}
`);
}

main().catch((error) => {
  console.error('\n❌ Configuration failed:', error);
  process.exit(1);
});
