/**
 * Babylon Plugin
 *
 * Main entry point for the Babylon A2A plugin.
 * Provides actions, providers, and services for agent integration.
 */

import type { Plugin } from '@elizaos/core'

// Actions
export * from './actions'
// Integration helpers
export {
  BabylonA2AClient,
  disconnectAgentA2AClient,
  enhanceRuntimeWithBabylon,
  hasActiveA2AConnection,
  initializeAgentA2AClient,
  initializeAgentA2AClient as initializeBabylonPlugin,
} from './integration-a2a-sdk'
// Providers
export * from './providers'
// Services - import from ./integration-a2a-sdk or ../../autonomous/AutonomousA2AService directly
// Types
export * from './types'

/**
 * Babylon plugin definition for ElizaOS
 */
export const babylonPlugin: Plugin = {
  name: 'babylon',
  description: 'Babylon A2A plugin for agent integration',
  actions: [],
  providers: [],
  evaluators: [],
  services: [],
}

export default babylonPlugin
