/**
 * Rate Limiting and Duplicate Detection
 *
 * Centralized exports for rate limiting functionality
 *
 * NOTE: For duplicate detection utilities, import directly from @jejunetwork/shared:
 * checkDuplicate, cleanupDuplicates, clearAllDuplicates, clearDuplicates,
 * DUPLICATE_DETECTION_CONFIGS, getDuplicateStats
 */

// Middleware
export {
  addRateLimitHeaders,
  applyDuplicateDetection,
  applyRateLimit,
  checkRateLimitAndDuplicates,
  duplicateContentError,
  rateLimitError,
} from './middleware'
// Rate limiting (moved from @babylon/shared)
// Note: cleanupRateLimits is no longer needed - distributed cache handles TTL
export {
  checkRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
  RATE_LIMIT_CONFIGS,
  resetRateLimit,
} from './user-rate-limiter'
