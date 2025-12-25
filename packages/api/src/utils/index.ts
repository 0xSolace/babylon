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
// Duplicate detection - import directly from @jejunetwork/shared
export {
  getClientIp,
  getHashedClientIp,
  hashIpAddress,
} from './ip-utils'
// Token counter utilities - import directly from @jejunetwork/shared
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
  isJejuCacheStatsResponse,
  type JejuCacheStatsResponse,
  parseAgentSession,
  parseComputeProof,
  parseJson,
  requireHex,
  safeToJsonRecord,
  toJsonRecord,
  toJsonValue,
} from './type-guards'
