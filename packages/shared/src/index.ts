/**
 * @babylon/shared
 *
 * Shared types, constants, and utilities for Babylon.
 * This package exports only client-safe code that can run in the browser.
 *
 * For server-only utilities, import from @babylon/api:
 * - Storage: import { getStorageClient } from '@babylon/api'
 * - Monitoring: import { performanceMonitor } from '@babylon/api'
 * - Token counting: import { countTokens, countTokensSync } from '@babylon/api'
 *
 * For common utilities, import directly from @jejunetwork/shared:
 * - Nullable: toNull, toUndefined, isNullish, isNotNullish, first, last, mapGet, toDate, toDateOrNull
 * - Retry: sleep, retryWithCondition, retryIfRetryable, isRetryableError, RetryOptions
 * - Singleton: createSingleton, createGlobalSingleton, createPortSingleton
 * - Snowflake: generateSnowflakeId, isValidSnowflakeId, parseSnowflakeId, SnowflakeGenerator
 * - UI: cn, classNames
 */

// =============================================================================
// Re-export common utilities from @jejunetwork/shared
// =============================================================================

// ID Generation
// Nullable utilities
// Retry utilities
// Singleton utilities
// CSS utilities (for Tailwind)
// Array utilities
export {
  chunk,
  classNames,
  cn,
  createGlobalSingleton,
  createPortSingleton,
  createSingleton,
  delay,
  first,
  generateSnowflakeId,
  isNotNullish,
  isNullish,
  isRetryableError,
  isValidSnowflakeId,
  last,
  mapGet,
  parseSnowflakeId,
  type RetryOptions,
  retryIfRetryable,
  retryWithCondition,
  sleep,
  toDate,
  toDateOrNull,
  toNull,
  toUndefined,
} from '@jejunetwork/shared'

// =============================================================================
// Constants (all client-safe)
// =============================================================================

export * from './constants'

// =============================================================================
// Fees Configuration
// =============================================================================

export * from './fees'

// =============================================================================
// Markets (Prediction Pricing, Types)
// =============================================================================

export * from './markets'

// =============================================================================
// Types (all types are client-safe - they're just TypeScript interfaces)
// =============================================================================

export * from './types'
// Explicitly export JSON-RPC types for better discoverability
export type {
  JsonRpcError,
  JsonRpcNotification,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResult,
} from './types/common'

// =============================================================================
// Game Types (Actor, FeedPost, Question, etc.)
// =============================================================================

export * from './game-types'

// =============================================================================
// Perps Types
// =============================================================================

export * from './perps-types'

// =============================================================================
// Client-Safe Utilities (excludes token-counter which uses tiktoken)
// =============================================================================

// Assets utilities (URL helpers)
export * from './utils/assets'
// Content analysis (pure functions, no external deps)
export * from './utils/content-analysis'
// Content safety (pure functions, no external deps)
export * from './utils/content-safety'
// Formatting utilities (pure functions)
export * from './utils/format'
// JSON parser (pure functions)
export * from './utils/json-parser'
// Logger (works in browser)
export * from './utils/logger'
// Name replacement utilities (pure functions)
export * from './utils/name-replacement'
// OASF skill mapper (pure functions)
export * from './utils/oasf-skill-mapper'
// Profile utilities (pure functions)
export * from './utils/profile'
// Viem client utilities (safe contract calls)
export * from './utils/viem-client'
// Viem helpers (wallet generation, crypto utilities)
export * from './utils/viem-helpers'

// =============================================================================
// Type Guards (centralized type validation)
// =============================================================================

export * from './type-guards'

// =============================================================================
// Error Classes (client-safe)
// =============================================================================

export * from './errors'

// =============================================================================
// Auth utilities (client-safe parts)
// =============================================================================

export * from './auth'

// =============================================================================
// Contracts (ABIs and addresses - pure data)
// =============================================================================

export * from './contracts'

// =============================================================================
// Onboarding utilities
// =============================================================================

export * from './onboarding'

// =============================================================================
// Validation utilities and schemas (Zod schemas work in browser)
// =============================================================================

export * from './validation'

// =============================================================================
// Referral utilities
// =============================================================================

export * from './referral'

// =============================================================================
// Share utilities
// =============================================================================

export * from './share'

// =============================================================================
// Public configuration (canonical contract addresses, endpoints, game settings)
// =============================================================================

export * from './config'

// =============================================================================
// Jeju Network Integration Configuration
// =============================================================================

export * from './jeju-config'

// =============================================================================
// NOT EXPORTED (Server-only modules - import from @babylon/api):
// =============================================================================
// - Token counting: import { countTokens, countTokensSync } from '@babylon/api'
// - Storage: import { getStorageClient } from '@babylon/api'
// - Monitoring: import { performanceMonitor } from '@babylon/api'
// - Rate limiting (user-level): import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@babylon/api'
