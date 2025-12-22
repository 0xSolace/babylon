/**
 * Shared Zod Schemas for Examples Package
 *
 * Re-exports from @babylon/a2a and adds additional schemas for local development.
 */

import { z } from 'zod';

// Re-export existing schemas from @babylon/a2a
export {
  type BuySharesParams,
  BuySharesParamsSchema,
  type CreatePostParams,
  CreatePostParamsSchema,
  type DiscoverParams,
  DiscoverParamsSchema,
  type GetFeedParams,
  GetFeedParamsSchema,
  type OpenPositionParams,
  OpenPositionParamsSchema,
  type SearchUsersParams,
  SearchUsersParamsSchema,
  type TransferPointsParams,
  TransferPointsParamsSchema,
} from '@babylon/a2a';

// ============================================================================
// JSON-RPC Validation Schemas
// ============================================================================

/**
 * JSON-RPC 2.0 Request Schema
 */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  id: z.union([z.string(), z.number()]).optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

/**
 * Agent Header Schema
 */
export const AgentHeadersSchema = z.object({
  'x-agent-id': z.string().optional(),
  'x-agent-address': z.string().optional(),
  'x-agent-token-id': z.string().optional(),
});
export type AgentHeaders = z.infer<typeof AgentHeadersSchema>;

// ============================================================================
// Market Schemas
// ============================================================================

/**
 * Market status enum
 */
export const MarketStatusSchema = z.enum(['open', 'resolved', 'cancelled']);
export type MarketStatus = z.infer<typeof MarketStatusSchema>;

/**
 * Prediction market schema
 */
export const MarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  yesPrice: z.number().min(0).max(1),
  noPrice: z.number().min(0).max(1),
  status: MarketStatusSchema,
});
export type Market = z.infer<typeof MarketSchema>;

// ============================================================================
// Action Type Schemas
// ============================================================================

/**
 * Action types for agent decisions
 */
export const ActionTypeSchema = z.enum([
  'BUY_YES',
  'BUY_NO',
  'SELL',
  'OPEN_LONG',
  'OPEN_SHORT',
  'CLOSE_POSITION',
  'CREATE_POST',
  'CREATE_COMMENT',
  'HOLD',
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

/**
 * Decision response schema for LLM outputs
 */
export const DecisionResponseSchema = z.object({
  action: ActionTypeSchema,
  params: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().optional(),
});
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;

// ============================================================================
// Sell Shares Schema
// ============================================================================

/**
 * Sell shares params schema
 */
export const SellSharesParamsSchema = z.object({
  marketId: z.string().min(1),
  outcome: z.enum(['YES', 'NO']),
  shares: z.number().positive(),
});
export type SellSharesParams = z.infer<typeof SellSharesParamsSchema>;

// ============================================================================
// A2A Response Type Schemas (for type guards replacement)
// ============================================================================

/**
 * Schema for A2A Prediction Market
 */
export const A2APredictionMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  yesPrice: z.number().optional(),
  noPrice: z.number().optional(),
  status: z.string().optional(),
  totalVolume: z.number().optional(),
  createdAt: z.string().optional(),
});
export type A2APredictionMarketParsed = z.infer<
  typeof A2APredictionMarketSchema
>;

/**
 * Schema for A2A Perpetual Market
 */
export const A2APerpetualMarketSchema = z.object({
  ticker: z.string(),
  currentPrice: z.number(),
  name: z.string().optional(),
  change24h: z.number().optional(),
  volume24h: z.number().optional(),
  fundingRate: z.number().optional(),
});
export type A2APerpetualMarketParsed = z.infer<typeof A2APerpetualMarketSchema>;

/**
 * Schema for A2A Feed Post
 */
export const A2AFeedPostSchema = z.object({
  id: z.string(),
  content: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  likesCount: z.number().optional(),
  commentsCount: z.number().optional(),
});
export type A2AFeedPostParsed = z.infer<typeof A2AFeedPostSchema>;

/**
 * Schema for A2A Chat
 */
export const A2AChatSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  lastMessage: z.string().optional(),
  lastMessageAt: z.string().optional(),
});
export type A2AChatParsed = z.infer<typeof A2AChatSchema>;

/**
 * Schema for A2A Notification
 */
export const A2ANotificationSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  message: z.string().optional(),
  read: z.boolean().optional(),
  createdAt: z.string().optional(),
});
export type A2ANotificationParsed = z.infer<typeof A2ANotificationSchema>;

/**
 * Schema for A2A Leaderboard Entry
 */
export const A2ALeaderboardEntrySchema = z.object({
  userId: z.string(),
  rank: z.number().optional(),
  score: z.number().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
});
export type A2ALeaderboardEntryParsed = z.infer<
  typeof A2ALeaderboardEntrySchema
>;

/**
 * Schema for A2A Trending Tag
 */
export const A2ATrendingTagSchema = z.object({
  tag: z.string(),
  count: z.number().optional(),
  trend: z.string().optional(),
});
export type A2ATrendingTagParsed = z.infer<typeof A2ATrendingTagSchema>;

/**
 * Schema for A2A Organization
 */
export const A2AOrganizationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  ticker: z.string().optional(),
  description: z.string().optional(),
});
export type A2AOrganizationParsed = z.infer<typeof A2AOrganizationSchema>;

/**
 * Schema for A2A User Search Result
 */
export const A2AUserSearchResultSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  username: z.string().optional(),
  avatarUrl: z.string().optional(),
  isVerified: z.boolean().optional(),
});
export type A2AUserSearchResultParsed = z.infer<
  typeof A2AUserSearchResultSchema
>;

/**
 * Schema for A2A Market Position
 */
export const A2AMarketPositionSchema = z.object({
  id: z.string(),
  marketId: z.string(),
  outcome: z.string().optional(),
  shares: z.number().optional(),
  avgPrice: z.number().optional(),
  currentValue: z.number().optional(),
  pnl: z.number().optional(),
});
export type A2AMarketPositionParsed = z.infer<typeof A2AMarketPositionSchema>;

/**
 * Schema for A2A Perp Position
 */
export const A2APerpPositionSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  side: z.string().optional(),
  size: z.number().optional(),
  entryPrice: z.number().optional(),
  markPrice: z.number().optional(),
  pnl: z.number().optional(),
  leverage: z.number().optional(),
});
export type A2APerpPositionParsed = z.infer<typeof A2APerpPositionSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse array of items with a schema
 */
export function parseArray<T>(items: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => schema.safeParse(item))
    .filter((result): result is z.SafeParseSuccess<T> => result.success)
    .map((result) => result.data);
}
