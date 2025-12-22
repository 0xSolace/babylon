/**
 * Market and trading validation schemas
 */
import { z } from 'zod';

import {
  NumericStringSchema,
  PaginationSchema,
  SnowflakeIdSchema,
  UserIdSchema,
} from './common';

/**
 * Open perp position schema
 * NOTE: Uses lowercase 'long' | 'short' to match core types
 */
export const OpenPerpPositionSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Ticker must be uppercase alphanumeric'),
  side: z.enum(['long', 'short']),
  size: NumericStringSchema, // Position size as string for precision
  leverage: z
    .number()
    .int()
    .min(1)
    .max(100, 'Leverage must be between 1x and 100x'),
  slippage: z.number().min(0).max(0.1).default(0.01), // 1% default max slippage
});

/**
 * Close perp position schema
 *
 * NOTE: percentage and slippage fields are defined for future support but
 * are not currently implemented in PerpMarketService. Positions are closed
 * entirely at market price.
 */
export const ClosePerpPositionSchema = z.object({
  /** Close partial position (0-1, e.g., 0.5 = close 50%). Defaults to 1 (full close). */
  percentage: z.number().min(0).max(1).optional(),
  /** Max slippage tolerance (0-1, e.g., 0.01 = 1%). Rejects if price moved beyond this. */
  slippage: z.number().min(0).max(0.1).default(0.01),
});

/**
 * Buy prediction market shares schema
 */
export const BuyPredictionSharesSchema = z.object({
  amount: NumericStringSchema, // Purchase amount as string for precision
  maxPrice: z.number().min(0).max(1).optional(), // Max price willing to pay (0-1)
  slippage: z.number().min(0).max(0.1).default(0.05), // 5% default
});

/**
 * Sell prediction market shares schema
 */
export const SellPredictionSharesSchema = z
  .object({
    shares: NumericStringSchema.optional(), // Sell specific number of shares (string for precision)
    percentage: z.number().min(0).max(1).optional(), // Or sell percentage of holdings
    minPrice: z.number().min(0).max(1).optional(), // Minimum price willing to accept
    slippage: z.number().min(0).max(0.1).default(0.05),
  })
  .refine(
    (data) => {
      // Must specify either shares or percentage, but not both
      return (data.shares !== undefined) !== (data.percentage !== undefined);
    },
    {
      message: 'Specify either shares or percentage, but not both',
    }
  );

/**
 * Market query schema
 */
export const MarketQuerySchema = PaginationSchema.extend({
  status: z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED']).optional(),
  category: z.string().optional(),
  minLiquidity: z.coerce.number().nonnegative().optional(),
  maxLiquidity: z.coerce.number().nonnegative().optional(),
  search: z.string().optional(),
});

/**
 * User positions query schema
 */
export const UserPositionsQuerySchema = z.object({
  userId: UserIdSchema,
  type: z.enum(['perp', 'prediction', 'all']).default('all'),
  status: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
});

/**
 * Position ID param schema
 */
export const PositionIdParamSchema = z.object({
  positionId: SnowflakeIdSchema,
});

/**
 * Market ID param schema
 */
export const MarketIdParamSchema = z.object({
  marketId: SnowflakeIdSchema,
});

/**
 * Ticker param schema (strict uppercase)
 * Use for APIs that require uppercase tickers
 */
export const TickerParamSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9-]+$/),
});

/**
 * Ticker param schema (permissive)
 * Use for APIs that accept any case ticker
 */
export const TickerParamPermissiveSchema = z.object({
  ticker: z.string().min(1).max(20),
});

// =============================================================================
// Market API Response Schemas (for store validation)
// =============================================================================

/**
 * Funding rate schema for perp markets
 */
export const FundingRateSchema = z.object({
  rate: z.number(),
  nextFundingTime: z.string(),
  predictedRate: z.number(),
});

/**
 * Perp market API response schema
 * Used for validating data from /api/markets/perps
 */
export const PerpMarketSchema = z.object({
  ticker: z.string(),
  organizationId: z.string(),
  name: z.string(),
  currentPrice: z.number(),
  change24h: z.number(),
  changePercent24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number(),
  openInterest: z.number(),
  fundingRate: FundingRateSchema,
  maxLeverage: z.number(),
  minOrderSize: z.number(),
});

export type PerpMarketFromSchema = z.infer<typeof PerpMarketSchema>;

/**
 * Perp markets API response schema
 */
export const PerpMarketsResponseSchema = z.object({
  markets: z.array(PerpMarketSchema),
});

/**
 * Prediction market API response schema
 * Used for validating data from /api/markets/predictions
 */
export const PredictionMarketSchema = z.object({
  id: z.union([z.number(), z.string()]),
  text: z.string(),
  status: z.enum(['active', 'resolved', 'cancelled']),
  createdDate: z.string().optional(),
  resolutionDate: z.string().optional(),
  resolvedOutcome: z.boolean().optional(),
  scenario: z.number(),
  yesShares: z.number().optional(),
  noShares: z.number().optional(),
  oracleCommitTxHash: z.string().nullable().optional(),
  oracleRevealTxHash: z.string().nullable().optional(),
  oraclePublishedAt: z.string().nullable().optional(),
});

export type PredictionMarketFromSchema = z.infer<typeof PredictionMarketSchema>;

/**
 * Prediction markets API response schema
 */
export const PredictionMarketsResponseSchema = z.object({
  questions: z.array(PredictionMarketSchema),
});

/**
 * History query schema for price/market history endpoints
 * Handles null values from query params and applies sensible defaults
 */
export const HistoryQuerySchema = z.object({
  limit: z
    .preprocess(
      (value) => (value === null ? undefined : value),
      z.coerce.number().min(1).max(1000)
    )
    .optional()
    .default(200),
});

// Type exports
export type OpenPerpPosition = z.infer<typeof OpenPerpPositionSchema>;
export type ClosePerpPosition = z.infer<typeof ClosePerpPositionSchema>;
export type BuyPredictionShares = z.infer<typeof BuyPredictionSharesSchema>;
export type SellPredictionShares = z.infer<typeof SellPredictionSharesSchema>;
export type MarketQuery = z.infer<typeof MarketQuerySchema>;
export type UserPositionsQuery = z.infer<typeof UserPositionsQuerySchema>;
export type PositionIdParam = z.infer<typeof PositionIdParamSchema>;
export type MarketIdParam = z.infer<typeof MarketIdParamSchema>;
export type TickerParam = z.infer<typeof TickerParamSchema>;
export type TickerParamPermissive = z.infer<typeof TickerParamPermissiveSchema>;
// Note: FundingRate, PerpMarket types already exported from perps-types.ts
// Use PerpMarketFromSchema and PredictionMarketFromSchema for Zod inferred types
export type PerpMarketsResponse = z.infer<typeof PerpMarketsResponseSchema>;
export type PredictionMarketsResponse = z.infer<
  typeof PredictionMarketsResponseSchema
>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
