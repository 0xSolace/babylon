/**
 * Admin operation validation schemas
 *
 * Schemas for admin-only operations including user management,
 * moderation, escrow, trading, and system statistics.
 */

import { z } from 'zod'

// ============================================================================
// User Management Schemas
// ============================================================================

/**
 * Admin user query schema
 */
export const AdminUserQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  filter: z.enum(['all', 'actors', 'users', 'banned', 'admins']).default('all'),
  sortBy: z
    .enum([
      'created',
      'balance',
      'reputation',
      'username',
      'reports_received',
      'blocks_received',
      'mutes_received',
      'report_ratio',
      'block_ratio',
      'bad_user_score',
    ])
    .default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type AdminUserQuery = z.infer<typeof AdminUserQuerySchema>

/**
 * Admin user display schema (for list views)
 */
export const AdminUserDisplaySchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isActor: z.boolean(),
})
export type AdminUserDisplay = z.infer<typeof AdminUserDisplaySchema>

/**
 * Full admin user schema (detailed view)
 */
export const AdminUserSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  walletAddress: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isActor: z.boolean(),
  isAdmin: z.boolean(),
  isBanned: z.boolean(),
  bannedAt: z.string().nullable(),
  bannedReason: z.string().nullable(),
  bannedBy: z.string().nullable(),
  virtualBalance: z.string(),
  totalDeposited: z.string(),
  totalWithdrawn: z.string(),
  lifetimePnL: z.string(),
  reputationPoints: z.number(),
  referralCount: z.number(),
  onChainRegistered: z.boolean(),
  nftTokenId: z.number().nullable(),
  hasFarcaster: z.boolean(),
  hasTwitter: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z
    .object({
      comments: z.number(),
      reactions: z.number(),
      positions: z.number(),
      following: z.number(),
      followedBy: z.number(),
      reportsReceived: z.number().optional(),
      blocksReceived: z.number().optional(),
      mutesReceived: z.number().optional(),
    })
    .optional(),
})
export type AdminUser = z.infer<typeof AdminUserSchema>

/**
 * Ban/unban user schema
 */
export const BanUserSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().min(1).max(500).optional(),
  isScammer: z.boolean().optional(),
  isCSAM: z.boolean().optional(),
})
export type BanUser = z.infer<typeof BanUserSchema>

/**
 * Admin promotion/demotion schema
 */
export const AdminActionSchema = z.object({
  action: z.enum(['promote', 'demote']),
})
export type AdminAction = z.infer<typeof AdminActionSchema>

/**
 * Admin report action schema
 */
export const AdminReportActionSchema = z.object({
  action: z.enum(['evaluate', 'resolve', 'dismiss', 'escalate']),
  resolution: z.string().optional(),
})
export type AdminReportAction = z.infer<typeof AdminReportActionSchema>

// ============================================================================
// Moderation Schemas
// ============================================================================

/**
 * Human review action schema
 */
export const HumanReviewActionSchema = z.object({
  action: z.enum(['approve', 'deny']),
  reasoning: z.string().min(10).max(2000),
})
export type HumanReviewAction = z.infer<typeof HumanReviewActionSchema>

// ============================================================================
// Escrow Schemas
// ============================================================================

/**
 * Escrow status enum
 */
export const EscrowStatusSchema = z.enum([
  'pending',
  'paid',
  'refunded',
  'expired',
])
export type EscrowStatus = z.infer<typeof EscrowStatusSchema>

/**
 * Create escrow payment schema
 */
export const CreateEscrowPaymentSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  amountUSD: z.number().positive('Amount must be positive'),
  reason: z.string().optional(),
})
export type CreateEscrowPayment = z.infer<typeof CreateEscrowPaymentSchema>

/**
 * Verify escrow payment schema
 */
export const VerifyEscrowPaymentSchema = z.object({
  escrowId: z.string().min(1, 'Escrow ID is required'),
  txHash: z.string().min(1, 'Transaction hash is required'),
  fromAddress: z.string().min(1, 'From address is required'),
  toAddress: z.string().min(1, 'To address is required'),
  amount: z.string().min(1, 'Amount is required'),
})
export type VerifyEscrowPayment = z.infer<typeof VerifyEscrowPaymentSchema>

/**
 * Refund escrow schema
 */
export const RefundEscrowSchema = z.object({
  escrowId: z.string().min(1, 'Escrow ID is required'),
  refundTxHash: z.string().min(1, 'Refund transaction hash is required'),
  reason: z.string().optional(),
})
export type RefundEscrow = z.infer<typeof RefundEscrowSchema>

/**
 * List escrow query schema
 */
export const ListEscrowQuerySchema = z.object({
  recipientId: z.string().optional(),
  adminId: z.string().optional(),
  status: EscrowStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})
export type ListEscrowQuery = z.infer<typeof ListEscrowQuerySchema>

/**
 * Escrow user reference schema
 */
export const EscrowUserRefSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable().optional(),
})
export type EscrowUserRef = z.infer<typeof EscrowUserRefSchema>

/**
 * Full escrow schema
 */
export const EscrowSchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  recipient: EscrowUserRefSchema,
  adminId: z.string(),
  admin: EscrowUserRefSchema.omit({ profileImageUrl: true }),
  amountUSD: z.string(),
  amountWei: z.string(),
  status: EscrowStatusSchema,
  reason: z.string().nullable(),
  paymentRequestId: z.string().nullable(),
  paymentTxHash: z.string().nullable(),
  refundTxHash: z.string().nullable(),
  refundedBy: z.string().nullable(),
  refundedByUser: EscrowUserRefSchema.omit({
    profileImageUrl: true,
  }).nullable(),
  refundedAt: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type Escrow = z.infer<typeof EscrowSchema>

// ============================================================================
// Trading Schemas
// ============================================================================

/**
 * Trade type enum
 */
export const AdminTradeTypeSchema = z.enum(['balance', 'npc', 'position'])
export type AdminTradeType = z.infer<typeof AdminTradeTypeSchema>

/**
 * Admin trades query schema
 */
export const AdminTradesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['all', 'balance', 'npc', 'position']).default('all'),
})
export type AdminTradesQuery = z.infer<typeof AdminTradesQuerySchema>

/**
 * Base trade schema
 */
export const AdminBaseTradeSchema = z.object({
  type: AdminTradeTypeSchema,
  id: z.string(),
  timestamp: z.coerce.date(),
  user: AdminUserDisplaySchema.nullable(),
})
export type AdminBaseTrade = z.infer<typeof AdminBaseTradeSchema>

/**
 * Balance trade schema
 */
export const AdminBalanceTradeSchema = AdminBaseTradeSchema.extend({
  type: z.literal('balance'),
  amount: z.string(),
  balanceBefore: z.string(),
  balanceAfter: z.string(),
  transactionType: z.string(),
  description: z.string().nullable(),
  relatedId: z.string().nullable(),
})
export type AdminBalanceTrade = z.infer<typeof AdminBalanceTradeSchema>

/**
 * NPC trade schema
 */
export const AdminNPCTradeSchema = AdminBaseTradeSchema.extend({
  type: z.literal('npc'),
  marketType: z.string(),
  ticker: z.string().nullable(),
  marketId: z.string().nullable(),
  action: z.string(),
  side: z.string().nullable(),
  amount: z.number(),
  price: z.number(),
  sentiment: z.number().nullable(),
  reason: z.string().nullable(),
})
export type AdminNPCTrade = z.infer<typeof AdminNPCTradeSchema>

/**
 * Position trade market schema
 */
export const AdminPositionTradeMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  resolved: z.boolean(),
  resolution: z.boolean().nullable(),
})
export type AdminPositionTradeMarket = z.infer<
  typeof AdminPositionTradeMarketSchema
>

/**
 * Position trade schema
 */
export const AdminPositionTradeSchema = AdminBaseTradeSchema.extend({
  type: z.literal('position'),
  market: AdminPositionTradeMarketSchema,
  side: z.string(),
  shares: z.number(),
  avgCost: z.number(),
  currentValue: z.number(),
  pnl: z.number(),
})
export type AdminPositionTrade = z.infer<typeof AdminPositionTradeSchema>

/**
 * Union of all trade types
 */
export const AdminTradeSchema = z.discriminatedUnion('type', [
  AdminBalanceTradeSchema,
  AdminNPCTradeSchema,
  AdminPositionTradeSchema,
])
export type AdminTrade = z.infer<typeof AdminTradeSchema>

/**
 * Create balance trade schema
 */
export const CreateBalanceTradeSchema = z.object({
  type: z.literal('balance'),
  userId: z.string().min(1),
  transactionType: z.enum([
    'pred_buy',
    'pred_sell',
    'perp_open',
    'perp_close',
    'perp_liquidation',
    'deposit',
    'withdrawal',
  ]),
  amount: z.number(),
  description: z.string().optional(),
  relatedId: z.string().optional(),
  updateBalance: z.boolean().default(true), // Whether to update user's balance
})
export type CreateBalanceTrade = z.infer<typeof CreateBalanceTradeSchema>

/**
 * Create NPC trade schema
 */
export const CreateNPCTradeSchema = z.object({
  type: z.literal('npc'),
  npcActorId: z.string().min(1),
  marketType: z.enum(['prediction', 'perp']),
  ticker: z.string().optional(),
  marketId: z.string().optional(),
  action: z.string().min(1),
  side: z.string().optional(),
  amount: z.number().positive(),
  price: z.number().positive(),
  sentiment: z.number().optional(),
  reason: z.string().optional(),
  poolId: z.string().optional(),
  postId: z.string().optional(),
})
export type CreateNPCTrade = z.infer<typeof CreateNPCTradeSchema>

/**
 * Create trade schema (discriminated union)
 */
export const CreateTradeSchema = z.discriminatedUnion('type', [
  CreateBalanceTradeSchema,
  CreateNPCTradeSchema,
])
export type CreateTrade = z.infer<typeof CreateTradeSchema>

// ============================================================================
// Notification Schemas
// ============================================================================

/**
 * Admin notification type enum
 */
export const AdminNotificationTypeSchema = z.enum([
  'info',
  'warning',
  'alert',
  'promotion',
])
export type AdminNotificationType = z.infer<typeof AdminNotificationTypeSchema>

/**
 * Notification type enum for creating notifications
 */
export const CreateNotificationTypeSchema = z.enum([
  'system',
  'comment',
  'reaction',
  'follow',
  'mention',
  'reply',
  'share',
])
export type CreateNotificationType = z.infer<
  typeof CreateNotificationTypeSchema
>

/**
 * Create notification schema
 */
export const CreateNotificationSchema = z.object({
  userId: z.string().optional(), // If not provided, send to all users
  message: z.string().min(1).max(500),
  type: CreateNotificationTypeSchema.default('system'),
  postId: z.string().optional(),
  commentId: z.string().optional(),
  link: z.string().optional(), // Optional custom link
  sendToAll: z.boolean().default(false), // Send to all users
})
export type CreateNotification = z.infer<typeof CreateNotificationSchema>

// ============================================================================
// Load Testing Schemas
// ============================================================================

/**
 * Load test scenario enum
 */
export const LoadTestScenarioSchema = z.enum([
  'LIGHT',
  'NORMAL',
  'HEAVY',
  'STRESS',
])
export type LoadTestScenario = z.infer<typeof LoadTestScenarioSchema>

/**
 * Load test request schema
 */
export const LoadTestRequestSchema = z.object({
  scenario: LoadTestScenarioSchema,
  baseUrl: z.string().url().optional(),
})
export type LoadTestRequest = z.infer<typeof LoadTestRequestSchema>

// ============================================================================
// Test DM Messages Schema
// ============================================================================

/**
 * Test DM messages schema (for testing/development)
 */
export const TestDMMessagesSchema = z.object({
  senderId: z.string().min(1),
  recipientId: z.string().min(1),
  messageCount: z.number().min(1).max(200).default(100),
})
export type TestDMMessages = z.infer<typeof TestDMMessagesSchema>

// ============================================================================
// System Stats Schemas
// ============================================================================

/**
 * User stats base schema (for top users lists)
 */
export const UserStatsBaseSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
})
export type UserStatsBase = z.infer<typeof UserStatsBaseSchema>

/**
 * User by balance schema
 */
export const UserByBalanceSchema = UserStatsBaseSchema.extend({
  virtualBalance: z.string(),
  lifetimePnL: z.string(),
})
export type UserByBalance = z.infer<typeof UserByBalanceSchema>

/**
 * User by reputation schema
 */
export const UserByReputationSchema = UserStatsBaseSchema.extend({
  reputationPoints: z.number(),
})
export type UserByReputation = z.infer<typeof UserByReputationSchema>

/**
 * Recent signup user schema
 */
export const RecentSignupSchema = UserStatsBaseSchema.extend({
  walletAddress: z.string().nullable(),
  createdAt: z.string(),
  onChainRegistered: z.boolean(),
  hasFarcaster: z.boolean(),
  hasTwitter: z.boolean(),
})
export type RecentSignup = z.infer<typeof RecentSignupSchema>

/**
 * System stats response schema
 */
export const SystemStatsResponseSchema = z.object({
  users: z.object({
    total: z.number(),
    actors: z.number(),
    realUsers: z.number(),
    banned: z.number(),
    admins: z.number(),
    signups: z.object({
      today: z.number(),
      thisWeek: z.number(),
      thisMonth: z.number(),
    }),
  }),
  markets: z.object({
    total: z.number(),
    active: z.number(),
    resolved: z.number(),
    positions: z.number(),
  }),
  trading: z.object({
    balanceTransactions: z.number(),
    npcTrades: z.number(),
  }),
  social: z.object({
    posts: z.number(),
    postsToday: z.number(),
    comments: z.number(),
    reactions: z.number(),
  }),
  financial: z.object({
    totalVirtualBalance: z.string(),
    totalDeposited: z.string(),
    totalWithdrawn: z.string(),
    totalLifetimePnL: z.string(),
  }),
  pools: z.object({
    total: z.number(),
    active: z.number(),
    deposits: z.number(),
  }),
  engagement: z.object({
    referrals: z.number(),
    pointsTransactions: z.number(),
  }),
  topUsers: z.object({
    byBalance: z.array(UserByBalanceSchema),
    byReputation: z.array(UserByReputationSchema),
  }),
  recentSignups: z.array(RecentSignupSchema),
})
export type SystemStatsResponse = z.infer<typeof SystemStatsResponseSchema>

// ============================================================================
// Fee Stats Schemas
// ============================================================================

/**
 * Basic fee stats schema (simple view)
 */
export const BasicFeeStatsSchema = z.object({
  totalFeesCollected: z.number(),
  totalUserFees: z.number(),
  totalNPCFees: z.number(),
  totalPlatformFees: z.number(),
  totalReferrerFees: z.number(),
  totalTrades: z.number(),
})
export type BasicFeeStats = z.infer<typeof BasicFeeStatsSchema>

/**
 * Fee by type schema
 */
export const FeeByTypeSchema = z.object({
  tradeType: z.string(),
  totalFees: z.number(),
  platformFees: z.number(),
  referrerFees: z.number(),
  tradeCount: z.number(),
})
export type FeeByType = z.infer<typeof FeeByTypeSchema>

/**
 * Top fee payer schema
 */
export const TopFeePayerSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  profileImageUrl: z.string().nullable(),
  isNPC: z.boolean(),
  totalFees: z.number(),
  tradeCount: z.number(),
})
export type TopFeePayer = z.infer<typeof TopFeePayerSchema>

/**
 * Top referral earner schema
 */
export const TopReferralEarnerSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  profileImageUrl: z.string().nullable(),
  totalEarned: z.number(),
  referralCount: z.number(),
})
export type TopReferralEarner = z.infer<typeof TopReferralEarnerSchema>

/**
 * Full fee stats response schema
 */
export const FeeStatsResponseSchema = z.object({
  platformStats: BasicFeeStatsSchema,
  feesByType: z.array(FeeByTypeSchema),
  topFeePayers: z.array(TopFeePayerSchema),
  topReferralEarners: z.array(TopReferralEarnerSchema),
})
export type FeeStatsResponse = z.infer<typeof FeeStatsResponseSchema>

// ============================================================================
// Token Stats Schemas
// ============================================================================

/**
 * Token stats by prompt type schema
 */
export const TokenStatsByPromptTypeSchema = z.object({
  promptType: z.string(),
  callCount: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalTokens: z.number(),
  avgTokensPerCall: z.number(),
})
export type TokenStatsByPromptType = z.infer<
  typeof TokenStatsByPromptTypeSchema
>

/**
 * Token stats by model schema
 */
export const TokenStatsByModelSchema = z.object({
  model: z.string(),
  provider: z.string(),
  callCount: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalTokens: z.number(),
  estimatedCostUSD: z.number(),
})
export type TokenStatsByModel = z.infer<typeof TokenStatsByModelSchema>

/**
 * Token stats summary schema
 */
export const TokenStatsSummarySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  tickCount: z.number(),
  totalCalls: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalTokens: z.number(),
  avgCallsPerTick: z.number(),
  avgInputTokensPerTick: z.number(),
  avgOutputTokensPerTick: z.number(),
  avgTotalTokensPerTick: z.number(),
  estimatedTotalCostUSD: z.number(),
})
export type TokenStatsSummary = z.infer<typeof TokenStatsSummarySchema>

/**
 * Token stats response schema
 */
export const TokenStatsResponseSchema = z.object({
  success: z.boolean(),
  summary: TokenStatsSummarySchema,
  byPromptType: z.array(TokenStatsByPromptTypeSchema),
  byModel: z.array(TokenStatsByModelSchema),
})
export type TokenStatsResponse = z.infer<typeof TokenStatsResponseSchema>

// ============================================================================
// Registry Entity Schemas
// ============================================================================

/**
 * Registry entity reputation schema
 */
export const AdminRegistryReputationSchema = z.object({
  trustScore: z.number(),
  accuracyScore: z.number(),
})
export type AdminRegistryReputation = z.infer<
  typeof AdminRegistryReputationSchema
>

/**
 * Registry entity stats schema
 */
export const AdminRegistryStatsSchema = z.object({
  followers: z.number().optional(),
  positions: z.number().optional(),
  pools: z.number().optional(),
  trades: z.number().optional(),
})
export type AdminRegistryStats = z.infer<typeof AdminRegistryStatsSchema>

/**
 * Registry entity schema
 */
export const AdminRegistryEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  imageUrl: z.string().nullable(),
  bio: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  type: z.enum(['user', 'actor', 'agent', 'app']),
  isActor: z.boolean().optional(),
  isBanned: z.boolean(),
  isScammer: z.boolean(),
  isCSAM: z.boolean(),
  onChainRegistered: z.boolean(),
  nftTokenId: z.number().nullable(),
  agent0TokenId: z.number().nullable().optional(),
  walletAddress: z.string().nullable(),
  balance: z.string().nullable().optional(),
  reputationScore: z.number().nullable().optional(),
  reputationPoints: z.number().nullable().optional(),
  totalFeedbackCount: z.number().nullable().optional(),
  reputation: AdminRegistryReputationSchema.nullable().optional(),
  stats: AdminRegistryStatsSchema.nullable().optional(),
  tier: z.string().nullable().optional(),
  domain: z.array(z.string()).nullable().optional(),
  a2aEndpoint: z.string().nullable().optional(),
  mcpEndpoint: z.string().nullable().optional(),
})
export type AdminRegistryEntity = z.infer<typeof AdminRegistryEntitySchema>

/**
 * Registry totals schema
 */
export const AdminRegistryTotalsSchema = z.object({
  total: z.number(),
  users: z.number(),
  actors: z.number(),
  agents: z.number(),
  apps: z.number(),
})
export type AdminRegistryTotals = z.infer<typeof AdminRegistryTotalsSchema>

/**
 * Full registry data response schema
 */
export const AdminRegistryDataSchema = z.object({
  users: z.array(AdminRegistryEntitySchema),
  actors: z.array(AdminRegistryEntitySchema),
  agents: z.array(AdminRegistryEntitySchema),
  apps: z.array(AdminRegistryEntitySchema),
  totals: AdminRegistryTotalsSchema,
})
export type AdminRegistryData = z.infer<typeof AdminRegistryDataSchema>
