/**
 * Cron Elysia Type Schemas
 *
 * Schemas for cron job API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId } from './common';

/**
 * Cron game state
 */
export const CronGameStateSchema = t.Object({
  id: SnowflakeId,
  isRunning: t.Boolean(),
  currentDay: t.Number(),
  pausedAt: t.Nullable(ISODateString),
  lastTickAt: t.Nullable(ISODateString),
});

/**
 * Game tick result
 */
export const GameTickResultSchema = t.Object({
  postsCreated: t.Number(),
  eventsCreated: t.Number(),
  marketsUpdated: t.Number(),
  agentsProcessed: t.Optional(t.Number()),
});

/**
 * Lookahead generation result
 */
export const LookaheadResultSchema = t.Object({
  generated: t.Boolean(),
  windowsGenerated: t.Number(),
  newLatestTimestamp: t.Optional(ISODateString),
});

/**
 * Game tick response (success)
 */
export const GameTickResponseSchema = t.Object({
  success: t.Boolean(),
  skipped: t.Optional(t.Boolean()),
  reason: t.Optional(t.String()),
  duration: t.Optional(t.Number()),
  bufferMinutes: t.Optional(t.Number()),
  bufferSufficient: t.Optional(t.Boolean()),
  lookahead: t.Optional(LookaheadResultSchema),
  result: t.Optional(GameTickResultSchema),
  gameState: t.Optional(CronGameStateSchema),
  relayStatus: t.Optional(t.Number()),
});

/**
 * Agent tick result
 */
export const AgentTickResultSchema = t.Object({
  agentsProcessed: t.Number(),
  postsCreated: t.Number(),
  commentsCreated: t.Number(),
  tradesExecuted: t.Number(),
  dmsSent: t.Number(),
  groupMessagesSent: t.Number(),
  errors: t.Number(),
});

/**
 * Agent tick response
 */
export const AgentTickResponseSchema = t.Object({
  success: t.Boolean(),
  skipped: t.Optional(t.Boolean()),
  reason: t.Optional(t.String()),
  duration: t.Optional(t.Number()),
  result: t.Optional(AgentTickResultSchema),
});

/**
 * Health check response
 */
export const CronHealthCheckResponseSchema = t.Object({
  success: t.Boolean(),
  timestamp: ISODateString,
  gameStatus: t.Object({
    isRunning: t.Boolean(),
    currentDay: t.Number(),
    lastTickAt: t.Nullable(ISODateString),
  }),
  agentStatus: t.Object({
    totalAgents: t.Number(),
    activeAgents: t.Number(),
    lastTickAt: t.Nullable(ISODateString),
  }),
});

/**
 * Training tick response
 */
export const TrainingTickResponseSchema = t.Object({
  success: t.Boolean(),
  skipped: t.Optional(t.Boolean()),
  reason: t.Optional(t.String()),
  duration: t.Optional(t.Number()),
  samplesCollected: t.Optional(t.Number()),
  trainingTriggered: t.Optional(t.Boolean()),
});

