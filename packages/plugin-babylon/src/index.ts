/**
 * @babylonai/plugin-babylon
 *
 * ElizaOS plugin for autonomous AI agents to participate in Babylon prediction markets
 * Following latest ElizaOS plugin architecture patterns
 */

import { BabylonA2AService } from './a2a-service'
import { Agent0Service } from './agent0-service'
import { BabylonDiscoveryService } from './discovery-service'
// Import plugin and services first
import {
  BabylonClientService,
  BabylonTradingService,
  predictionMarketsPlugin,
} from './plugin'
import { BabylonChatService } from './services/chat-service'
import { SocialInteractionService } from './services/services'

// Export plugin and services (following quick-starter pattern)
export {
  predictionMarketsPlugin,
  BabylonClientService,
  BabylonTradingService,
  SocialInteractionService,
  BabylonChatService,
  BabylonA2AService,
  Agent0Service,
  BabylonDiscoveryService,
}

export * from './actions/actions'
export * from './agent-auth-service'
export * from './api-client'
export * from './environment'
export * from './evaluators/evaluators'
export * from './providers/providers'
// Export types and utilities for external use
export * from './types'

// Legacy exports for backward compatibility
export const babylonGamePlugin = predictionMarketsPlugin

// Default export
export default predictionMarketsPlugin
