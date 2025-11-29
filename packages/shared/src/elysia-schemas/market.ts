/**
 * Market Elysia Type Schemas
 *
 * Schemas for market-related API endpoints (predictions and perpetuals)
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString } from './common';

// ============================================================================
// Prediction Market Schemas
// ============================================================================

/**
 * Prediction market question
 */
export const PredictionQuestionSchema = t.Object({
  id: SnowflakeId,
  questionNumber: t.Number(),
  text: t.String(),
  status: t.Union([
    t.Literal('active'),
    t.Literal('resolved'),
    t.Literal('cancelled'),
  ]),
  createdDate: ISODateString,
  resolutionDate: t.Nullable(ISODateString),
  resolvedOutcome: t.Nullable(t.String()),
  scenario: t.Nullable(SnowflakeId),
  yesShares: t.Number(),
  noShares: t.Number(),
  oracleCommitTxHash: t.Nullable(t.String()),
  oracleRevealTxHash: t.Nullable(t.String()),
  oraclePublishedAt: t.Nullable(ISODateString),
  userPosition: t.Nullable(
    t.Object({
      id: SnowflakeId,
      marketId: SnowflakeId,
      side: t.Union([t.Literal('YES'), t.Literal('NO')]),
      shares: t.Number(),
      avgPrice: t.Number(),
      currentPrice: t.Number(),
      currentProbability: t.Number(),
      currentValue: t.Number(),
      costBasis: t.Number(),
      unrealizedPnL: t.Number(),
      maxPayout: t.Number(),
      resolved: t.Boolean(),
      resolution: t.Nullable(t.String()),
    })
  ),
  userPositions: t.Optional(t.Array(t.Object({
    id: SnowflakeId,
    marketId: SnowflakeId,
    side: t.Union([t.Literal('YES'), t.Literal('NO')]),
    shares: t.Number(),
    avgPrice: t.Number(),
    currentPrice: t.Number(),
    currentProbability: t.Number(),
    currentValue: t.Number(),
    costBasis: t.Number(),
    unrealizedPnL: t.Number(),
    maxPayout: t.Number(),
    resolved: t.Boolean(),
    resolution: t.Nullable(t.String()),
  }))),
});

/**
 * Prediction markets response
 */
export const PredictionMarketsResponseSchema = t.Object({
  success: t.Boolean(),
  questions: t.Array(PredictionQuestionSchema),
  count: t.Number(),
});

/**
 * Prediction market query
 */
export const PredictionMarketsQuerySchema = t.Object({
  userId: t.Optional(SnowflakeId),
});

/**
 * Buy/Sell prediction shares request
 */
export const PredictionTradeRequestSchema = t.Object({
  side: t.Union([t.Literal('yes'), t.Literal('no')]),
  amount: t.Number({ minimum: 0.01 }),
});

/**
 * Buy/Sell prediction shares response
 */
export const PredictionTradeResponseSchema = t.Object({
  success: t.Boolean(),
  trade: t.Object({
    id: SnowflakeId,
    marketId: SnowflakeId,
    userId: SnowflakeId,
    side: t.Union([t.Literal('yes'), t.Literal('no')]),
    shares: t.Number(),
    price: t.Number(),
    cost: t.Number(),
    timestamp: ISODateString,
  }),
  newBalance: t.Number(),
  newPosition: t.Object({
    shares: t.Number(),
    avgPrice: t.Number(),
    currentValue: t.Number(),
    unrealizedPnL: t.Number(),
  }),
});

// ============================================================================
// Perpetual Market Schemas
// ============================================================================

/**
 * Organization/Stock for perps
 */
export const PerpOrganizationSchema = t.Object({
  id: SnowflakeId,
  name: t.String(),
  ticker: t.String(),
  type: t.String(),
  currentPrice: t.Number(),
  priceChange24h: t.Number(),
  priceChangePercent24h: t.Number(),
  volume24h: t.Number(),
  openInterest: t.Number(),
  fundingRate: t.Number(),
  imageUrl: t.Nullable(URLString),
});

/**
 * Perp position
 */
export const PerpPositionSchema = t.Object({
  id: SnowflakeId,
  userId: SnowflakeId,
  organizationId: SnowflakeId,
  ticker: t.String(),
  side: t.Union([t.Literal('long'), t.Literal('short')]),
  size: t.Number(),
  leverage: t.Number(),
  entryPrice: t.Number(),
  currentPrice: t.Number(),
  liquidationPrice: t.Number(),
  margin: t.Number(),
  unrealizedPnL: t.Number(),
  unrealizedPnLPercent: t.Number(),
  openedAt: ISODateString,
  closedAt: t.Nullable(ISODateString),
  organization: t.Optional(PerpOrganizationSchema),
});

/**
 * Perp markets list response
 */
export const PerpMarketsResponseSchema = t.Object({
  success: t.Boolean(),
  markets: t.Array(PerpOrganizationSchema),
  count: t.Number(),
});

/**
 * User perp positions response
 */
export const PerpPositionsResponseSchema = t.Object({
  success: t.Boolean(),
  positions: t.Array(PerpPositionSchema),
  totalUnrealizedPnL: t.Number(),
  totalMargin: t.Number(),
});

/**
 * Open perp position request
 */
export const OpenPerpPositionRequestSchema = t.Object({
  side: t.Union([t.Literal('long'), t.Literal('short')]),
  size: t.Number({ minimum: 0.01 }),
  leverage: t.Number({ minimum: 1, maximum: 100 }),
});

/**
 * Open perp position response
 */
export const OpenPerpPositionResponseSchema = t.Object({
  success: t.Boolean(),
  position: PerpPositionSchema,
  newBalance: t.Number(),
});

/**
 * Close perp position request
 */
export const ClosePerpPositionRequestSchema = t.Object({
  percentage: t.Optional(t.Number({ minimum: 0.01, maximum: 100, default: 100 })),
});

/**
 * Close perp position response
 */
export const ClosePerpPositionResponseSchema = t.Object({
  success: t.Boolean(),
  closedPosition: PerpPositionSchema,
  realizedPnL: t.Number(),
  newBalance: t.Number(),
});

