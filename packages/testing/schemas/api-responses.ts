/**
 * API Response Schemas for Integration Tests
 *
 * Zod schemas for validating API responses in integration tests.
 */

import { z } from 'zod';

/**
 * Schema for health check responses
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  env: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Base post schema
 */
export const PostSchema = z.object({
  id: z.string(),
  content: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string().or(z.date()).optional(),
  type: z.string().optional(),
});
export type Post = z.infer<typeof PostSchema>;

/**
 * Schema for posts API response
 */
export const PostsResponseSchema = z.object({
  success: z.literal(true),
  posts: z.array(PostSchema),
});
export type PostsResponse = z.infer<typeof PostsResponseSchema>;

/**
 * Schema for feed API response
 */
export const FeedResponseSchema = z.object({
  success: z.literal(true),
  posts: z.array(PostSchema),
  hasMore: z.boolean().optional(),
  nextCursor: z.string().optional(),
});
export type FeedResponse = z.infer<typeof FeedResponseSchema>;

/**
 * Schema for user profile
 */
export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  reputation: z.number().optional(),
  pointsBalance: z.number().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Schema for user API response
 */
export const UserResponseSchema = z.object({
  success: z.literal(true),
  user: UserProfileSchema,
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

/**
 * Schema for prediction market
 */
export const PredictionMarketSchema = z.object({
  id: z.string(),
  question: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'resolved', 'cancelled']).optional(),
  yesPrice: z.number().optional(),
  noPrice: z.number().optional(),
  totalVolume: z.number().optional(),
  expiresAt: z.string().or(z.date()).optional(),
});
export type PredictionMarket = z.infer<typeof PredictionMarketSchema>;

/**
 * Schema for markets API response
 */
export const MarketsResponseSchema = z.object({
  success: z.literal(true),
  markets: z.array(PredictionMarketSchema),
});
export type MarketsResponse = z.infer<typeof MarketsResponseSchema>;

/**
 * Schema for perpetual position
 */
export const PerpPositionSchema = z.object({
  id: z.string(),
  ticker: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  size: z.number(),
  entryPrice: z.number(),
  leverage: z.number(),
  unrealizedPnl: z.number().optional(),
});
export type PerpPosition = z.infer<typeof PerpPositionSchema>;

/**
 * Schema for positions API response
 */
export const PositionsResponseSchema = z.object({
  success: z.literal(true),
  positions: z.array(PerpPositionSchema),
});
export type PositionsResponse = z.infer<typeof PositionsResponseSchema>;

/**
 * Schema for error responses
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Schema for leaderboard entry
 */
export const LeaderboardEntrySchema = z.object({
  rank: z.number(),
  userId: z.string(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  score: z.number(),
  avatar: z.string().optional(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/**
 * Schema for leaderboard API response
 */
export const LeaderboardResponseSchema = z.object({
  success: z.literal(true),
  entries: z.array(LeaderboardEntrySchema),
  totalEntries: z.number().optional(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

/**
 * Schema for agent configuration
 */
export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string().optional(),
  autonomousTrading: z.boolean().optional(),
  riskTolerance: z.number().optional(),
  maxPositionSize: z.number().optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Schema for agent API response
 */
export const AgentResponseSchema = z.object({
  success: z.literal(true),
  agent: AgentConfigSchema,
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

/**
 * Schema for cron job result
 */
export const CronResultSchema = z.object({
  success: z.boolean(),
  tickId: z.string().optional(),
  processedCount: z.number().optional(),
  duration: z.number().optional(),
  errors: z.array(z.string()).optional(),
});
export type CronResult = z.infer<typeof CronResultSchema>;
