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
 * For common utilities, import from @jejunetwork/shared:
 * - Nullable: toNull, toUndefined, isNullish, isNotNullish, first, last, mapGet, toDate, toDateOrNull
 * - Retry: sleep, retryWithCondition, retryIfRetryable, isRetryableError, RetryOptions
 * - Singleton: createSingleton, createGlobalSingleton, createPortSingleton
 * - Snowflake: generateSnowflakeId, isValidSnowflakeId, parseSnowflakeId, SnowflakeGenerator
 * - UI: cn, classNames
 * - Type Guards: assertDefined, assertNotNull, isArray, isBoolean, isString, isNumber, isObject, etc.
 * - JSON utilities: parseJson, parseJsonAs, fetchJsonAs, responseJson, toJsonRecord, JsonValue
 * - Error handling: getErrorMessage, toError
 */

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
// Formatting utilities
export * from './utils/format'
// Content safety - import directly from @jejunetwork/shared
// Formatting utilities - import directly from @jejunetwork/shared
// JSON parser - import directly from @jejunetwork/shared
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
// Type Guards
// =============================================================================

// Core type guards - re-export from @jejunetwork/shared
export {
  assertDefined,
  assertNotNull,
  fetchJsonAs,
  getErrorMessage,
  hasArrayProperty,
  hasBooleanProperty,
  hasNumberProperty,
  hasProperty,
  hasStringProperty,
  isArray,
  isArrayOf,
  isBoolean,
  isDate,
  isFiniteNumber,
  isJsonRecord,
  isJsonValue,
  isNonEmptyString,
  isNotNullish,
  isNullish,
  isNumber,
  isNumberArray,
  isObject,
  isPlainObject,
  isPositiveInteger,
  isString,
  isStringArray,
  isStringRecord,
  isUint8Array,
  type JsonValue,
  parseJson,
  parseJsonAs,
  responseJson,
  toError,
  toJsonRecord,
  toJsonValueOrNull,
  toStringArray,
} from '@jejunetwork/shared'

// Babylon-specific type guards (blockchain, entities, game)
export * from './type-guards'

// =============================================================================
// Token Utilities - import directly from @jejunetwork/shared
// =============================================================================

// =============================================================================
// Performance Monitoring - import directly from @jejunetwork/shared
// =============================================================================

// =============================================================================
// Duplicate Detection - import directly from @jejunetwork/shared
// =============================================================================

// =============================================================================
// Jeju Storage - import directly from @jejunetwork/shared
// =============================================================================

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
