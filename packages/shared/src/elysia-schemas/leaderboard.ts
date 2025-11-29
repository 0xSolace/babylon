/**
 * Leaderboard Elysia Type Schemas
 *
 * Schemas for leaderboard API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString } from './common';

/**
 * Leaderboard user entry
 */
export const LeaderboardEntrySchema = t.Object({
  rank: t.Number(),
  id: SnowflakeId,
  username: t.Nullable(t.String()),
  displayName: t.Nullable(t.String()),
  profileImageUrl: t.Nullable(URLString),
  points: t.Number(),
  earnedPoints: t.Optional(t.Number()),
  referralPoints: t.Optional(t.Number()),
  createdAt: t.Optional(ISODateString),
});

/**
 * Leaderboard pagination
 */
export const LeaderboardPaginationSchema = t.Object({
  page: t.Number(),
  pageSize: t.Number(),
  totalCount: t.Number(),
  totalPages: t.Number(),
});

/**
 * Leaderboard query parameters
 */
export const LeaderboardQuerySchema = t.Object({
  page: t.Optional(t.Number({ default: 1, minimum: 1 })),
  pageSize: t.Optional(t.Number({ default: 100, minimum: 1, maximum: 100 })),
  minPoints: t.Optional(t.Number({ default: 500, minimum: 0 })),
  pointsType: t.Optional(
    t.Union([t.Literal('all'), t.Literal('earned'), t.Literal('referral')])
  ),
});

/**
 * Leaderboard response
 */
export const LeaderboardResponseSchema = t.Object({
  leaderboard: t.Array(LeaderboardEntrySchema),
  pagination: LeaderboardPaginationSchema,
  minPoints: t.Number(),
  pointsCategory: t.String(),
});

