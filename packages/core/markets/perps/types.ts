import type {
  BroadcastPort,
  CachePort,
  ClockPort,
  FeeConfig,
  FeeProcessor,
  WalletPort,
} from '../shared/common';

// Import types from schemas (single source of truth)
import type { PerpCloseInput, PerpOpenInput, PerpSide } from './schemas';
// Re-export for consumers
export type { PerpCloseInput, PerpOpenInput, PerpSide };

// Re-export schemas for runtime validation
export {
  PerpCloseInputSchema,
  PerpOpenInputSchema,
  PerpSideSchema,
} from './schemas';

export interface PerpMarketRecord {
  ticker: string;
  organizationId: string;
  name?: string;
  currentPrice: number;
  /** Price from 24 hours ago (for accurate change calculation) */
  price24hAgo?: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: {
    rate: number;
    nextFundingTime: string;
    predictedRate: number;
  };
  maxLeverage: number;
  minOrderSize: number;
  markPrice?: number;
  indexPrice?: number;
}

export interface PerpPositionRecord {
  id: string;
  userId: string;
  ticker: string;
  organizationId: string;
  side: PerpSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  fundingPaid: number;
  openedAt: Date;
  lastUpdated: Date;
  closedAt?: Date | null;
  realizedPnL?: number | null;
}

export interface PerpDbPort {
  listMarkets(): Promise<PerpMarketRecord[]>;
  listOpenPositions(): Promise<PerpPositionRecord[]>;
  getPositionById(id: string): Promise<PerpPositionRecord | null>;
  /** Get all open positions for a user */
  getOpenPositionsByUser(userId: string): Promise<PerpPositionRecord[]>;
  /** Get existing open position for user on specific ticker (for consolidation) */
  getOpenPositionByUserAndTicker(
    userId: string,
    ticker: string
  ): Promise<PerpPositionRecord | null>;
  upsertPosition(
    position: Omit<PerpPositionRecord, 'id'> & { id?: string }
  ): Promise<PerpPositionRecord>;
  /**
   * Execute operations within a transaction for atomicity.
   * If the callback throws, all changes are rolled back.
   */
  transaction<T>(fn: (tx: PerpDbPort) => Promise<T>): Promise<T>;
  updateOpenPosition(
    positionId: string,
    updates: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
        | 'fundingPaid'
        | 'liquidationPrice'
        | 'lastUpdated'
        | 'size'
      >
    >
  ): Promise<void>;
  closePosition(
    positionId: string,
    updates: Partial<
      Pick<
        PerpPositionRecord,
        | 'currentPrice'
        | 'closedAt'
        | 'realizedPnL'
        | 'unrealizedPnL'
        | 'unrealizedPnLPercent'
      >
    >
  ): Promise<void>;
  updateMarketStats(
    ticker: string,
    updates: Partial<
      Pick<
        PerpMarketRecord,
        | 'currentPrice'
        | 'price24hAgo'
        | 'change24h'
        | 'changePercent24h'
        | 'high24h'
        | 'low24h'
        | 'volume24h'
        | 'openInterest'
        | 'fundingRate'
        | 'markPrice'
        | 'indexPrice'
      >
    >
  ): Promise<void>;
}

// DTOs are now defined via Zod schemas in ./schemas.ts and re-exported above

export interface PerpTradeResult {
  positionId: string;
  ticker: string;
  side: PerpSide;
  size: number;
  leverage: number;
  entryPrice: number;
  exitPrice?: number;
  liquidationPrice: number;
  marginPaid?: number;
  realizedPnL?: number;
  feePaid: number;
  balance?: number;
  /** If partial close, the remaining position size */
  remainingSize?: number;
  /** True if position was fully closed */
  fullyClosed?: boolean;
}

// Service deps bundle (optional helper)
export interface PerpServiceDeps {
  db: PerpDbPort;
  wallet: WalletPort;
  broadcast?: BroadcastPort;
  cache?: CachePort;
  clock?: ClockPort;
  fees: FeeConfig;
  feeProcessor?: FeeProcessor;
}
