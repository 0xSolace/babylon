/**
 * Babylon API Package
 *
 * Provides API middleware and utilities for authentication, authorization,
 * and common API patterns.
 */
// Admin Audit Logging
export {
  type AdminAuditContext,
  logAdminAction,
  logAdminDelete,
  logAdminModify,
  logAdminView,
} from './admin-audit'
// Admin Middleware
export { isUserAdmin, requireAdmin } from './admin-middleware'
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
} from './agent-auth'
// Auth Middleware
export {
  authErrorResponse,
  authenticate,
  authenticateUser,
  authenticateWithDbUser,
  getAuthClient,
  optionalAuth,
  optionalAuthFromHeaders,
} from './auth-middleware'
// Cache (NO Redis fallback)
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
} from './cache'
// Configuration (environment detection)
export {
  type BabylonEnvironment,
  type BabylonMode,
  detectEnvironment,
  getEnvironment,
  logEnvironment,
  resetEnvironment,
} from './config'
// Contracts (Treasury Adapter - works in dev mode without Jeju)
// Cron Authentication
export {
  type CronAuthOptions,
  cronUnauthorizedResponse,
  requireCronAuth,
  verifyCronAuth,
} from './cron-auth'
// Deployment - IPFS/IPNS/JNS
// Development credentials (for local testing)
export {
  type DevCredentials,
  getDevAdminUser,
  getDevCredentials,
  isValidAgentSecret,
  isValidCronSecret,
  isValidDevAdminToken,
  logDevCredentials,
} from './dev-credentials'
// Error Handler (Next.js specific)
export {
  asyncHandler,
  type ErrorHandlerOptions,
  errorHandler,
  errorResponse,
  type RouteContext,
  successResponse,
  withErrorHandling,
} from './error-handler'
// API-specific Errors (for base errors import from @babylon/shared)
export {
  ApiError,
  createErrorResponse,
  ErrorCodes,
  type ErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from './errors'
// Fetch utilities
export { type ApiFetchOptions, apiFetch, getOAuth3AccessToken } from './fetch'
// Health checks
// LLM (Inference via Jeju Compute)
// Messaging
export {
  getConversations,
  getOrCreateDM,
  getPendingMessages,
  isMessagingEnabled,
  type MessageResult,
  markMessageDelivered,
  markMessageRead,
  sendMessage,
} from './messaging/messaging'
// Moderation - BanManager and ModerationMarketplace
// Cron Metrics
export {
  type CronExecutionMetrics,
  type CronJobStats,
  cronMetrics,
  recordCronExecution,
} from './monitoring/cron-metrics'
// Performance monitoring (moved from @babylon/shared)
export { performanceMonitor } from './monitoring/performance-monitor'
// Payments - ERC-4337 Paymaster
export { PaymasterClient, type UserOperation } from './payments'
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
} from './profile'
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
} from './rate-limiting'
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
} from './realtime'
export { connections } from './realtime/connection-registry'
export { drainOutboxBatch, enqueueOutbox } from './realtime/outbox'
// Redis (NO ioredis fallback)
export {
  closeRedis,
  getRedis,
  getRedisClient,
  isRedisAvailable,
  redis,
  resetRedis,
  streamAdd,
  streamRead,
} from './redis'
// Services
export { getOrCreateReferralCode } from './services'
// Airdrop Bonus Service
export {
  AirdropBonusService,
  getAirdropBonusService,
  resetAirdropBonusService,
} from './services/airdrop-bonus-service'
// Distributed Lock Service
export {
  acquireLock,
  checkLock,
  type LockOptions,
  releaseLock,
} from './services/distributed-lock-service'
// Eliza Holder Airdrop Service
export {
  ElizaHolderAirdropService,
  getElizaHolderAirdropService,
  resetElizaHolderAirdropService,
} from './services/eliza-holder-airdrop-service'
// ICO Automation Service
export {
  type ContributorInfo,
  getICOAutomationService,
  ICOAutomationService,
  type ICOConfig,
  type ICOPhase,
  type PresaleStats,
  resetICOAutomationService,
  type TGEResult,
} from './services/ico-automation-service'
// ICO Triggers Service
export {
  getICOTriggersService,
  type ICOPhaseType,
  type ICOTimeline,
  type ICOTriggerConfig,
  type ICOTriggerStatus,
  ICOTriggersService,
  initializeICOTriggers,
  type PhaseTransitionResult,
  resetICOTriggersService,
} from './services/ico-triggers'
// Liquidity Pool Service
export {
  type FeeDistribution,
  getLiquidityPoolService,
  type LiquidityConfig,
  LiquidityPoolService,
  type LockedLPInfo,
  type LPPosition,
  type PoolInfo,
  resetLiquidityPoolService,
} from './services/liquidity-pool-service'
// Notification Service
export {
  notifyFollow,
  notifyGroupChatInvite,
} from './services/notification-service'
// Points Service
export {
  awardPoints,
  awardReferralSignup,
  checkAndQualifyReferral,
  getLeaderboard,
  getUserPoints,
  getUserRank,
} from './services/points-service'
// Token Service
export {
  calculateAirdropAllocation,
  formatTokens,
  generateAirdropMerkleData,
  parseTokens,
  pointsToDisplayTokens,
} from './services/token-service'
// Waitlist Service
export {
  awardWalletBonus,
  generateInviteCode,
  getTopWaitlistUsers,
  getTotalWaitlistCount,
  getWaitlistPosition,
  graduateFromWaitlist,
  markAsWaitlisted,
  type WaitlistMarkResult,
  type WaitlistPosition,
} from './services/waitlist-service'
// SSE Event Broadcasting
export {
  broadcastChatMessage,
  broadcastToChannel,
} from './sse/event-broadcaster'
// Storage (NO S3/MinIO fallback)
export {
  downloadFile,
  downloadJson,
  type FileMetadata,
  getStorage,
  initializeStorage,
  resetStorage,
  StorageClient,
  uploadFile,
  uploadJson,
} from './storage'
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
} from './storage/jeju-storage'
// Legacy S3 client (to be removed)
export {
  getStorageClient,
  type UploadOptions,
  type UploadResult,
} from './storage/s3-client'
// Swagger
// TEE (Trusted Execution Environment) - Unruggable Game Infrastructure
// Types
export type { ErrorLike, JsonValue, StringRecord } from './types'
// User management utilities
export {
  type CanonicalUser,
  type EnsureUserOptions,
  ensureUserForAuth,
  findUserByIdentifier,
  findUserByIdentifierWithSelect,
  getCanonicalUserId,
  requireUserByIdentifier,
} from './users'
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
} from './utils'

// =============================================================================
// INFRASTRUCTURE - KMS (Secrets)
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
} from './secrets/kms-client'

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
} from './keepalive'

// =============================================================================
// WALLET AUTH - Permissionless wallet-signed sessions
// =============================================================================

export {
  createSessionMessage,
  createWalletAuthMiddleware,
  extractTokenFromCookie,
  extractTokenFromHeader,
  isWalletAuthenticated,
  optionalWalletAuth,
  requireWalletAuth,
  type SessionClaims,
  SessionManager,
  type SessionToken,
  toAuthClaims,
  type VerifyOptions,
  type VerifyResult,
  verifyFromRequest,
  verifyToken,
  type WalletAuthClaims,
  type WalletAuthenticatedRequest,
  type WalletAuthMiddlewareConfig,
  type WalletDID,
} from './auth'
