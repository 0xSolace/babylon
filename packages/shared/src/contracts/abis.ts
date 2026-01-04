/**
 * Contract ABIs for ERC-8004 and Prediction Market interactions
 *
 * Babylon-specific ABIs (prediction markets, pricing) remain defined here.
 *
 * For moderation and identity ABIs, import directly from @jejunetwork/contracts:
 *   import { banManagerAbi, moderationMarketplaceAbi, identityRegistryAbi } from '@jejunetwork/contracts'
 */

// Import directly from @jejunetwork/contracts:
// import { banManagerAbi, identityRegistryAbi, moderationMarketplaceAbi, reputationRegistryAbi } from '@jejunetwork/contracts'

// =============================================================================
// Babylon-specific ABIs (not in @jejunetwork/contracts)
// =============================================================================

// Price Storage Facet ABI - Babylon-specific
export const PRICE_STORAGE_FACET_ABI = [
  {
    type: 'function',
    name: 'updatePrices',
    inputs: [
      { name: '_marketIds', type: 'bytes32[]' },
      { name: '_tick', type: 'uint256' },
      { name: '_prices', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLatestPrice',
    inputs: [{ name: '_marketId', type: 'bytes32' }],
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'tick', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getGlobalTickCounter',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PriceUpdated',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'tick', type: 'uint256', indexed: true },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

// Legacy Babylon-specific ABIs for prediction markets
export const BABYLON_PREDICTION_MARKET_ABI = [
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'endTime', type: 'uint256' },
      { name: 'metadata', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMarket',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMarket',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [
      { name: 'endTime', type: 'uint256' },
      { name: 'resolved', type: 'bool' },
      { name: 'outcome', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'marketId', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

export const BABYLON_ORACLE_ABI = [
  {
    type: 'function',
    name: 'requestResolution',
    inputs: [{ name: 'marketId', type: 'bytes32' }],
    outputs: [{ name: 'requestId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fulfillResolution',
    inputs: [
      { name: 'requestId', type: 'bytes32' },
      { name: 'outcome', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

// Aliases (SCREAMING_CASE for legacy, camelCase for new code)
export const PREDICTION_MARKET_ABI = BABYLON_PREDICTION_MARKET_ABI
export const ORACLE_ABI = BABYLON_ORACLE_ABI
export const predictionMarketAbi = BABYLON_PREDICTION_MARKET_ABI
export const oracleAbi = BABYLON_ORACLE_ABI
