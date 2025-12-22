/**
 * Zod Validation Schemas for Database Models
 *
 * Manual Zod schemas for API input validation and type safety at runtime boundaries.
 * These schemas match the database table definitions and provide runtime validation.
 *
 * These validation schemas are database-agnostic and work with both:
 * - CQL (CovenantSQL) - the PRIMARY database
 * - Legacy Drizzle/PostgreSQL - for migration compatibility
 *
 * Use these schemas for:
 * - API request validation
 * - Form input validation
 * - Data transformation and sanitization
 *
 * The schemas mirror the types in model-types.ts and the schema definitions in src/schema/.
 *
 * @see model-types.ts - TypeScript types for database models
 * @see src/schema/ - Database schema definitions
 */

import { z } from 'zod';

// ============================================================================
// Custom Validators
// ============================================================================

/** Ethereum wallet address validator (checksummed or lowercase) */
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/** Username validator: 3-30 chars, alphanumeric with underscores */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  );

/** Bio validator: max 500 chars */
export const bioSchema = z
  .string()
  .max(500, 'Bio must be at most 500 characters');

/** Snowflake ID validator */
export const snowflakeIdSchema = z
  .string()
  .regex(/^\d{15,20}$/, 'Invalid snowflake ID');

/** UUID validator */
export const uuidSchema = z.string().uuid();

/** OAuth3 DID validator */
export const oauth3DidSchema = z
  .string()
  .regex(/^did:oauth3:[a-z0-9]+$/i, 'Invalid OAuth3 DID');

/** User ID validator (accepts UUID, OAuth3 DID, or Snowflake) */
export const userIdSchema = z.string().refine(
  (val) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const oauth3DidRegex = /^did:oauth3:[a-z0-9]+$/i;
    const snowflakeRegex = /^\d{15,20}$/;
    return (
      uuidRegex.test(val) ||
      oauth3DidRegex.test(val) ||
      snowflakeRegex.test(val)
    );
  },
  { message: 'Invalid user ID format' }
);

// ============================================================================
// User Schemas
// ============================================================================

/** Schema for inserting a new user */
export const insertUserSchema = z.object({
  id: z.string(),
  walletAddress: ethereumAddressSchema.optional().nullable(),
  username: usernameSchema.optional().nullable(),
  displayName: z.string().max(100).optional().nullable(),
  bio: bioSchema.optional().nullable(),
  profileImageUrl: z.string().url().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  isActor: z.boolean().default(false),
  isAgent: z.boolean().default(false),
  managedBy: z.string().optional().nullable(),
  personality: z.string().optional().nullable(),
  postStyle: z.string().optional().nullable(),
  postExample: z.string().optional().nullable(),
  virtualBalance: z.string().default('1000'),
  referralCode: z.string().optional().nullable(),
  referredBy: z.string().optional().nullable(),
});

/** Schema for selecting/returning a user (full model) */
export const selectUserSchema = insertUserSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
  totalDeposited: z.string(),
  totalWithdrawn: z.string(),
  lifetimePnL: z.string(),
  profileComplete: z.boolean(),
  hasProfileImage: z.boolean(),
  hasUsername: z.boolean(),
  hasBio: z.boolean(),
  reputationPoints: z.number(),
  referralCount: z.number(),
});

/** Schema for updating a user profile */
export const updateUserProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().max(100).optional(),
  bio: bioSchema.optional(),
  profileImageUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  showFarcasterPublic: z.boolean().optional(),
  showTwitterPublic: z.boolean().optional(),
  showWalletPublic: z.boolean().optional(),
});

// ============================================================================
// Agent Schemas
// ============================================================================

/** Agent type enum */
export const agentTypeSchema = z.enum([
  'INTERNAL',
  'EXTERNAL',
  'NPC',
  'USER_AGENT',
]);

/** Agent status enum */
export const agentStatusSchema = z.enum([
  'REGISTERED',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
]);

/** Schema for inserting an agent registry entry */
export const insertAgentRegistrySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  type: agentTypeSchema,
  status: agentStatusSchema.default('REGISTERED'),
  trustLevel: z.number().int().min(0).max(100).default(0),
  userId: z.string().optional().nullable(),
  actorId: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(1).max(10000),
  discoveryCardVersion: z.string().optional().nullable(),
  discoveryEndpointA2a: z.string().url().optional().nullable(),
  discoveryEndpointMcp: z.string().url().optional().nullable(),
  discoveryEndpointRpc: z.string().url().optional().nullable(),
  discoveryAuthRequired: z.boolean().default(false),
  discoveryAuthMethods: z.array(z.string()).default([]),
  discoveryRateLimit: z.number().int().optional().nullable(),
  discoveryCostPerAction: z.number().optional().nullable(),
});

/** Schema for selecting an agent registry entry */
export const selectAgentRegistrySchema = insertAgentRegistrySchema.extend({
  registeredAt: z.date(),
  lastActiveAt: z.date().optional().nullable(),
  terminatedAt: z.date().optional().nullable(),
  updatedAt: z.date(),
});

/** Schema for inserting agent capabilities */
export const insertAgentCapabilitySchema = z.object({
  id: z.string(),
  agentRegistryId: z.string(),
  strategies: z.array(z.string()).default([]),
  markets: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  domains: z.array(z.string()).default([]),
  version: z.string().default('1.0.0'),
  x402Support: z.boolean().default(false),
  platform: z.string().optional().nullable(),
  userType: z.string().optional().nullable(),
  a2aEndpoint: z.string().url().optional().nullable(),
  mcpEndpoint: z.string().url().optional().nullable(),
});

/** Schema for selecting agent capabilities */
export const selectAgentCapabilitySchema = insertAgentCapabilitySchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Schema for inserting an agent goal */
export const insertAgentGoalSchema = z.object({
  id: z.string(),
  agentUserId: z.string(),
  type: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  target: z.record(z.string(), z.unknown()).optional().nullable(),
  priority: z.number().int().min(0).max(100),
  status: z.string().default('active'),
  progress: z.number().min(0).max(1).default(0),
});

/** Schema for selecting an agent goal */
export const selectAgentGoalSchema = insertAgentGoalSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional().nullable(),
});

/** Schema for inserting an agent trade */
export const insertAgentTradeSchema = z.object({
  id: z.string(),
  agentUserId: z.string(),
  marketType: z.enum(['prediction', 'perp']),
  marketId: z.string().optional().nullable(),
  ticker: z.string().optional().nullable(),
  action: z.enum(['buy', 'sell', 'open_long', 'open_short', 'close']),
  side: z.string().optional().nullable(),
  amount: z.number().positive(),
  price: z.number().positive(),
  pnl: z.number().optional().nullable(),
  reasoning: z.string().optional().nullable(),
});

/** Schema for selecting an agent trade */
export const selectAgentTradeSchema = insertAgentTradeSchema.extend({
  executedAt: z.date(),
});

// ============================================================================
// Post Schemas
// ============================================================================

/** Post type enum */
export const postTypeSchema = z.enum(['post', 'article', 'comment', 'repost']);

/** Schema for inserting a post */
export const insertPostSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(10000),
  authorId: z.string(),
  gameId: z.string().optional().nullable(),
  dayNumber: z.number().int().optional().nullable(),
  timestamp: z.date().optional(),
  type: postTypeSchema.default('post'),
  imageUrl: z.string().url().optional().nullable(),
  articleTitle: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  fullContent: z.string().optional().nullable(),
  sentiment: z.string().optional().nullable(),
  slant: z.string().optional().nullable(),
  commentOnPostId: z.string().optional().nullable(),
  parentCommentId: z.string().optional().nullable(),
  originalPostId: z.string().optional().nullable(),
});

/** Schema for selecting a post */
export const selectPostSchema = insertPostSchema.extend({
  createdAt: z.date(),
  deletedAt: z.date().optional().nullable(),
  biasScore: z.number().optional().nullable(),
  byline: z.string().optional().nullable(),
});

/** Schema for creating a new post (API input) */
export const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  type: postTypeSchema.default('post'),
  imageUrl: z.string().url().optional(),
  commentOnPostId: z.string().optional(),
  parentCommentId: z.string().optional(),
});

/** Schema for inserting a comment */
export const insertCommentSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(5000),
  postId: z.string(),
  authorId: z.string(),
  parentCommentId: z.string().optional().nullable(),
});

/** Schema for selecting a comment */
export const selectCommentSchema = insertCommentSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),
});

/** Reaction type enum */
export const reactionTypeSchema = z.enum([
  'like',
  'love',
  'laugh',
  'wow',
  'sad',
  'angry',
]);

/** Schema for inserting a reaction */
export const insertReactionSchema = z.object({
  id: z.string(),
  postId: z.string().optional().nullable(),
  commentId: z.string().optional().nullable(),
  userId: z.string(),
  type: reactionTypeSchema.default('like'),
});

/** Schema for selecting a reaction */
export const selectReactionSchema = insertReactionSchema.extend({
  createdAt: z.date(),
});

// ============================================================================
// Market Schemas
// ============================================================================

/** Schema for inserting a prediction market */
export const insertMarketSchema = z.object({
  id: z.string(),
  question: z.string().min(10).max(500),
  description: z.string().max(2000).optional().nullable(),
  gameId: z.string().optional().nullable(),
  dayNumber: z.number().int().optional().nullable(),
  yesShares: z.string().default('0'),
  noShares: z.string().default('0'),
  liquidity: z.string(),
  resolved: z.boolean().default(false),
  resolution: z.boolean().optional().nullable(),
  endDate: z.date(),
});

/** Schema for selecting a prediction market */
export const selectMarketSchema = insertMarketSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
  onChainMarketId: z.string().optional().nullable(),
  onChainResolutionTxHash: z.string().optional().nullable(),
  onChainResolved: z.boolean(),
  oracleAddress: z.string().optional().nullable(),
  resolutionProofUrl: z.string().optional().nullable(),
  resolutionDescription: z.string().optional().nullable(),
});

/** Schema for inserting a market position */
export const insertPositionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  marketId: z.string(),
  side: z.boolean(), // true = YES, false = NO
  shares: z.string(),
  avgPrice: z.string(),
  amount: z.string().default('0'),
  outcome: z.boolean().optional().nullable(),
  pnl: z.string().optional().nullable(),
  questionId: z.number().int().optional().nullable(),
  status: z.string().default('active'),
});

/** Schema for selecting a market position */
export const selectPositionSchema = insertPositionSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional().nullable(),
});

/** Schema for inserting a question */
export const insertQuestionSchema = z.object({
  id: z.string(),
  questionNumber: z.number().int(),
  text: z.string().min(10).max(500),
  scenarioId: z.number().int(),
  outcome: z.boolean(),
  rank: z.number().int(),
  resolutionDate: z.date(),
  status: z.string().default('active'),
  resolvedOutcome: z.boolean().optional().nullable(),
});

/** Schema for selecting a question */
export const selectQuestionSchema = insertQuestionSchema.extend({
  createdDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  oracleCommitBlock: z.number().int().optional().nullable(),
  oracleCommitTxHash: z.string().optional().nullable(),
  oracleCommitment: z.string().optional().nullable(),
  oracleError: z.string().optional().nullable(),
  oraclePublishedAt: z.date().optional().nullable(),
  oracleRevealBlock: z.number().int().optional().nullable(),
  oracleRevealTxHash: z.string().optional().nullable(),
  oracleSaltEncrypted: z.string().optional().nullable(),
  oracleSessionId: z.string().optional().nullable(),
  resolutionProofUrl: z.string().optional().nullable(),
  resolutionDescription: z.string().optional().nullable(),
});

/** Schema for inserting an organization */
export const insertOrganizationSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  ticker: z.string().max(10).optional().nullable(),
  description: z.string().max(2000),
  type: z.string().min(1).max(50),
  canBeInvolved: z.boolean().default(true),
  initialPrice: z.number().optional().nullable(),
  currentPrice: z.number().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

/** Schema for selecting an organization */
export const selectOrganizationSchema = insertOrganizationSchema.extend({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Schema for inserting a perp market snapshot */
export const insertPerpMarketSnapshotSchema = z.object({
  ticker: z.string().min(1).max(20),
  organizationId: z.string(),
  name: z.string().optional().nullable(),
  currentPrice: z.number().positive(),
  price24hAgo: z.number().optional().nullable(),
  change24h: z.number().default(0),
  changePercent24h: z.number().default(0),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number().default(0),
  openInterest: z.number().default(0),
  fundingRate: z.record(z.string(), z.unknown()),
  maxLeverage: z.number().int().min(1).max(200).default(100),
  minOrderSize: z.number().int().min(1).default(10),
  markPrice: z.number().optional().nullable(),
  indexPrice: z.number().optional().nullable(),
});

/** Schema for selecting a perp market snapshot */
export const selectPerpMarketSnapshotSchema =
  insertPerpMarketSnapshotSchema.extend({
    price24hAgoUpdatedAt: z.date().optional().nullable(),
    metrics24hResetAt: z.date().optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

/** Perp position side enum */
export const perpSideSchema = z.enum(['long', 'short']);

/** Schema for inserting a perp position */
export const insertPerpPositionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ticker: z.string(),
  organizationId: z.string(),
  side: perpSideSchema,
  entryPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  size: z.number().positive(),
  leverage: z.number().int().min(1).max(200),
  liquidationPrice: z.number(),
  unrealizedPnL: z.number(),
  unrealizedPnLPercent: z.number(),
  fundingPaid: z.number().default(0),
});

/** Schema for selecting a perp position */
export const selectPerpPositionSchema = insertPerpPositionSchema.extend({
  openedAt: z.date(),
  lastUpdated: z.date(),
  closedAt: z.date().optional().nullable(),
  realizedPnL: z.number().optional().nullable(),
  settledAt: z.date().optional().nullable(),
  settledToChain: z.boolean(),
  settlementTxHash: z.string().optional().nullable(),
});

// ============================================================================
// Trading Schemas
// ============================================================================

/** Schema for trade input validation */
export const tradeInputSchema = z.object({
  marketId: z.string(),
  side: z.enum(['yes', 'no', 'long', 'short']),
  amount: z.number().positive(),
  leverage: z.number().int().min(1).max(200).optional(),
});

/** Schema for prediction market trade */
export const predictionTradeSchema = z.object({
  marketId: z.string(),
  side: z.boolean(), // true = YES, false = NO
  amount: z.number().positive(),
});

/** Schema for perp trade */
export const perpTradeSchema = z.object({
  ticker: z.string(),
  side: perpSideSchema,
  size: z.number().positive(),
  leverage: z.number().int().min(1).max(200),
});

// ============================================================================
// Follow/Social Schemas
// ============================================================================

/** Schema for inserting a follow */
export const insertFollowSchema = z.object({
  id: z.string(),
  followerId: z.string(),
  followingId: z.string(),
});

/** Schema for selecting a follow */
export const selectFollowSchema = insertFollowSchema.extend({
  createdAt: z.date(),
});

/** Schema for inserting a favorite */
export const insertFavoriteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  targetUserId: z.string(),
});

/** Schema for selecting a favorite */
export const selectFavoriteSchema = insertFavoriteSchema.extend({
  createdAt: z.date(),
});

/** Schema for inserting a user block */
export const insertUserBlockSchema = z.object({
  id: z.string(),
  blockerId: z.string(),
  blockedId: z.string(),
  reason: z.string().max(500).optional().nullable(),
});

/** Schema for selecting a user block */
export const selectUserBlockSchema = insertUserBlockSchema.extend({
  createdAt: z.date(),
});

/** Schema for inserting a user mute */
export const insertUserMuteSchema = z.object({
  id: z.string(),
  muterId: z.string(),
  mutedId: z.string(),
  reason: z.string().max(500).optional().nullable(),
});

/** Schema for selecting a user mute */
export const selectUserMuteSchema = insertUserMuteSchema.extend({
  createdAt: z.date(),
});

// ============================================================================
// Referral Schemas
// ============================================================================

/** Referral status enum */
export const referralStatusSchema = z.enum([
  'pending',
  'completed',
  'qualified',
  'expired',
]);

/** Schema for inserting a referral */
export const insertReferralSchema = z.object({
  id: z.string(),
  referrerId: z.string(),
  referredUserId: z.string().optional().nullable(),
  referralCode: z.string().min(4).max(20),
  status: referralStatusSchema.default('pending'),
});

/** Schema for selecting a referral */
export const selectReferralSchema = insertReferralSchema.extend({
  createdAt: z.date(),
  completedAt: z.date().optional().nullable(),
  qualifiedAt: z.date().optional().nullable(),
  signupPointsAwarded: z.boolean(),
  suspiciousReferralFlags: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable(),
});

// ============================================================================
// API Key Schemas
// ============================================================================

/** Schema for inserting a user API key */
export const insertUserApiKeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  keyHash: z.string(),
  name: z.string().max(100).optional().nullable(),
  expiresAt: z.date().optional().nullable(),
});

/** Schema for selecting a user API key */
export const selectUserApiKeySchema = insertUserApiKeySchema.extend({
  lastUsedAt: z.date().optional().nullable(),
  createdAt: z.date(),
  revokedAt: z.date().optional().nullable(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export type InsertAgentRegistry = z.infer<typeof insertAgentRegistrySchema>;
export type SelectAgentRegistry = z.infer<typeof selectAgentRegistrySchema>;
export type InsertAgentCapability = z.infer<typeof insertAgentCapabilitySchema>;
export type SelectAgentCapability = z.infer<typeof selectAgentCapabilitySchema>;
export type InsertAgentGoal = z.infer<typeof insertAgentGoalSchema>;
export type SelectAgentGoal = z.infer<typeof selectAgentGoalSchema>;
export type InsertAgentTrade = z.infer<typeof insertAgentTradeSchema>;
export type SelectAgentTrade = z.infer<typeof selectAgentTradeSchema>;

export type InsertPost = z.infer<typeof insertPostSchema>;
export type SelectPost = z.infer<typeof selectPostSchema>;
export type CreatePost = z.infer<typeof createPostSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type SelectComment = z.infer<typeof selectCommentSchema>;

export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type SelectMarket = z.infer<typeof selectMarketSchema>;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type SelectPosition = z.infer<typeof selectPositionSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type SelectQuestion = z.infer<typeof selectQuestionSchema>;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>;
export type InsertPerpMarketSnapshot = z.infer<
  typeof insertPerpMarketSnapshotSchema
>;
export type SelectPerpMarketSnapshot = z.infer<
  typeof selectPerpMarketSnapshotSchema
>;
export type InsertPerpPosition = z.infer<typeof insertPerpPositionSchema>;
export type SelectPerpPosition = z.infer<typeof selectPerpPositionSchema>;

export type TradeInput = z.infer<typeof tradeInputSchema>;
export type PredictionTrade = z.infer<typeof predictionTradeSchema>;
export type PerpTrade = z.infer<typeof perpTradeSchema>;

export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type SelectFollow = z.infer<typeof selectFollowSchema>;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type SelectFavorite = z.infer<typeof selectFavoriteSchema>;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
export type SelectUserBlock = z.infer<typeof selectUserBlockSchema>;
export type InsertUserMute = z.infer<typeof insertUserMuteSchema>;
export type SelectUserMute = z.infer<typeof selectUserMuteSchema>;

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type SelectReferral = z.infer<typeof selectReferralSchema>;

export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type SelectUserApiKey = z.infer<typeof selectUserApiKeySchema>;

// Re-export zod for convenience
export { z };
