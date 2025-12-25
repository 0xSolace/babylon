/**
 * Contract ABIs for ERC-8004 and Prediction Market interactions
 *
 * IMPORTANT: These ABIs are Babylon-specific contract interfaces that differ from
 * the canonical Jeju Network contracts. They are maintained for backward compatibility
 * with Babylon's existing contract deployments.
 *
 * For NEW code building against Jeju Network contracts, use @jejunetwork/contracts:
 *   - import { identityRegistryAbi, reputationRegistryAbi } from '@jejunetwork/contracts'
 *   - import { banManagerAbi, moderationMarketplaceAbi } from '@jejunetwork/contracts'
 *
 * Key differences between Babylon and Jeju contract interfaces:
 *   - Babylon BanManager uses address-based bans, Jeju uses agentId (uint256)
 *   - Function signatures differ for moderation operations
 *   - Babylon's identity registry has different capabilities functions
 *
 * These ABIs will be deprecated when Babylon migrates to use Jeju Network contracts.
 */

// ERC-8004 Identity Registry ABI (Babylon-specific interface)
export const IDENTITY_REGISTRY_ABI = [
  // ERC-721 standard functions
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },

  // Agent registration
  {
    type: 'function',
    name: 'registerAgent',
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_endpoint', type: 'string' },
      { name: '_capabilitiesHash', type: 'bytes32' },
      { name: '_metadata', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateAgent',
    inputs: [
      { name: '_endpoint', type: 'string' },
      { name: '_capabilitiesHash', type: 'bytes32' },
      { name: '_metadata', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deactivateAgent',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reactivateAgent',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Profile queries
  {
    type: 'function',
    name: 'getAgentProfile',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'capabilitiesHash', type: 'bytes32' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'metadata', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenId',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'verifyAgent',
    inputs: [
      { name: '_address', type: 'address' },
      { name: '_tokenId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllActiveAgents',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isEndpointActive',
    inputs: [{ name: 'endpoint', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentsByCapability',
    inputs: [{ name: 'capabilityHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },

  // Events
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'endpoint', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentUpdated',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'endpoint', type: 'string', indexed: false },
      { name: 'capabilitiesHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentDeactivated',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'AgentReactivated',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
] as const

// ERC-8004 Reputation System ABI (Babylon-specific interface)
export const REPUTATION_SYSTEM_ABI = [
  // Reputation queries
  {
    type: 'function',
    name: 'getReputation',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [
      { name: 'totalBets', type: 'uint256' },
      { name: 'winningBets', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
      { name: 'profitLoss', type: 'uint256' },
      { name: 'accuracyScore', type: 'uint256' },
      { name: 'trustScore', type: 'uint256' },
      { name: 'isBanned', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeedbackCount',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeedback',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_index', type: 'uint256' },
    ],
    outputs: [
      { name: 'from', type: 'address' },
      { name: 'rating', type: 'int8' },
      { name: 'comment', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentsByMinScore',
    inputs: [{ name: 'minScore', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },

  // Reputation updates (only by authorized contracts)
  {
    type: 'function',
    name: 'recordBet',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordWin',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_profit', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordLoss',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_loss', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitFeedback',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_rating', type: 'int8' },
      { name: '_comment', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Agent management (owner only)
  {
    type: 'function',
    name: 'banAgent',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unbanAgent',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Events
  {
    type: 'event',
    name: 'ReputationUpdated',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'accuracyScore', type: 'uint256', indexed: false },
      { name: 'trustScore', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FeedbackSubmitted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'rating', type: 'int8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentBanned',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'AgentUnbanned',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
] as const

// Ban Manager ABI (Babylon-specific - uses address-based bans)
export const BAN_MANAGER_ABI = [
  {
    type: 'function',
    name: 'isNetworkBanned',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAppBanned',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBanReason',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'appId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBanStatus',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'NetworkBanApplied',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NetworkBanRemoved',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AppBanApplied',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'appId', type: 'bytes32', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AppBanRemoved',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'appId', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

// Moderation Marketplace ABI (Babylon-specific interface)
export const MODERATION_MARKETPLACE_ABI = [
  {
    type: 'function',
    name: 'stake',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'unstake',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'openCase',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'reason', type: 'string' },
      { name: 'evidenceHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'caseId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'challengeCase',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'vote',
    inputs: [
      { name: 'caseId', type: 'bytes32' },
      { name: 'position', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveCase',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestReReview',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getStake',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'stakedAt', type: 'uint256' },
          { name: 'stakedBlock', type: 'uint256' },
          { name: 'lastActivityBlock', type: 'uint256' },
          { name: 'isStaked', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCase',
    inputs: [{ name: 'caseId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'caseId', type: 'bytes32' },
          { name: 'reporter', type: 'address' },
          { name: 'target', type: 'address' },
          { name: 'reporterStake', type: 'uint256' },
          { name: 'targetStake', type: 'uint256' },
          { name: 'reason', type: 'string' },
          { name: 'evidenceHash', type: 'bytes32' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'marketOpenUntil', type: 'uint256' },
          { name: 'yesVotes', type: 'uint256' },
          { name: 'noVotes', type: 'uint256' },
          { name: 'totalPot', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'outcome', type: 'uint8' },
          { name: 'appealCount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isBanned',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeCase',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVote',
    inputs: [
      { name: 'caseId', type: 'bytes32' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'position', type: 'uint8' },
          { name: 'weight', type: 'uint256' },
          { name: 'stakedAt', type: 'uint256' },
          { name: 'hasVoted', type: 'bool' },
          { name: 'hasClaimed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canReport',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllCaseIds',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minReporterStake',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minChallengeStake',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CaseOpened',
    inputs: [
      { name: 'caseId', type: 'bytes32', indexed: true },
      { name: 'reporter', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'reporterStake', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'evidenceHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CaseResolved',
    inputs: [
      { name: 'caseId', type: 'bytes32', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'yesVotes', type: 'uint256', indexed: false },
      { name: 'noVotes', type: 'uint256', indexed: false },
    ],
  },
] as const

// Typed ABI exports for viem compatibility
export const identityRegistryAbi = IDENTITY_REGISTRY_ABI
export const reputationSystemAbi = REPUTATION_SYSTEM_ABI
export const banManagerAbi = BAN_MANAGER_ABI
export const moderationMarketplaceAbi = MODERATION_MARKETPLACE_ABI

// Prediction Market and Oracle ABIs - import from @jejunetwork/contracts
export {
  BabylonDiamondLoupeFacetAbi as DIAMOND_LOUPE_ABI,
  BabylonOracleFacetAbi as ORACLE_ABI,
  BabylonOracleFacetAbi as oracleAbi,
  BabylonPredictionMarketFacetAbi as PREDICTION_MARKET_ABI,
  BabylonPredictionMarketFacetAbi as predictionMarketAbi,
} from '@jejunetwork/contracts'

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
