import type { PerpCloseInput, PerpMarketRecord, PerpOpenInput, PerpServiceDeps, PerpTradeResult } from './types';
/** Summary of price update operations */
export interface PriceUpdateSummary {
    marketsUpdated: number;
    positionsUpdated: number;
    liquidations: number;
    errors: Array<{
        key: string;
        positionId?: string;
        error: string;
    }>;
}
/**
 * PerpMarketService
 *
 * Thin domain service wrapper for perpetual markets.
 * Goal: expose a single market view and clean open/close flows,
 * decoupled from app framework concerns.
 */
export declare class PerpMarketService {
    private readonly db;
    private readonly deps;
    constructor(deps: PerpServiceDeps);
    /**
     * Return current market snapshot (single source of truth).
     */
    getMarketsSnapshot(): Promise<PerpMarketRecord[]>;
    /**
     * Open a perp position.
     *
     * @param input.maxSlippage - Maximum price deviation allowed from expected (0-1).
     */
    openPosition(input: PerpOpenInput): Promise<PerpTradeResult>;
    /**
     * Close a perp position (full or partial).
     *
     * @param input.percentage - Close a portion (0-1). Defaults to 1 (full close).
     * @param input.maxSlippage - Maximum price deviation from entry. Rejects if exceeded.
     */
    closePosition(input: PerpCloseInput): Promise<PerpTradeResult>;
    /**
     * Update open positions with new prices, apply liquidations, and update market stats.
     *
     * @returns Summary of updates applied, including any errors encountered.
     */
    applyPriceUpdates(priceUpdates: Map<string, number> | Record<string, number> | Array<[string, number]>): Promise<PriceUpdateSummary>;
    /**
     * Run a funding step (8h by default), updating fundingPaid per position and fundingRate per market.
     * Funding is accrued to positions (not settled to wallets here; PnL is adjusted on close).
     */
    processFundingStep(): Promise<void>;
    /**
     * Convenience: run price updates + funding in one pass.
     *
     * @returns Summary of price update operations (if priceUpdates provided).
     */
    processFundingAndLiquidations(priceUpdates?: Map<string, number> | Record<string, number> | Array<[string, number]>): Promise<PriceUpdateSummary | void>;
    private calculateFee;
    private calculateMaxPositionSize;
    /**
     * Calculate mark price from spot price and funding rate.
     *
     * Mark price = Spot price × (1 + funding premium)
     * Funding premium = annual funding rate / periods per year
     *
     * This helps prevent unnecessary liquidations during short-term volatility.
     */
    private calculateMarkPrice;
}
//# sourceMappingURL=PerpMarketService.d.ts.map