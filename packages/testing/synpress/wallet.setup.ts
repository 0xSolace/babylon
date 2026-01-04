/**
 * Wallet setup for Synpress MetaMask tests
 *
 * This file uses the canonical Jeju wallet setup from @jejunetwork/tests.
 * The Jeju setup provides consistent configuration across all Jeju Network apps.
 *
 * For Babylon-specific network configurations (testnet/mainnet URLs),
 * see the BABYLON_NETWORKS export which can be used for overrides.
 *
 * @see https://docs.synpress.io/docs/playwright/metamask/setup
 */

import { JEJU_CHAIN, PASSWORD, SEED_PHRASE } from '@jejunetwork/tests'
import { defineWalletSetup } from '@synthetixio/synpress-cache'
import { MetaMask } from '@synthetixio/synpress-metamask/playwright'

/**
 * Babylon-specific network configurations
 *
 * These extend the Jeju network configurations with Babylon-specific URLs.
 * The core network (localnet) uses Jeju's canonical configuration.
 */
export const BABYLON_NETWORKS = {
  // Standalone mode: Anvil local network (for isolated testing)
  anvil: {
    name: 'Anvil Local',
    rpcUrl: `http://localhost:${process.env.ANVIL_RPC_PORT ?? '6545'}`,
    chainId: 31337,
    symbol: 'ETH',
  },
  // Jeju Localnet - use canonical Jeju configuration
  jejuLocalnet: JEJU_CHAIN,
  // Jeju Testnet
  jejuTestnet: {
    name: 'Jeju Testnet',
    rpcUrl: 'https://testnet-rpc.jejunetwork.org',
    chainId: 420690,
    symbol: 'ETH',
  },
  // Jeju Mainnet
  jejuMainnet: {
    name: 'Jeju',
    rpcUrl: 'https://rpc.jejunetwork.org',
    chainId: 420691,
    symbol: 'ETH',
  },
} as const

// Legacy exports for backward compatibility
export const ANVIL_WALLET = {
  seedPhrase: SEED_PHRASE,
  password: PASSWORD,
} as const

export const NETWORKS = BABYLON_NETWORKS
export const ANVIL_NETWORK = BABYLON_NETWORKS.anvil

/**
 * Determine which network to use based on environment
 */
function getTargetNetwork(): (typeof BABYLON_NETWORKS)[keyof typeof BABYLON_NETWORKS] {
  const jejuNetwork =
    process.env.JEJU_NETWORK || process.env.PUBLIC_JEJU_NETWORK

  if (jejuNetwork === 'localnet') return BABYLON_NETWORKS.jejuLocalnet
  if (jejuNetwork === 'testnet') return BABYLON_NETWORKS.jejuTestnet
  if (jejuNetwork === 'mainnet') return BABYLON_NETWORKS.jejuMainnet

  // Check if chain ID is specified
  const chainId = Number(
    process.env.CHAIN_ID || process.env.PUBLIC_CHAIN_ID || 0,
  )
  if (chainId === 31337) return BABYLON_NETWORKS.jejuLocalnet
  if (chainId === 420690) return BABYLON_NETWORKS.jejuTestnet
  if (chainId === 420691) return BABYLON_NETWORKS.jejuMainnet

  // Default to Jeju Localnet (preferred for integrated testing)
  return BABYLON_NETWORKS.jejuLocalnet
}

/**
 * Define wallet setup for MetaMask
 *
 * This is run once per worker and cached for reuse.
 * Uses the canonical Jeju test wallet and network configuration.
 */
export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD)

  // Import the canonical Jeju test seed phrase
  console.log('[Babylon Wallet Setup] Importing wallet...')
  await metamask.importWallet(SEED_PHRASE)

  // Add the target network for testing
  const targetNetwork = getTargetNetwork()
  console.log(`[Babylon Wallet Setup] Adding network: ${targetNetwork.name}`)
  await metamask.addNetwork(targetNetwork)

  console.log('[Babylon Wallet Setup] Complete')
})
