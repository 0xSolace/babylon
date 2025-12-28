/**
 * BBLN Token Configuration
 *
 * This module provides the BBLN token contract addresses and configuration
 * for integration with the Jeju Network's cross-chain token infrastructure.
 */

import type { Address } from 'viem'

// ============================================================================
// BBLN Token Addresses
// ============================================================================

export interface BBLNContractAddresses {
  token: Address
  presale: Address
  xlpRewardPool: Address
}

/**
 * BBLN contract addresses by network
 */
export const BBLN_ADDRESSES = {
  // Ethereum Mainnet (home chain)
  mainnet: {
    token: '0x0000000000000000000000000000000000000000' as Address,
    presale: '0x0000000000000000000000000000000000000000' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },

  // Sepolia Testnet (home chain for testing)
  sepolia: {
    token: '0x9Ce2E3C01faC7092E60Fdd5147D105b6e3caA391' as Address,
    presale: '0xb8C17f655abAc75c5D4ACE2399630FEc8eEBE87c' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },

  // Base (synthetic)
  base: {
    token: '0x0000000000000000000000000000000000000000' as Address,
    presale: '0x0000000000000000000000000000000000000000' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },

  // Base Sepolia (synthetic testnet)
  baseSepolia: {
    token: '0x0000000000000000000000000000000000000000' as Address,
    presale: '0x0000000000000000000000000000000000000000' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },

  // Arbitrum (synthetic)
  arbitrum: {
    token: '0x0000000000000000000000000000000000000000' as Address,
    presale: '0x0000000000000000000000000000000000000000' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },

  // Jeju Testnet (synthetic)
  jejuTestnet: {
    token: '0x0000000000000000000000000000000000000000' as Address,
    presale: '0x0000000000000000000000000000000000000000' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },

  // Hardhat Local (for development)
  hardhat: {
    token: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
    presale: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as Address,
    xlpRewardPool: '0x0000000000000000000000000000000000000000' as Address,
  },
} as const

// ============================================================================
// BBLN Token Metadata
// ============================================================================

export const BBLN_TOKEN = {
  name: 'Babylon',
  symbol: 'BBLN',
  decimals: 18,
  totalSupply: 1_000_000_000n * 10n ** 18n, // 1 billion
  homeChainId: 1, // Ethereum mainnet

  // Allocation
  allocation: {
    babylonLabs: 200_000_000n * 10n ** 18n, // 20%
    publicSale: 100_000_000n * 10n ** 18n, // 10%
    airdrop: 100_000_000n * 10n ** 18n, // 10%
    liquidity: 100_000_000n * 10n ** 18n, // 10%
    treasury: 500_000_000n * 10n ** 18n, // 50%
  },

  // Presale configuration
  presale: {
    tokensForSale: 100_000_000n * 10n ** 18n,
    minBid: 100_000_000_000_000_000n, // 0.1 ETH
    maxBid: 1000_000_000_000_000_000_000n, // 1000 ETH
    elizaBonusMultiplier: 15000, // 1.5x (in basis points over 10000)
  },

  // Token transfer fee distribution (DAO-governed via FeeConfig)
  tokenFees: {
    xlpRewardShareBps: 8000, // 80% of transfer fees to LPs
    protocolShareBps: 1000, // 10% to treasury
    burnShareBps: 1000, // 10% burned (deflationary)
    bridgeFeeMinBps: 5, // 0.05%
    bridgeFeeMaxBps: 100, // 1%
    zkProofDiscountBps: 2000, // 20% discount for ZK verification
  },

  // Platform trading fees (locked, per ICO plan)
  tradingFees: {
    // Prediction markets - matches Polymarket
    predictionTakerBps: 1, // 0.01% taker fee
    predictionMakerBps: 0, // No maker fee

    // Perpetual futures - matches Hyperliquid
    perpsTakerBps: 35, // 0.035% taker fee
    perpsMakerBps: 10, // 0.01% maker fee
    perpsMakerRebateBps: 3, // -0.003% rebate to makers
  },

  // Bot profit distribution
  botProfits: {
    burnShareBps: 5000, // 50% of bot profits burned (deflationary)
    treasuryShareBps: 5000, // 50% to treasury
  },
} as const

// ============================================================================
// BBLN Presale ABI (canonical Presale.sol from @jejunetwork/contracts)
// ============================================================================

export const BBLN_PRESALE_ABI = [
  // Contribute/bid functions
  {
    name: 'contribute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'contributeWithMaxPrice',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'maxPrice', type: 'uint256' }],
    outputs: [],
  },
  // Claim functions
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'claimRefund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // View functions
  {
    name: 'getPresaleStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'raised', type: 'uint256' },
      { name: 'participants', type: 'uint256' },
      { name: 'tokensSold', type: 'uint256' },
      { name: 'softCap', type: 'uint256' },
      { name: 'hardCap', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'phase', type: 'uint8' },
    ],
  },
  {
    name: 'getContribution',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'tokenAllocation', type: 'uint256' },
      { name: 'bonusTokens', type: 'uint256' },
      { name: 'claimedTokens', type: 'uint256' },
      { name: 'claimable', type: 'uint256' },
      { name: 'refundAmount', type: 'uint256' },
      { name: 'claimed', type: 'bool' },
      { name: 'refunded', type: 'bool' },
    ],
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'currentPhase',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'previewAllocation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'isWhitelist', type: 'bool' },
      { name: 'isHolder', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getClaimableAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ============================================================================
// BBLN Token ABI
// ============================================================================

export const BBLN_TOKEN_ABI = [
  // ERC20 standard
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  // BBLN-specific
  {
    name: 'circulatingSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalBurned',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'isBanned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getDeflationaryStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'burned', type: 'uint256' },
      { name: 'xlpFees', type: 'uint256' },
      { name: 'protocolFees', type: 'uint256' },
      { name: 'burnRate', type: 'uint256' },
    ],
  },
] as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get BBLN contract addresses for a specific network
 */
export function getBBLNAddresses(
  network: keyof typeof BBLN_ADDRESSES,
): BBLNContractAddresses {
  return BBLN_ADDRESSES[network]
}

/**
 * Check if BBLN address is configured for a network (static address lookup)
 * For deployment-based checks, use isBBLNDeployed from config/deployment
 */
export function isBBLNAddressConfigured(
  network: keyof typeof BBLN_ADDRESSES,
): boolean {
  const addresses = BBLN_ADDRESSES[network]
  return addresses.token !== '0x0000000000000000000000000000000000'
}

/**
 * Get home chain ID for BBLN (mainnet or testnet)
 */
export function getBBLNHomeChainId(isTestnet: boolean): number {
  return isTestnet ? 11155111 : 1 // Sepolia or Mainnet
}
