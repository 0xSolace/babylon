/**
 * Market Decision Types
 *
 * Types for LLM-driven NPC trading decisions.
 * Uses z.infer<> from @babylon/shared to avoid duplicate type definitions.
 */

import type {
  ExecutedTradeSchema,
  MarketActionSchema,
  MarketTypeSchema,
  TradingDecisionSchema,
} from '@babylon/shared';
import type { z } from 'zod';

// Re-export types derived from Zod schemas
export type MarketAction = z.infer<typeof MarketActionSchema>;
export type MarketType = z.infer<typeof MarketTypeSchema>;
export type TradingDecision = z.infer<typeof TradingDecisionSchema>;
export type ExecutedTrade = z.infer<typeof ExecutedTradeSchema>;

export interface TradingExecutionResult {
  totalDecisions: number;
  successfulTrades: number;
  failedTrades: number;
  holdDecisions: number;
  totalVolumePerp: number;
  totalVolumePrediction: number;
  errors: Array<{
    npcId: string;
    decision: TradingDecision;
    error: string;
  }>;
  executedTrades: ExecutedTrade[];
}

export interface TradeImpact {
  ticker?: string;
  marketId?: number;
  longVolume: number;
  shortVolume: number;
  yesVolume: number;
  noVolume: number;
  netSentiment: number;
  priceImpact: number;
}
