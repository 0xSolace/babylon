/**
 * @babylon/shared/browser
 *
 * Browser-safe exports for the shared package.
 * This file exports only code that can run in the browser.
 * Server-only code (elysia plugins, dev-server) is excluded.
 */

// Constants
export * from './constants'

// Fees
export * from './fees'

// Markets
export * from './markets'

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

// Game Types
export * from './game-types'

// Perps Types
export * from './perps-types'

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

// Type Guards
export * from './type-guards'

// Errors
export * from './errors'

// Auth
export * from './auth'

// Contracts
export * from './contracts'

// Onboarding
export * from './onboarding'

// Validation schemas (browser-safe - pure zod, no elysia)
export * from './validation/schemas'

// NOTE: content-validator excluded as it may have server dependencies
// export * from './validation/content-validator'  // EXCLUDED

// Referral
export * from './referral'

// Share
export * from './share'

// Config
export * from './config'

// Jeju Config
export * from './jeju-config'
