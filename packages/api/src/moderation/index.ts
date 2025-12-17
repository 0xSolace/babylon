/**
 * Moderation Module
 *
 * Integrates with Jeju's permissionless moderation system:
 * - BanManager: Network and app-level ban enforcement
 * - ModerationMarketplace: Futarchy-based moderation with stake-weighted voting
 *
 * Key Features:
 * - Permissionless reporting: Anyone with stake can flag bad actors
 * - Immediate action: Staked users can place unstaked users on notice
 * - Community resolution: Prediction markets determine ban outcomes
 * - Appeal mechanism: Banned users can stake to request re-review
 */

// BanManager client for on-chain ban verification
export {
  type BanCheckResult,
  BanManagerClient,
  type BanRecord,
  BanType,
  checkBabylonAccess,
  type ExtendedBanRecord,
  enforceBan,
  getBanManagerClient,
  resetBanManagerClient,
} from './ban-manager-client';
// Middleware for ban enforcement in API routes
export {
  type BanErrorResponse,
  canParticipateInModeration,
  checkAgentBan,
  checkBanStatus,
  clearAllBanCache,
  clearBanCache,
  createBanErrorResponse,
  isBanManagerConfigured,
  requireNotBanned,
} from './ban-middleware';
// ModerationMarketplace client for futarchy-based moderation
export {
  type BanCase,
  BanStatus,
  createModerationClient,
  getModerationMarketplaceClient,
  MarketOutcome,
  ModerationMarketplaceClient,
  type ReportParams,
  resetModerationMarketplaceClient,
  type StakeInfo,
  VotePosition,
} from './moderation-marketplace-client';
