'use client';


import { memo } from 'react';
import { CategoryPnLCard } from '@/components/markets/CategoryPnLCard';
import type { PerpMarket } from '@/types/markets';
import type { CategoryPnLData } from '../../_hooks';
import { PerpMarketsTable } from '../tables/PerpMarketsTable';

interface PerpsTabContentProps {
  // Auth state
  authenticated: boolean;

  // P&L data
  perpPnLData: CategoryPnLData | null;
  portfolioLoading: boolean;
  portfolioError: string | null;
  portfolioUpdatedAt: number | null;
  onShowCategoryPnLShare: () => void;
  onRefreshPortfolio: () => Promise<void>;



  // Markets
  filteredMarkets: PerpMarket[];
  onMarketClick: (market: PerpMarket) => void;
  selectedMarketTicker?: string | null;
  onMarketSelect?: (market: PerpMarket) => void;
  onTradeAction?: (market: PerpMarket, side: 'long' | 'short') => void;
}

/**
 * Perps tab content component.
 * Shows category P&L, user positions, and all available perp markets.
 *
 * Wrapped in React.memo to prevent unnecessary re-renders during tab switches.
 */
export const PerpsTabContent = memo(function PerpsTabContent({
  authenticated,
  perpPnLData,
  portfolioLoading,
  portfolioError,
  portfolioUpdatedAt,
  onShowCategoryPnLShare,
  onRefreshPortfolio,
  filteredMarkets,
  onMarketClick,
  selectedMarketTicker,
  onMarketSelect,
  onTradeAction,
}: PerpsTabContentProps) {
  return (
    <div
      id="perps-panel"
      role="tabpanel"
      aria-labelledby="perps-tab"
      className="p-4"
    >
      {authenticated && perpPnLData && (
        <div className="mb-6">
          <CategoryPnLCard
            category="perps"
            data={perpPnLData}
            loading={portfolioLoading}
            error={portfolioError}
            onShare={onShowCategoryPnLShare}
            onRefresh={onRefreshPortfolio}
            lastUpdated={portfolioUpdatedAt}
          />
        </div>
      )}




      <PerpMarketsTable
        markets={filteredMarkets}
        onMarketClick={onMarketSelect || onMarketClick}
        selectedMarketTicker={selectedMarketTicker}
        onTradeAction={onTradeAction}
      />
    </div>
  );
});
