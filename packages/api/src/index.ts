/**
 * Babylon API Package
 *
 * Provides API middleware and utilities for authentication, authorization,
 * and common API patterns.
 */

// Re-export auth types from shared
export type { AuthenticatedUser } from '@babylon/shared';
// Logger
export {
  extractErrorMessage,
  type LogData,
  Logger,
  type LogLevel,
  logger,
} from '@babylon/shared';
// Admin Audit Logging
export {
  type AdminAuditContext,
  logAdminAction,
  logAdminDelete,
  logAdminModify,
  logAdminView,
} from './admin-audit';
// Admin Middleware
export { isUserAdmin, requireAdmin } from './admin-middleware';
// Agent Authentication
export {
  type AgentSession,
  cleanupExpiredSessions,
  createAgentSession,
  getSessionDuration,
  type SessionStore,
  setSessionStore,
  verifyAgentCredentials,
  verifyAgentSession,
} from './agent-auth';
// Auth Middleware
export {
  type AuthenticationError,
  authErrorResponse,
  authenticate,
  authenticateUser,
  authenticateWithDbUser,
  getAuthClient,
  isAuthenticationError,
  optionalAuth,
  optionalAuthFromHeaders,
} from './auth-middleware';
// Cache (Decentralized - NO Redis fallback)
export {
  CACHE_KEYS,
  CacheClient,
  type CacheOptions,
  cacheDel,
  cachedDb,
  cacheExists,
  cacheGet,
  cacheSet,
  clearAllCache,
  DEFAULT_TTLS,
  getCache,
  getCacheOrFetch,
  getCacheStats,
  initializeCache,
  initializeCacheService,
  invalidateCache,
  invalidateCachePattern,
  isCacheServiceReachable,
  resetCache,
  setCache,
  tryInitializeCache,
  warmCache,
} from './cache';
// Configuration (environment detection)
export {
  type BabylonEnvironment,
  type BabylonMode,
  detectEnvironment,
  getEnvironment,
  logEnvironment,
  resetEnvironment,
} from './config';
// Contracts (Treasury Adapter - works in dev mode without Jeju)
export * from './contracts';
// Cron Authentication
export {
  type CronAuthOptions,
  cronUnauthorizedResponse,
  requireCronAuth,
  verifyCronAuth,
} from './cron-auth';
// Deployment - IPFS/IPNS/JNS
export * from './deployment';
// Development credentials (for local testing)
export {
  type DevCredentials,
  getDevAdminUser,
  getDevCredentials,
  isValidAgentSecret,
  isValidCronSecret,
  isValidDevAdminToken,
  logDevCredentials,
} from './dev-credentials';
// Error Handler (Next.js specific)
export {
  asyncHandler,
  type ErrorHandlerOptions,
  errorHandler,
  errorResponse,
  type RouteContext,
  successResponse,
  withErrorHandling,
} from './error-handler';
// Errors
export {
  ApiError,
  AuthenticationError as AuthError,
  AuthorizationError,
  BabylonError,
  BadRequestError,
  BusinessLogicError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  isAuthenticationError as isAuthError,
  isAuthorizationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from './errors';
// Fetch utilities
export { type ApiFetchOptions, apiFetch, getOAuth3AccessToken } from './fetch';
// Health checks
export * from './health';
// LLM (Decentralized Inference via Jeju Compute)
export * from './llm';
// Decentralized Messaging
export {
  type DecentralizedMessageResult,
  getDecentralizedConversations,
  getOrCreateDecentralizedDM,
  getPendingDecentralizedMessages,
  isDecentralizedMessagingEnabled,
  markDecentralizedMessageDelivered,
  markDecentralizedMessageRead,
  sendDecentralizedMessage,
} from './messaging/decentralized-messaging';
// Moderation - BanManager and ModerationMarketplace
export * from './moderation';
export * from './monitoring/monitored-cache';
export * from './monitoring/monitored-storage';
// Performance monitoring (moved from @babylon/shared)
export { performanceMonitor } from './monitoring/performance-monitor';
// Payments - ERC-4337 Paymaster
export * from './payments';
// Profile utilities
export {
  type BackendSignedUpdateParams,
  type BackendSignedUpdateResult,
  checkProfileUpdateRateLimit,
  getProfileUpdateHistory,
  isBackendSigningEnabled,
  logProfileUpdate,
  type ProfileMetadata,
  updateProfileBackendSigned,
  verifyBackendSignedUpdate,
} from './profile';
// Rate Limiting
export {
  addRateLimitHeaders,
  applyDuplicateDetection,
  applyRateLimit,
  checkDuplicate,
  checkRateLimit,
  checkRateLimitAndDuplicates,
  cleanupDuplicates,
  cleanupRateLimits,
  clearAllDuplicates,
  clearAllRateLimits,
  clearDuplicates,
  DUPLICATE_DETECTION_CONFIGS,
  duplicateContentError,
  getDuplicateStats,
  getRateLimitStatus,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  resetRateLimit,
} from './rate-limiting';
// Realtime
export {
  generateConnectionId,
  issueRealtimeToken,
  publishEvent,
  type RealtimeChannel,
  type RealtimeEventEnvelope,
  type RealtimeTokenPayload,
  signRealtimeToken,
  toStreamKey,
  verifyRealtimeToken,
} from './realtime';
export { connections } from './realtime/connection-registry';
export { drainOutboxBatch, enqueueOutbox } from './realtime/outbox';
// Redis (Decentralized - NO ioredis fallback)
export {
  closeRedis,
  DecentralizedRedis,
  getDecentralizedRedis,
  getRedis,
  getRedisClient,
  isRedisAvailable,
  type RedisInstance,
  redis,
  resetDecentralizedRedis,
  type StreamMessage,
  streamAdd,
  streamRead,
} from './redis';
// Services
export * from './services';
// SSE Event Broadcasting
export {
  broadcastChatMessage,
  broadcastToChannel,
} from './sse/event-broadcaster';
// Storage (Decentralized - NO S3/MinIO fallback)
export {
  downloadFile,
  downloadJson,
  getStorage,
  initializeStorage,
  resetStorage,
  StorageClient,
  uploadFile,
  uploadJson,
} from './storage';
// Legacy Jeju Storage exports
export {
  getJejuStorageClient,
  initializeJejuStorage,
  isJejuStorageAvailable,
  JejuStorageClient,
  type JejuStorageConfig,
  type JejuUploadOptions,
  type JejuUploadResult,
  type ModelStorageOptions,
  type StoredModel,
} from './storage/jeju-storage';
// Legacy S3 client (to be removed)
export {
  getStorageClient,
  type UploadOptions,
  type UploadResult,
} from './storage/s3-client';
// Swagger
export * from './swagger';
// TEE (Trusted Execution Environment) - Unruggable Game Infrastructure
export * from './tee';
// Types
export type { ErrorLike, JsonValue, StringRecord } from './types';
// User management utilities
export {
  type CanonicalUser,
  type EnsureUserOptions,
  ensureUserForAuth,
  findUserByIdentifier,
  findUserByIdentifierWithSelect,
  getCanonicalUserId,
  requireUserByIdentifier,
} from './users';
// Server-side utilities (require Node.js crypto)
export {
  budgetTokens,
  // Token counter utilities (moved from @babylon/shared)
  countTokens,
  countTokensSync,
  generateApiKey,
  generateTestApiKey,
  getClientIp,
  getHashedClientIp,
  getModelTokenLimit,
  getSafeContextLimit,
  hashApiKey,
  hashIpAddress,
  MODEL_TOKEN_LIMITS,
  truncateToTokenLimit,
  truncateToTokenLimitSync,
  verifyApiKey,
} from './utils';

// =============================================================================
// DECENTRALIZED INFRASTRUCTURE - KMS (Secrets)
// =============================================================================

export {
  type DecryptRequest,
  type EncryptRequest,
  type EncryptResult,
  getKMSClient,
  getSecretValue,
  initializeKMS,
  KMSClient,
  type PolicyCondition,
  resetKMSClient,
  type SecretPolicy,
  setSecretValue,
} from './secrets/kms-client';

// =============================================================================
// KEEPALIVE - Auto-restart and health monitoring
// =============================================================================

export {
  BabylonKeepalive,
  getBabylonKeepalive,
  getDefaultBabylonKeepaliveConfig,
  type HealthCheckResult,
  HealthStatus,
  initBabylonKeepalive,
  type KeepaliveConfig,
  type ResourceConfig,
  ResourceType,
  resetBabylonKeepalive,
} from './keepalive';
