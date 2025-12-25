/**
 * @fileoverview Babylon Moderation System with Jeju Integration
 * @module @babylon/moderation
 *
 * This package provides the moderation system for Babylon with full integration
 * to Jeju's ModerationMarketplace futarchy system.
 *
 * Features:
 * - Stake-based ban proposals with futarchy voting
 * - Flash loan protection via time-weighted stakes
 * - 10x stake re-review mechanism
 * - Cross-app ban enforcement
 * - A2A protocol integration for agent moderation
 *
 * @example
 * ```typescript
 * import { ModerationClient, BanStatus } from '@babylon/moderation';
 *
 * const client = new ModerationClient({
 *   moderationMarketplace: '0x...',
 *   banManager: '0x...',
 *   identityRegistry: '0x...',
 *   chainId: 31337,
 *   rpcUrl: 'http://localhost:6545',
 * });
 *
 * // Check if user is banned
 * const isBanned = await client.isBanned(userAddress);
 *
 * // Open a ban case
 * await client.openCase(targetAddress, 'Spam bot', evidenceHash);
 *
 * // Vote on a case
 * await client.vote(caseId, VotePosition.YES);
 * ```
 */

// ABIs from @babylon/shared
export {
  BAN_MANAGER_ABI,
  IDENTITY_REGISTRY_ABI,
  MODERATION_MARKETPLACE_ABI,
} from '@babylon/shared'

// A2A handler exports
export { createModerationA2AHandler } from './a2a-handler'

// Bridge for cross-chain synchronization
export { createModerationBridge, ModerationBridge } from './bridge'

// Core client
export { createModerationClient, ModerationClient } from './client'

// Zod schemas for validation
export {
  AddressSchema,
  BanStatusSchema,
  Bytes32Schema,
  CanReportParamsSchema,
  ChallengeBanParamsSchema,
  ClaimRewardsParamsSchema,
  GetActiveCasesParamsSchema,
  GetBanStatusParamsSchema,
  GetCaseParamsSchema,
  GetStakeParamsSchema,
  JejuModerationConfigSchema,
  ProposeBanParamsSchema,
  ReportCategorySchema,
  ReReviewParamsSchema,
  ResolveCaseParamsSchema,
  StakeParamsSchema,
  UnstakeParamsSchema,
  VoteParamsSchema,
  VotePositionSchema,
} from './schemas'

// Types
export {
  type BabylonModerationConfig,
  type BanAppliedEvent,
  type BanCase,
  type BanRemovedEvent,
  BanStatus,
  type CaseChallengedEvent,
  type CaseOpenedEvent,
  type CaseResolvedEvent,
  type CrossChainBanSync,
  type JejuModerationConfig,
  MarketOutcome,
  type ModerationA2AMethods,
  type ModerationReport,
  ReportCategory,
  type StakeInfo,
  type Vote,
  type VoteCastEvent,
  VotePosition,
} from './types'
