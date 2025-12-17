/**
 * Wallet setup for Synpress MetaMask tests
 *
 * This file defines how MetaMask should be configured before running tests.
 * Uses the default Anvil test wallet (Account #0) which is admin in localnet.
 *
 * Supports both Jeju networks (when running inside Jeju) and Anvil (standalone).
 *
 * @see https://docs.synpress.io/docs/playwright/metamask/setup
 */

import { defineWalletSetup } from '@synthetixio/synpress-cache';
import { MetaMask } from '@synthetixio/synpress-metamask/playwright';

/**
 * Default Anvil test wallet configuration
 * Account #0 from 'test test test test test test test test test test test junk'
 */
export const ANVIL_WALLET = {
  seedPhrase: 'test test test test test test test test test test test junk',
  password: 'Tester@1234',
} as const;

/**
 * Network configurations
 */
export const NETWORKS = {
  // Standalone mode: Anvil local network
  anvil: {
    name: 'Anvil Local',
    rpcUrl: 'http://localhost:8545',
    chainId: 31337,
    symbol: 'ETH',
  },
  // Jeju Localnet
  jejuLocalnet: {
    name: 'Jeju Localnet',
    rpcUrl: 'http://127.0.0.1:9545',
    chainId: 1337,
    symbol: 'ETH',
  },
  // Jeju Testnet
  jejuTestnet: {
    name: 'Jeju Testnet',
    rpcUrl: 'https://testnet-rpc.jeju.network',
    chainId: 420690,
    symbol: 'ETH',
  },
  // Jeju Mainnet
  jejuMainnet: {
    name: 'Jeju',
    rpcUrl: 'https://rpc.jeju.network',
    chainId: 420691,
    symbol: 'ETH',
  },
} as const;

// Legacy export for backward compatibility
export const ANVIL_NETWORK = NETWORKS.anvil;

/**
 * Determine which network to use based on environment
 */
function getTargetNetwork() {
  const jejuNetwork =
    process.env.JEJU_NETWORK || process.env.NEXT_PUBLIC_JEJU_NETWORK;

  if (jejuNetwork === 'localnet') return NETWORKS.jejuLocalnet;
  if (jejuNetwork === 'testnet') return NETWORKS.jejuTestnet;
  if (jejuNetwork === 'mainnet') return NETWORKS.jejuMainnet;

  // Check if chain ID is specified
  const chainId = Number(
    process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 0
  );
  if (chainId === 1337) return NETWORKS.jejuLocalnet;
  if (chainId === 420690) return NETWORKS.jejuTestnet;
  if (chainId === 420691) return NETWORKS.jejuMainnet;

  // Default to Anvil for standalone mode
  return NETWORKS.anvil;
}

/**
 * Define wallet setup for MetaMask
 *
 * This is run once per worker and cached for reuse.
 * The setup imports the seed phrase and configures the appropriate network.
 */
export default defineWalletSetup(
  ANVIL_WALLET.password,
  async (context, walletPage) => {
    const metamask = new MetaMask(context, walletPage, ANVIL_WALLET.password);

    // Import the test seed phrase
    await metamask.importWallet(ANVIL_WALLET.seedPhrase);

    // Add the target network for testing
    const targetNetwork = getTargetNetwork();
    await metamask.addNetwork(targetNetwork);
  }
);
