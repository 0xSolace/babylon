import { db as defaultDb, type Transaction } from '@babylon/db';
import type { PerpDbPort, PerpMarketRecord, PerpPositionRecord } from '../../types';
type DrizzleClient = typeof defaultDb | Transaction;
/**
 * Drizzle adapter for PerpDbPort.
 *
 * Notes:
 * - Uses PerpMarketSnapshot as single source for market-level stats.
 * - Generates IDs via snowflake when none provided.
 * - Supports transactions via constructor injection or transaction() method.
 */
export declare class PerpDbAdapter implements PerpDbPort {
    private readonly dbClient;
    constructor(dbClient?: DrizzleClient);
    listMarkets(): Promise<PerpMarketRecord[]>;
    listOpenPositions(): Promise<PerpPositionRecord[]>;
    getPositionById(id: string): Promise<PerpPositionRecord | null>;
    getOpenPositionsByUser(userId: string): Promise<PerpPositionRecord[]>;
    getOpenPositionByUserAndTicker(userId: string, ticker: string): Promise<PerpPositionRecord | null>;
    upsertPosition(position: Omit<PerpPositionRecord, 'id'> & {
        id?: string;
    }): Promise<PerpPositionRecord>;
    updateOpenPosition(positionId: string, updates: Partial<Pick<PerpPositionRecord, 'currentPrice' | 'unrealizedPnL' | 'unrealizedPnLPercent' | 'fundingPaid' | 'liquidationPrice' | 'lastUpdated' | 'size'>>): Promise<void>;
    closePosition(positionId: string, updates: Partial<Pick<PerpPositionRecord, 'currentPrice' | 'closedAt' | 'realizedPnL' | 'unrealizedPnL' | 'unrealizedPnLPercent'>>): Promise<void>;
    updateMarketStats(ticker: string, updates: Partial<Pick<PerpMarketRecord, 'currentPrice' | 'price24hAgo' | 'change24h' | 'changePercent24h' | 'high24h' | 'low24h' | 'volume24h' | 'openInterest' | 'fundingRate' | 'markPrice' | 'indexPrice' | 'maxLeverage' | 'minOrderSize'>>): Promise<void>;
    /**
     * Execute operations within a transaction for atomicity.
     * Creates a new PerpDbAdapter bound to the transaction context.
     */
    transaction<T>(fn: (tx: PerpDbPort) => Promise<T>): Promise<T>;
}
export {};
//# sourceMappingURL=PerpDbAdapter.d.ts.map