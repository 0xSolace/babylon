/**
 * API Response validation schemas
 *
 * Zod schemas for validating API responses in client hooks.
 * These schemas match the actual API response structures.
 */

import { z } from 'zod'

// =============================================================================
// Feed Posts API Response Schemas
// =============================================================================

/**
 * Original post in a repost
 */
const OriginalPostSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    authorUsername: z.string().nullable(),
    authorProfileImageUrl: z.string().nullable(),
    timestamp: z.string(),
  })
  .nullable()

/**
 * FeedPost schema matching the FeedPost type from game-types.ts
 */
export const FeedPostSchema = z.object({
  id: z.string(),
  day: z.number().optional(),
  timestamp: z.string(),
  createdAt: z.string().optional(),
  type: z.string().optional(),
  content: z.string(),
  fullContent: z.string().nullable().optional(),
  articleTitle: z.string().nullable().optional(),
  byline: z.string().nullable().optional(),
  biasScore: z.number().nullable().optional(),
  sentiment: z.number().nullable().optional(),
  slant: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string(),
  authorId: z.string().optional(),
  authorName: z.string(),
  authorUsername: z.string().nullable().optional(),
  authorProfileImageUrl: z.string().nullable().optional(),
  replyTo: z.string().optional(),
  relatedQuestion: z.number().optional(),
  relatedEvent: z.string().nullable().optional(),
  gameId: z.string().nullable().optional(),
  dayNumber: z.number().nullable().optional(),
  clueStrength: z.number().optional(),
  pointsToward: z.boolean().nullable().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  shareCount: z.number().optional(),
  isLiked: z.boolean().optional(),
  isShared: z.boolean().optional(),
  isRepost: z.boolean().optional(),
  isQuote: z.boolean().optional(),
  quoteComment: z.string().nullable().optional(),
  originalPostId: z.string().nullable().optional(),
  originalPost: OriginalPostSchema.optional(),
  originalAuthorId: z.string().nullable().optional(),
  originalAuthorName: z.string().nullable().optional(),
  originalAuthorUsername: z.string().nullable().optional(),
  originalAuthorProfileImageUrl: z.string().nullable().optional(),
  originalContent: z.string().nullable().optional(),
})

/**
 * Feed posts API response schema
 */
export const FeedPostsApiResponseSchema = z.object({
  posts: z.array(FeedPostSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
})

// =============================================================================
// User Positions API Response Schemas
// =============================================================================

/**
 * Perp position from API (allows string or number for numeric fields)
 */
const PerpPositionApiSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  ticker: z.string(),
  organizationId: z.string().optional(),
  side: z.enum(['long', 'short', 'LONG', 'SHORT']),
  entryPrice: z.union([z.number(), z.string()]),
  currentPrice: z.union([z.number(), z.string()]),
  size: z.union([z.number(), z.string()]),
  leverage: z.union([z.number(), z.string()]),
  liquidationPrice: z.union([z.number(), z.string()]).optional(),
  unrealizedPnL: z.union([z.number(), z.string()]).optional(),
  unrealizedPnLPercent: z.union([z.number(), z.string()]).optional(),
  fundingPaid: z.union([z.number(), z.string()]).optional(),
  openedAt: z.string(),
  lastUpdated: z.string().optional(),
})

/**
 * Prediction position from API (allows string or number for numeric fields)
 */
const PredictionPositionApiSchema = z.object({
  id: z.string(),
  marketId: z.string(),
  question: z.string(),
  side: z.enum(['YES', 'NO']),
  shares: z.union([z.number(), z.string()]),
  avgPrice: z.union([z.number(), z.string()]),
  currentPrice: z.union([z.number(), z.string()]),
  currentValue: z.union([z.number(), z.string()]).optional(),
  costBasis: z.union([z.number(), z.string()]).optional(),
  unrealizedPnL: z.union([z.number(), z.string()]).optional(),
  currentProbability: z.union([z.number(), z.string()]).optional(),
  resolved: z.boolean().optional(),
  resolution: z.boolean().nullable().optional(),
})

/**
 * Perp stats schema
 */
const PerpStatsSchema = z.object({
  totalPositions: z.number(),
  totalPnL: z.number(),
  totalFunding: z.number(),
})

/**
 * User positions API response schema
 */
export const UserPositionsApiResponseSchema = z.object({
  perpetuals: z
    .object({
      positions: z.array(PerpPositionApiSchema).optional(),
      stats: PerpStatsSchema.optional(),
    })
    .optional(),
  predictions: z
    .object({
      positions: z.array(PredictionPositionApiSchema).optional(),
    })
    .optional(),
})

// =============================================================================
// Perp History API Response Schemas
// =============================================================================

/**
 * Single perp history point from API
 */
const PerpHistoryPointApiSchema = z.object({
  price: z.union([z.number(), z.string()]),
  change: z.union([z.number(), z.string()]).optional(),
  changePercent: z.union([z.number(), z.string()]).optional(),
  volume: z.union([z.number(), z.string()]).nullable().optional(),
  timestamp: z.string(),
})

/**
 * Perp history API response schema
 */
export const PerpHistoryApiResponseSchema = z.object({
  history: z.array(PerpHistoryPointApiSchema).optional(),
  error: z.string().optional(),
})

// =============================================================================
// Prediction History API Response Schemas
// =============================================================================

/**
 * Single prediction history point from API
 */
const PredictionHistoryPointApiSchema = z.object({
  yesPrice: z.number(),
  noPrice: z.number(),
  liquidity: z.number().optional(),
  timestamp: z.string(),
})

/**
 * Prediction history API response schema
 */
export const PredictionHistoryApiResponseSchema = z.object({
  history: z.array(PredictionHistoryPointApiSchema).optional(),
})

// =============================================================================
// Wallet Balance API Response Schemas
// =============================================================================

/**
 * Wallet balance API response schema
 */
export const WalletBalanceApiResponseSchema = z.object({
  balance: z.union([z.number(), z.string()]),
  lifetimePnL: z.union([z.number(), z.string()]),
})

// =============================================================================
// Auth (User Me) API Response Schemas
// =============================================================================

/**
 * User stats schema
 */
const UserStatsSchema = z
  .object({
    following: z.number().optional(),
    followers: z.number().optional(),
    totalActivity: z.number().optional(),
    positions: z.number().optional(),
    comments: z.number().optional(),
    reactions: z.number().optional(),
  })
  .optional()

/**
 * User schema for /api/users/me response
 */
const UserMeSchema = z
  .object({
    id: z.string(),
    walletAddress: z.string().nullable().optional(),
    displayName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    profileImageUrl: z.string().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    profileComplete: z.boolean().optional(),
    reputationPoints: z.number().optional(),
    referralCode: z.string().nullable().optional(),
    hasFarcaster: z.boolean().optional(),
    hasTwitter: z.boolean().optional(),
    hasDiscord: z.boolean().optional(),
    pointsAwardedForFarcasterFollow: z.boolean().optional(),
    pointsAwardedForTwitterFollow: z.boolean().optional(),
    pointsAwardedForDiscordJoin: z.boolean().optional(),
    farcasterUsername: z.string().nullable().optional(),
    twitterUsername: z.string().nullable().optional(),
    discordUsername: z.string().nullable().optional(),
    showTwitterPublic: z.boolean().optional(),
    showFarcasterPublic: z.boolean().optional(),
    showWalletPublic: z.boolean().optional(),
    stats: UserStatsSchema,
    nftTokenId: z.number().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    onChainRegistered: z.boolean().optional(),
  })
  .nullable()

/**
 * User me API response schema
 */
export const UserMeApiResponseSchema = z.object({
  authenticated: z.boolean(),
  needsOnboarding: z.boolean(),
  needsOnchain: z.boolean(),
  user: UserMeSchema,
})

// =============================================================================
// Unread Messages API Response Schemas
// =============================================================================

/**
 * Unread messages count API response schema
 */
export const UnreadMessagesApiResponseSchema = z.object({
  pendingDMs: z.number(),
  hasNewMessages: z.boolean(),
})

// =============================================================================
// Notifications Count API Response Schemas
// =============================================================================

/**
 * Notifications count API response schema
 */
export const NotificationsCountApiResponseSchema = z.object({
  unreadCount: z.number(),
})

// =============================================================================
// Chat Messages API Response Schemas
// =============================================================================

/**
 * Chat message from API response
 */
const ChatMessageApiSchema = z.object({
  id: z.string(),
  content: z.string(),
  senderId: z.string(),
  createdAt: z.union([z.string(), z.date()]),
})

/**
 * Chat messages API response schema
 */
export const ChatMessagesApiResponseSchema = z.object({
  messages: z.array(ChatMessageApiSchema).optional(),
  pagination: z
    .object({
      hasMore: z.boolean().optional(),
      nextCursor: z.string().optional(),
    })
    .optional(),
})

// =============================================================================
// Agent Details API Response Schemas
// =============================================================================

/**
 * Agent reputation data
 */
const AgentReputationApiSchema = z
  .object({
    trustScore: z.number().optional(),
    accuracyScore: z.number().optional(),
    totalBets: z.number().optional(),
    winningBets: z.number().optional(),
    feedbackCount: z.number().optional(),
    averageScore: z.number().optional(),
  })
  .optional()

/**
 * Agent details from API response
 */
const AgentDetailsApiSchema = z
  .object({
    agent0TokenId: z.number().optional(),
    name: z.string(),
    walletAddress: z.string(),
    isActive: z.boolean(),
    reputation: AgentReputationApiSchema,
  })
  .optional()

/**
 * Agent details API response schema
 */
export const AgentDetailsApiResponseSchema = z.object({
  agent: AgentDetailsApiSchema,
})

// =============================================================================
// Portfolio PnL API Response Schemas
// =============================================================================

/**
 * Balance API response schema (for portfolio calculation)
 */
export const BalanceApiResponseSchema = z.object({
  totalDeposited: z.union([z.number(), z.string()]).optional(),
  totalWithdrawn: z.union([z.number(), z.string()]).optional(),
  lifetimePnL: z.union([z.number(), z.string()]).optional(),
  balance: z.union([z.number(), z.string()]).optional(),
})

// =============================================================================
// Decentralized Messaging API Response Schemas
// =============================================================================

/**
 * Messaging public key response schema
 */
export const MessagingPublicKeyApiResponseSchema = z.object({
  publicKey: z.string(),
})

/**
 * Message sender schema
 */
const MessageSenderApiSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
})

/**
 * Raw message from inbox
 */
const InboxMessageApiSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  encryptedContent: z.string(),
  timestamp: z.number(),
  sender: MessageSenderApiSchema,
})

/**
 * Inbox API response schema
 */
export const InboxApiResponseSchema = z.object({
  messages: z.array(InboxMessageApiSchema),
})

/**
 * Send message API response schema
 */
export const SendMessageApiResponseSchema = z.object({
  messageId: z.string(),
  timestamp: z.number(),
})

/**
 * Error API response schema
 */
export const ErrorApiResponseSchema = z.object({
  error: z.string().optional(),
})

// =============================================================================
// Profile/Upload API Response Schemas
// =============================================================================

/**
 * Username availability check response schema
 */
export const UsernameCheckApiResponseSchema = z.object({
  available: z.boolean(),
  suggestion: z.string().optional(),
})

/**
 * File upload API response schema
 */
export const FileUploadApiResponseSchema = z.object({
  url: z.string(),
})

// =============================================================================
// Agent Template/Form API Response Schemas
// =============================================================================

/**
 * Agent template schema
 */
const AgentTemplateApiSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  system: z.string(),
  personality: z.string(),
  bio: z.string().optional(),
  tradingStrategy: z.string(),
  archetype: z.string().optional(),
})

/**
 * Agent template index response schema
 */
export const AgentTemplateIndexApiResponseSchema = z.object({
  templates: z.array(z.string()),
  templatesData: z.record(z.string(), AgentTemplateApiSchema).optional(),
})

/**
 * Single agent template response schema
 */
export const AgentTemplateApiResponseSchema = AgentTemplateApiSchema

/**
 * Generate field API response schema
 */
export const GenerateFieldApiResponseSchema = z.object({
  success: z.boolean(),
  value: z.string(),
})

// =============================================================================
// Type exports for inferred types
// =============================================================================

export type FeedPostsApiResponse = z.infer<typeof FeedPostsApiResponseSchema>
export type UserPositionsApiResponse = z.infer<
  typeof UserPositionsApiResponseSchema
>
export type PerpHistoryApiResponse = z.infer<
  typeof PerpHistoryApiResponseSchema
>
export type PredictionHistoryApiResponse = z.infer<
  typeof PredictionHistoryApiResponseSchema
>
export type WalletBalanceApiResponse = z.infer<
  typeof WalletBalanceApiResponseSchema
>
export type UserMeApiResponse = z.infer<typeof UserMeApiResponseSchema>
export type UnreadMessagesApiResponse = z.infer<
  typeof UnreadMessagesApiResponseSchema
>
export type NotificationsCountApiResponse = z.infer<
  typeof NotificationsCountApiResponseSchema
>
export type ChatMessagesApiResponse = z.infer<
  typeof ChatMessagesApiResponseSchema
>
export type AgentDetailsApiResponse = z.infer<
  typeof AgentDetailsApiResponseSchema
>
export type BalanceApiResponse = z.infer<typeof BalanceApiResponseSchema>
export type MessagingPublicKeyApiResponse = z.infer<
  typeof MessagingPublicKeyApiResponseSchema
>
export type InboxApiResponse = z.infer<typeof InboxApiResponseSchema>
export type SendMessageApiResponse = z.infer<
  typeof SendMessageApiResponseSchema
>
export type UsernameCheckApiResponse = z.infer<
  typeof UsernameCheckApiResponseSchema
>
export type FileUploadApiResponse = z.infer<typeof FileUploadApiResponseSchema>
export type AgentTemplateIndexApiResponse = z.infer<
  typeof AgentTemplateIndexApiResponseSchema
>
export type AgentTemplateApiResponse = z.infer<
  typeof AgentTemplateApiResponseSchema
>
export type GenerateFieldApiResponse = z.infer<
  typeof GenerateFieldApiResponseSchema
>
