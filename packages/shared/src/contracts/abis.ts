/**
 * Contract ABIs for ERC-8004 and Prediction Market interactions
 *
 * These ABIs match the Jeju Network contract ABIs from @jejunetwork/contracts.
 * For direct contract interactions, these ABIs are provided locally to avoid
 * TypeScript rootDir issues with path mappings.
 */

// ERC-8004 Identity Registry ABI (matches Jeju IdentityRegistryAbi)
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

// ERC-8004 Reputation System ABI (matches Jeju ReputationRegistryAbi)
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

// Ban Manager ABI (matches Jeju BanManagerAbi)
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

// Moderation Marketplace ABI (matches Jeju ModerationMarketplaceAbi)
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

// Prediction Market Facet ABI
export const PREDICTION_MARKET_ABI = [
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      { name: '_question', type: 'string' },
      { name: '_outcomeNames', type: 'string[]' },
      { name: '_resolveAt', type: 'uint256' },
      { name: '_oracle', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMarket',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_winningOutcome', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'buyShares',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'sellShares',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimWinnings',
    inputs: [{ name: '_marketId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'calculateCost',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarket',
    inputs: [{ name: '_marketId', type: 'bytes32' }],
    outputs: [
      { name: 'question', type: 'string' },
      { name: 'numOutcomes', type: 'uint8' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'resolved', type: 'bool' },
      { name: 'winningOutcome', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'question', type: 'string', indexed: false },
      { name: 'numOutcomes', type: 'uint8', indexed: false },
      { name: 'liquidity', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SharesPurchased',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'cost', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MarketResolved',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'winningOutcome', type: 'uint8', indexed: false },
    ],
  },
] as const

// Oracle Facet ABI
export const ORACLE_ABI = [
  {
    type: 'function',
    name: 'requestChainlinkResolution',
    inputs: [{ name: '_marketId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'oracleCallback',
    inputs: [
      { name: '_requestId', type: 'bytes32' },
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'manualResolve',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'OracleRequested',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'oracleType', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OracleResponseReceived',
    inputs: [
      { name: 'marketId', type: 'bytes32', indexed: true },
      { name: 'requestId', type: 'bytes32', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
    ],
  },
] as const

// Diamond Loupe ABI (for facet discovery)
export const DIAMOND_LOUPE_ABI = [
  {
    type: 'function',
    name: 'facets',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'facetAddress', type: 'address' },
          { name: 'functionSelectors', type: 'bytes4[]' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'facetFunctionSelectors',
    inputs: [{ name: 'facet', type: 'address' }],
    outputs: [{ name: '', type: 'bytes4[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'facetAddresses',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'facetAddress',
    inputs: [{ name: 'functionSelector', type: 'bytes4' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

// Price Storage Facet ABI
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

// Typed ABI exports for viem compatibility
export const identityRegistryAbi = IDENTITY_REGISTRY_ABI
export const reputationSystemAbi = REPUTATION_SYSTEM_ABI
export const banManagerAbi = BAN_MANAGER_ABI
export const moderationMarketplaceAbi = MODERATION_MARKETPLACE_ABI
export const predictionMarketAbi = PREDICTION_MARKET_ABI
export const oracleAbi = ORACLE_ABI
