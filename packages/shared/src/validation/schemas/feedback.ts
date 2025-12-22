/**
 * Feedback-related validation schemas
 */

import { z } from 'zod';

/**
 * Feedback submission schema
 * Used for submitting user feedback/ratings
 * Used by: POST /api/feedback/submit
 */
export const FeedbackSubmitSchema = z
  .object({
    toUserId: z.string().min(1, 'toUserId is required'),
    score: z.number().min(0).max(100).optional(),
    stars: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(5000).optional(),
    category: z.string().min(1).optional(),
  })
  .refine(({ score, stars }) => score !== undefined || stars !== undefined, {
    message: 'Either score or stars must be provided',
    path: ['score'],
  });

export type FeedbackSubmit = z.infer<typeof FeedbackSubmitSchema>;

/**
 * User-to-Agent feedback schema
 * Used by: POST /api/feedback/user-to-agent
 */
export const UserToAgentFeedbackSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  score: z.number().min(0).max(100),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  category: z.string().min(1).optional(),
  interactionType: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UserToAgentFeedback = z.infer<typeof UserToAgentFeedbackSchema>;

/**
 * User-to-Agent feedback query schema
 * Used by: GET /api/feedback/user-to-agent
 */
export const UserToAgentFeedbackQuerySchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type UserToAgentFeedbackQuery = z.infer<
  typeof UserToAgentFeedbackQuerySchema
>;

/**
 * Agent-to-User feedback schema
 * Used by: POST /api/feedback/agent-to-user
 */
export const AgentToUserFeedbackSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  toUserId: z.string().min(1, 'toUserId is required'),
  score: z.number().min(0).max(100),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  category: z.string().min(1).optional(),
  interactionType: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AgentToUserFeedback = z.infer<typeof AgentToUserFeedbackSchema>;

/**
 * Agent-to-User feedback query schema
 * Used by: GET /api/feedback/agent-to-user
 */
export const AgentToUserFeedbackQuerySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type AgentToUserFeedbackQuery = z.infer<
  typeof AgentToUserFeedbackQuerySchema
>;

/**
 * Agent-to-Game feedback schema
 * Used by: POST /api/feedback/agent-to-game
 */
export const AgentToGameFeedbackSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  gameId: z.string().min(1, 'gameId is required'),
  score: z.number().min(0).max(100),
  comment: z.string().max(5000).optional(),
  tags: z.array(z.string().min(1)).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AgentToGameFeedback = z.infer<typeof AgentToGameFeedbackSchema>;

/**
 * Game-to-Agent feedback schema
 * Used by: POST /api/feedback/game-to-agent
 */
export const GameFeedbackSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  gameId: z.string().min(1, 'gameId is required'),
  score: z.number().min(0).max(100),
  won: z.boolean(),
  comment: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GameFeedback = z.infer<typeof GameFeedbackSchema>;

/**
 * Game metrics for auto-generate feedback
 */
export const GameMetricsSchema = z.object({
  won: z.boolean(),
  pnl: z.number(),
  positionsClosed: z.number(),
  finalBalance: z.number(),
  startingBalance: z.number(),
  decisionsCorrect: z.number(),
  decisionsTotal: z.number(),
  timeToComplete: z.number().optional(),
  riskManagement: z.number().optional(),
});

export type GameMetrics = z.infer<typeof GameMetricsSchema>;

/**
 * Trade metrics for auto-generate feedback
 */
export const TradeMetricsSchema = z.object({
  profitable: z.boolean(),
  roi: z.number(),
  holdingPeriod: z.number(),
  timingScore: z.number(),
  riskScore: z.number(),
});

export type TradeMetrics = z.infer<typeof TradeMetricsSchema>;

/**
 * Game feedback request schema for auto-generate
 */
export const GameFeedbackRequestSchema = z.object({
  type: z.literal('game'),
  agentId: z.string().min(1),
  gameId: z.string().min(1),
  metrics: GameMetricsSchema,
});

export type GameFeedbackRequest = z.infer<typeof GameFeedbackRequestSchema>;

/**
 * Trade feedback request schema for auto-generate
 */
export const TradeFeedbackRequestSchema = z.object({
  type: z.literal('trade'),
  agentId: z.string().min(1),
  tradeId: z.string().min(1),
  metrics: TradeMetricsSchema,
});

export type TradeFeedbackRequest = z.infer<typeof TradeFeedbackRequestSchema>;

/**
 * Auto-generate feedback request schema
 * Used by: POST /api/feedback/auto-generate
 */
export const AutoGenerateFeedbackRequestSchema = z.discriminatedUnion('type', [
  GameFeedbackRequestSchema,
  TradeFeedbackRequestSchema,
]);

export type AutoGenerateFeedbackRequest = z.infer<
  typeof AutoGenerateFeedbackRequestSchema
>;
