/**
 * Trade Elysia Type Schemas
 *
 * Schemas for trading feed API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString } from './common';

/**
 * Trade user profile
 */
export const TradeUserSchema = t.Object({
  id: SnowflakeId,
  username: t.Nullable(t.String()),
  displayName: t.Nullable(t.String()),
  profileImageUrl: t.Nullable(URLString),
  isActor: t.Boolean(),
});

/**
 * Balance transaction trade
 */
export const BalanceTradeSchema = t.Object({
  type: t.Literal('balance'),
  id: SnowflakeId,
  timestamp: ISODateString,
  user: t.Nullable(TradeUserSchema),
  amount: t.String(),
  balanceBefore: t.String(),
  balanceAfter: t.String(),
  transactionType: t.String(),
  description: t.Nullable(t.String()),
  relatedId: t.Nullable(t.String()),
});

/**
 * Point transfer trade
 */
export const TransferTradeSchema = t.Object({
  type: t.Literal('transfer'),
  id: SnowflakeId,
  timestamp: ISODateString,
  user: t.Nullable(TradeUserSchema),
  otherParty: t.Nullable(TradeUserSchema),
  amount: t.Number(),
  pointsBefore: t.Number(),
  pointsAfter: t.Number(),
  direction: t.Union([t.Literal('sent'), t.Literal('received')]),
  message: t.Optional(t.String()),
});

/**
 * NPC/Agent trade
 */
export const NPCTradeSchema = t.Object({
  type: t.Literal('npc'),
  id: SnowflakeId,
  timestamp: ISODateString,
  user: t.Nullable(TradeUserSchema),
  marketType: t.String(),
  ticker: t.Nullable(t.String()),
  marketId: t.Nullable(SnowflakeId),
  action: t.String(),
  side: t.Nullable(t.String()),
  amount: t.Nullable(t.String()),
  price: t.Nullable(t.String()),
  sentiment: t.Nullable(t.String()),
  reason: t.Nullable(t.String()),
});

/**
 * Prediction position trade
 */
export const PositionTradeSchema = t.Object({
  type: t.Literal('position'),
  id: SnowflakeId,
  timestamp: ISODateString,
  user: t.Nullable(TradeUserSchema),
  market: t.Nullable(
    t.Object({
      id: SnowflakeId,
      question: t.String(),
      resolved: t.Boolean(),
      resolution: t.Nullable(t.String()),
    })
  ),
  side: t.Union([t.Literal('YES'), t.Literal('NO')]),
  shares: t.String(),
  avgPrice: t.String(),
  createdAt: ISODateString,
});

/**
 * Perp position trade
 */
export const PerpTradeSchema = t.Object({
  type: t.Literal('perp'),
  id: SnowflakeId,
  timestamp: ISODateString,
  user: t.Nullable(TradeUserSchema),
  ticker: t.String(),
  organization: t.Nullable(
    t.Object({
      id: SnowflakeId,
      name: t.String(),
      ticker: t.String(),
    })
  ),
  side: t.Union([t.Literal('long'), t.Literal('short')]),
  entryPrice: t.String(),
  currentPrice: t.String(),
  size: t.String(),
  leverage: t.Number(),
  unrealizedPnL: t.String(),
  liquidationPrice: t.String(),
  closedAt: t.Nullable(ISODateString),
});

/**
 * Combined trade type (union)
 */
export const TradeSchema = t.Union([
  BalanceTradeSchema,
  TransferTradeSchema,
  NPCTradeSchema,
  PositionTradeSchema,
  PerpTradeSchema,
]);

/**
 * Trades query parameters
 */
export const TradesQuerySchema = t.Object({
  limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
  userId: t.Optional(SnowflakeId),
});

/**
 * Trades feed response
 */
export const TradesFeedResponseSchema = t.Object({
  trades: t.Array(TradeSchema),
  total: t.Number(),
  hasMore: t.Boolean(),
});

