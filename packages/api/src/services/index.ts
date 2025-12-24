/**
 * API Services
 *
 * @module api/services
 *
 * @description
 * Infrastructure and API-related services for user management, notifications, and system operations.
 */

export * from './airdrop-bonus-service'
// Buyback Service (programmatic token buybacks)
export * from './buyback-service'
// Checkpoint Service (IPFS + on-chain anchoring)
export * from './checkpoint-service'
// Claude LLM Service
export * from './claude-service'
// Compute Marketplace Integration
export * from './compute-trigger-service'
// Cross-Chain Bridge Service
export * from './cross-chain-bridge-service'
// DAO Service (AI CEO governance)
export * from './dao-service'
// Distributed Lock Service
export {
  acquireLock,
  checkLock,
  type LockOptions,
  releaseLock,
} from './distributed-lock-service'
// elizaOS Holder Airdrop
export * from './eliza-holder-airdrop-service'
// ELIZA Token Verification
export * from './eliza-verification-service'
export * from './encrypted-state-service'
// Daily Engagement Service (airdrop qualification)
export * from './engagement-service'
export * from './erc8004-registration'
// Generation Lock Service
export * from './generation-lock-service'
// ICO Automation Service
export * from './ico-automation-service'
// ICO Triggers Service
export * from './ico-triggers'
// Jeju KMS Integration
export * from './kms-integration'
// Liquidity Pool Service
export * from './liquidity-pool-service'
// Moderation Services
export * from './moderation'
export * from './notification-service'
// NPC Funding Service (TGE)
export * from './npc-funding-service'
// Onchain Service
export * from './onchain-service'
// Decentralized Orchestrator (on-chain registries + failover)
export {
  createOrchestrator,
  getOrchestrator as getDecentralizedOrchestrator,
  Orchestrator,
  type OrchestratorConfig,
  type OrchestratorStatus,
  type RegistryAddresses,
  type ServerInstance,
  ServerStatus,
} from './orchestrator'
export * from './participation-service'
export * from './points-service'
// On-chain Prediction Market Service
export * from './prediction-market-onchain'
export * from './referral-service'
export * from './reputation-service'
export {
  createBabylonOrchestrator,
  getOrchestrator as getSelfHealingOrchestrator,
  type MonitoredService,
  type OrchestratorConfig as SelfHealingOrchestratorConfig,
  type RecoveryAction,
  SelfHealingOrchestrator,
  type ServiceHealth,
  startOrchestrator,
} from './self-healing-orchestrator'
export * from './token-service'
export * from './unruggable-game-service'
// Waitlist Service - exported individually from index.ts to avoid class export
