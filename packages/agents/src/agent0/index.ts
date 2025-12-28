/**
 * Agent0 Integration
 *
 * Provides integration with Agent0's on-chain reputation system, agent discovery,
 * feedback submission, and ERC-8004 compliance.
 *
 * Babylon extends the core Jeju Agent0 integration with game-specific functionality.
 *
 * @packageDocumentation
 */

export type {
  Agent0AgentProfile,
  Agent0AgentUpdateParams,
  Agent0ClientConfig,
  Agent0ContractAddresses,
  Agent0Endpoint,
  Agent0Feedback,
  Agent0FeedbackParams,
  Agent0FeedbackSearchParams,
  Agent0Network,
  Agent0RegistrationParams,
  Agent0RegistrationResult,
  Agent0ReputationSummary,
  Agent0SearchFilters,
  Agent0SearchOptions,
  Agent0SearchResponse,
  Agent0SearchResult,
  Agent0SearchResultMeta,
  Agent0TransferResult,
  AggregatedReputation,
  DiscoveryFilters,
  IAgent0Client,
  IAgent0FeedbackService,
  IAgentDiscoveryService,
  IReputationBridge,
  ReputationData,
} from '@jejunetwork/agents'
// Re-export core Agent0 types and utilities from Jeju
export {
  Agent0Client,
  createAgent0Client,
  getAgent0Client,
  ReputationBridge,
  reputationBridge,
  resetAgent0Client,
  setContractAddressesProvider,
} from '@jejunetwork/agents'

// Babylon-specific Agent Discovery (extends Jeju with game-specific transforms)
export {
  AgentDiscoveryService,
  getAgentDiscoveryService,
  resetAgentDiscoveryService,
} from './AgentDiscovery'

// Babylon-specific registrations
export {
  type BabylonRegistrationResult,
  registerBabylonGame,
} from './babylon-registry-init'

// Babylon-specific Feedback Service (uses game DB)
export {
  Agent0FeedbackService,
  getAgent0FeedbackService,
  type ReputationSummary,
  resetAgent0FeedbackService,
} from './feedback-service'

// Game Discovery (Babylon-specific)
export {
  type DiscoverableGame,
  GameDiscoveryService,
  getGameDiscoveryService,
} from './GameDiscovery'

// Reputation utilities (Babylon-specific sync)
export * from './reputation'

// Resilience utilities
export * from './resilience'

// Subgraph Client
export { type SubgraphAgent, SubgraphClient } from './SubgraphClient'
