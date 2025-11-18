'use client';

import { MarketOverviewPanel } from './MarketOverviewPanel';
import { PredictionTrendingPanel } from './PredictionTrendingPanel';
import { TopMoversPanel } from './TopMoversPanel';

type MarketsWidgetSidebarProps = {
  onMarketClick?: (market: {
    ticker: string;
    name: string;
    currentPrice: number;
    change24h: number;
    changePercent24h: number;
    organizationId?: string;
    high24h?: number;
    low24h?: number;
    volume24h?: number;
    openInterest?: number;
    fundingRate?: {
      rate: number;
      nextFundingTime: string;
      predictedRate: number;
    };
    maxLeverage?: number;
    minOrderSize?: number;
  }) => void;
  onPredictionClick?: (marketId: string) => void;
};

export function MarketsWidgetSidebar({
  onMarketClick,
  onPredictionClick,
}: MarketsWidgetSidebarProps) {
  return (
    <div className="hidden w-96 shrink-0 flex-col gap-4 overflow-y-auto bg-sidebar p-4 xl:flex">
      {/* Top: Market Overview */}
      <div className="shrink-0">
        <MarketOverviewPanel />
      </div>

      {/* Middle: Top Movers */}
      <div className="flex min-h-[200px] flex-1 flex-col">
        <TopMoversPanel onMarketClick={onMarketClick} />
      </div>

      {/* Bottom: Prediction Markets */}
      <div className="flex min-h-[200px] flex-1 flex-col">
        <PredictionTrendingPanel onMarketClick={onPredictionClick} />
      </div>
    </div>
  );
}
