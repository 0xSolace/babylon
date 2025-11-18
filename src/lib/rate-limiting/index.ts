/**
 * Rate Limiting and Duplicate Detection
 *
 * Centralized exports for rate limiting functionality
 */

export {
  DUPLICATE_DETECTION_CONFIGS,
  checkDuplicate,
  cleanupDuplicates,
  clearAllDuplicates,
  clearDuplicates,
  getDuplicateStats,
} from './duplicate-detector';
export {
  addRateLimitHeaders,
  applyDuplicateDetection,
  applyRateLimit,
  checkRateLimitAndDuplicates,
  duplicateContentError,
  rateLimitError,
} from './middleware';
export {
  RATE_LIMIT_CONFIGS,
  checkRateLimit,
  cleanupRateLimits,
  clearAllRateLimits,
  getRateLimitStatus,
  resetRateLimit,
} from './user-rate-limiter';
