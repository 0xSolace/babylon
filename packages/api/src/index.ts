/**
 * Babylon API Package
 *
 * Provides API middleware and utilities for authentication, authorization,
 * and common API patterns.
 */
// Admin Audit Logging (removed - unused)
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
// Cache (Jeju Compute-based)
export {
  CacheClient,
  type CacheConfig,
  type CacheStats,
  cacheDel,
  cacheExists,
  cacheGet,
  cacheSet,
  getCache,
  initializeCache,
  resetCache,
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
// Messaging - XMTP for private messaging, Farcaster for public via @babylon/engine
export * from './messaging'
// Moderation - BanManager and ModerationMarketplace
// Cron Metrics
export {
  type CronExecutionMetrics,
  type CronJobStats,
  cronMetrics,
  recordCronExecution,
} from './monitoring/cron-metrics'
// Performance monitoring (moved from @babylon/shared)
// Performance monitoring - import directly from @jejunetwork/shared
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
// NOTE: For duplicate detection, import directly from @jejunetwork/shared:
// checkDuplicate, cleanupDuplicates, clearAllDuplicates, clearDuplicates, DUPLICATE_DETECTION_CONFIGS, getDuplicateStats
export {
  addRateLimitHeaders,
  applyDuplicateDetection,
  applyRateLimit,
  checkRateLimit,
  checkRateLimitAndDuplicates,
  cleanupRateLimits,
  clearAllRateLimits,
  duplicateContentError,
  getRateLimitStatus,
  RATE_LIMIT_CONFIGS,
  rateLimitError,
  resetRateLimit,
} from './rate-limiting'
// Realtime
export {
  broadcastToChannel,
  generateConnectionId,
  notifyFollow,
  notifyGroupChatInvite,
  publishEvent,
  type RealtimeChannel,
  type RealtimeEventEnvelope,
  toStreamKey,
} from './realtime'
export { connections } from './realtime/connection-registry'
export { drainOutboxBatch, enqueueOutbox } from './realtime/outbox'
// Redis (NO ioredis fallback)
export {
  closeRedis,
  getRedis,
  getRedisClient,
  isRedisAvailable,
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
  type ICOTriggerConfig,
  type ICOTriggerResult,
  ICOTriggersService,
  initializeICOTriggers,
  resetICOTriggersService,
  type ScheduledTrigger,
} from './services/ico-triggers-service'
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
// Token Bootstrap Service
export {
  type BootstrapOptions,
  bootstrapTokenEcosystem,
  isTokenEcosystemReady,
  type TokenBootstrapResult,
  TokenBootstrapService,
} from './services/token-bootstrap-service'
// Waitlist Service (removed - unused)
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
// Jeju Storage - import directly from @jejunetwork/shared
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
  generateApiKey,
  generateTestApiKey,
  getClientIp,
  getHashedClientIp,
  hashApiKey,
  hashIpAddress,
  verifyApiKey,
} from './utils'
// Token counter utilities - import directly from @jejunetwork/shared

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
