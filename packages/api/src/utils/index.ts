/**
 * API Utilities
 *
 * Server-side utilities that require Node.js crypto module.
 * For base type guards, import from @babylon/shared.
 */

export {
  generateApiKey,
  generateTestApiKey,
  hashApiKey,
  verifyApiKey,
} from './api-keys'
export {
  checkDuplicate,
  cleanupDuplicates,
  clearAllDuplicates,
  clearDuplicates,
  DUPLICATE_DETECTION_CONFIGS,
  getDuplicateStats,
} from './duplicate-detector'
export {
  getClientIp,
  getHashedClientIp,
  hashIpAddress,
} from './ip-utils'
// Production guards
export {
  isProductionMode,
  requireRealImplementation,
  warnSimulationInProduction,
} from './production-guards'
// Token counter utilities
export {
  budgetTokens,
  countTokens,
  countTokensSync,
  getModelTokenLimit,
  getSafeContextLimit,
  MODEL_TOKEN_LIMITS,
  truncateToTokenLimit,
  truncateToTokenLimitSync,
} from './token-counter'
// API-specific type guards
export {
  type AgentSessionData,
  type CacheEntriesResponse,
  type CacheGetResponse,
  type CacheHealthResponse,
  type CacheKeysResponse,
  type CacheSuccessResponse,
  type CacheTtlResponse,
  type ComputeProofData,
  first,
  hasDbUserId,
  hasWalletAddress,
  isAddress,
  isAgentSession,
  isCacheEntriesResponse,
  isCacheGetResponse,
  isCacheHealthResponse,
  isCacheKeysResponse,
  isCacheSuccessResponse,
  isCacheTtlResponse,
  isComputeProof,
  isHex,
  isHexSignature,
  isJejuCacheStatsResponse,
  type JejuCacheStatsResponse,
  parseAddress,
  parseAgentSession,
  parseComputeProof,
  parseHex,
  parseJson,
  requireAddress,
  requireHex,
  safeToJsonRecord,
  toJsonRecord,
  toJsonValue,
} from './type-guards'
