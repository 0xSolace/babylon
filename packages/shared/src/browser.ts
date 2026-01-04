/**
 * @babylon/shared/browser
 *
 * Browser-safe exports for the shared package.
 * This file exports only code that can run in the browser.
 * Server-only code (elysia plugins, dev-server) is excluded.
 */

// Auth
export * from './auth'
// Constants
export * from './constants'
// Contracts
export * from './contracts'
// Errors
export * from './errors'
// Fees
export * from './fees'

// Game Types
export * from './game-types'
// Markets
export * from './markets'
// Onboarding
export * from './onboarding'
// Perps Types
export * from './perps-types'
// Type Guards
export * from './type-guards'
// Types
export * from './types'
export type {
  JsonRpcError,
  JsonRpcNotification,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResult,
} from './types/common'
// Client-Safe Utilities
export * from './utils/assets'
export * from './utils/content-analysis'
export * from './utils/format'
export * from './utils/logger'
export * from './utils/name-replacement'
export * from './utils/oasf-skill-mapper'
export * from './utils/profile'
export * from './utils/viem-client'
export * from './utils/viem-helpers'

// Validation schemas (browser-safe - pure zod, no elysia)
export * from './validation/schemas'

// NOTE: content-validator excluded as it may have server dependencies
// export * from './validation/content-validator'  // EXCLUDED

// Config
export * from './config'
// Jeju Config
export * from './jeju-config'
// Referral
export * from './referral'
// Share
export * from './share'
