/**
 * Plugin Trajectory Logger
 *
 * Provides trajectory logging for RL training data collection.
 */

import type { Plugin } from '@elizaos/core'

// Action interceptor
export {
  getTrajectoryContext,
  logLLMCallFromAction,
  logProviderFromAction,
  setTrajectoryContext,
  wrapActionWithLogging,
  wrapPluginActions,
  wrapPluginProviders,
  wrapProviderWithLogging,
} from './action-interceptor'
export type { ARTLLMCall, ARTStep, ARTTrajectory } from './art-format'
// ART format conversion
export { groupTrajectories, toARTTrajectory } from './art-format'
// Export utilities (export.ts and game-rewards.ts removed as unused)
// Integration helpers
export {
  endAutonomousTick,
  type FinalMetrics,
  loggedLLMCall,
  logProviderAccess,
  type ProviderAccessData,
  startAutonomousTick,
  type TrajectoryMetadata,
  type WrappedFunctionArgs,
  withTrajectoryLogging,
} from './integration'
// Core service
export { TrajectoryLoggerService } from './TrajectoryLoggerService'
// Types
export type {
  ActionAttempt,
  EnvironmentState,
  LLMCall,
  ProviderAccess,
  RewardComponents,
  Trajectory,
  TrajectoryMetrics,
  TrajectoryStep,
} from './types'

/**
 * Trajectory logger plugin for ElizaOS
 *
 * Provides trajectory logging for RL training data collection.
 */
export const trajectoryLoggerPlugin: Plugin = {
  name: 'trajectory-logger',
  description: 'Trajectory logging plugin for RL training',
  actions: [],
  providers: [],
  evaluators: [],
  services: [],
}
