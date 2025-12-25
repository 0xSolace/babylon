/**
 * @babylon/agents - Babylon Agent System
 *
 * This package provides the core agent infrastructure for Babylon:
 * - Agent services (creation, management, points)
 * - Autonomous behaviors (trading, posting, commenting, messaging)
 * - Agent identity and wallet management
 * - Plugin system for extending agent capabilities
 * - Agent0 integration for on-chain reputation
 * - TEE configuration for production security
 */

// Core types - re-export from @jejunetwork/agents for convenience
export {
  type AgentConfig,
  type AgentDiscoveryFilter,
  type AgentPerformance,
  AgentStatus,
  type AgentTemplate,
  AgentType,
  type CreateAgentParams,
} from '@jejunetwork/agents'
// Agent0 integration (feedback/reputation)
export * from './agent0'
// Autonomous services
export * from './autonomous'
// Communication
export * from './communication/CommunicationHub'
export * from './communication/EventBus'
// Configuration (TEE settings)
export * from './config'
// Errors
export * from './errors'
// External agent adapter
export {
  type AgentResponse,
  AuthMethod,
  ExternalAgentAdapter,
  type ExternalAgentConnection,
  type ExternalAgentMessage,
  getExternalAgentAdapter,
  type Protocol,
} from './external/ExternalAgentAdapter'
// Farcaster native posting
export * from './farcaster'
// Identity and wallet management
export * from './identity/AgentIdentityService'
export * from './identity/AgentWalletService'
export * from './identity/NPCIdentityService'
export * from './identity/NPCTokenWalletService'
// LLM integrations
export * from './llm'
// Plugins - Babylon plugin is the main export
export {
  babylonPlugin,
  initializeAgentA2AClient,
} from './plugins/babylon'
export type { BabylonRuntime } from './plugins/babylon/types'
// Plugin utilities - Jeju Compute (decentralized inference)
export { jejuComputePlugin } from './plugins/jeju-compute'
export * from './plugins/plugin-autonomy/src'
export * from './plugins/plugin-experience/src'
// Plugin sub-exports for trajectory logging, autonomy, experience
export * from './plugins/plugin-trajectory-logger/src'
// Decentralized Agent Runner
export * from './runner'
// Runtime
export * from './runtime/AgentRuntimeManager'
// Services
export * from './services'
// Templates loader
export * from './templates-loader'
// Training utilities (RL model fetching, config)
export * from './training'
// Utils
export * from './utils/createTestAgent'
// Note: For prompt-builder utilities (buildSafePrompt, countTokensSync, etc.)
// import directly from '@jejunetwork/agents'

// =============================================================================
// AI CEO - MonkeyKing
// =============================================================================

export * from './ceo'
