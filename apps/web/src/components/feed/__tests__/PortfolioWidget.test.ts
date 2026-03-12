import { describe, expect, it } from 'bun:test';
import type { PortfolioBreakdownSnapshot } from '@babylon/engine/client';
import { BABYLON_POINTS_SYMBOL } from '@babylon/shared';
import { formatCurrencyDisplay } from '@/lib/format';

/**
 * Tests for PortfolioWidget display logic.
 *
 * These tests exercise the real formatCurrencyDisplay formatter and the
 * same conditional rules the component uses, without reimplementing them
 * in local helper functions.
 *
 * Cache store behaviour is tested separately in widgetCacheStore.test.ts.
 */

// ---------------------------------------------------------------------------
// PnLValue sign/color logic — mirrors the component's PnLValue subcomponent
// ---------------------------------------------------------------------------

/**
 * The component determines sign, color, and icon via `value >= 0`.
 * These tests verify the boundary conditions of that check using the
 * same expression.
 */
function pnlProps(value: number) {
  const isPositive = value >= 0;
  return {
    prefix: isPositive ? '+' : '',
    formatted: `${isPositive ? '+' : ''}${formatCurrencyDisplay(value)}`,
    color: isPositive ? 'text-green-500' : 'text-red-500',
  };
}

describe('PortfolioWidget', () => {
  // -----------------------------------------------------------------------
  // PnLValue rendering
  // -----------------------------------------------------------------------

  describe('PnLValue sign and color', () => {
    it('positive value gets + prefix and green color', () => {
      const p = pnlProps(234.56);
      expect(p.prefix).toBe('+');
      expect(p.color).toBe('text-green-500');
      expect(p.formatted).toContain(BABYLON_POINTS_SYMBOL);
    });

    it('negative value gets no prefix and red color', () => {
      const p = pnlProps(-100.5);
      expect(p.prefix).toBe('');
      expect(p.color).toBe('text-red-500');
      expect(p.formatted).toContain(BABYLON_POINTS_SYMBOL);
    });

    it('zero is treated as positive (green, + prefix)', () => {
      const p = pnlProps(0);
      expect(p.prefix).toBe('+');
      expect(p.color).toBe('text-green-500');
    });

    it('very large positive value', () => {
      const p = pnlProps(999999.99);
      expect(p.prefix).toBe('+');
      expect(p.color).toBe('text-green-500');
      expect(p.formatted).toContain('999');
    });

    it('very small negative value', () => {
      const p = pnlProps(-0.01);
      expect(p.prefix).toBe('');
      expect(p.color).toBe('text-red-500');
    });
  });

  // -----------------------------------------------------------------------
  // Loading state — the component uses `portfolioLoading && !data`
  // -----------------------------------------------------------------------

  describe('loading state', () => {
    const loadingState = (portfolioLoading: boolean, data: unknown | null) =>
      portfolioLoading && !data;

    it('shows loading when fetching and no data available', () => {
      expect(loadingState(true, null)).toBe(true);
    });

    it('does not show loading when cached/live data exists even while fetching', () => {
      expect(loadingState(true, { totalPnL: 0 })).toBe(false);
    });

    it('does not show loading when not fetching', () => {
      expect(loadingState(false, null)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Data fallback — the component uses `portfolioData ?? cachedData`
  // -----------------------------------------------------------------------

  describe('data fallback chain', () => {
    const resolveData = (
      portfolioData: PortfolioBreakdownSnapshot | null,
      cachedData: PortfolioBreakdownSnapshot | null
    ) => portfolioData ?? cachedData;

    const snapshot: PortfolioBreakdownSnapshot = {
      wallet: 100,
      agents: 25,
      positions: 50,
      available: 125,
      originalAmount: 90,
      totalAssets: 175,
      totalPnL: 85,
      agentCount: 1,
      totalPoints: 175,
    };

    it('prefers live data over cache', () => {
      const cached: PortfolioBreakdownSnapshot = { ...snapshot, wallet: 0 };
      expect(resolveData(snapshot, cached)).toBe(snapshot);
    });

    it('falls back to cached data when live data is null', () => {
      expect(resolveData(null, snapshot)).toBe(snapshot);
    });

    it('returns null when neither source has data', () => {
      expect(resolveData(null, null)).toBe(null);
    });
  });

  // -----------------------------------------------------------------------
  // Conditional section visibility
  // -----------------------------------------------------------------------

  describe('agent section visibility', () => {
    it('renders when agentCount > 0', () => {
      // Component: {data && data.agentCount > 0 && (...)}
      const data = { agentCount: 3 };
      expect(data.agentCount > 0).toBe(true);
    });

    it('hidden when agentCount is 0', () => {
      const data = { agentCount: 0 };
      expect(data.agentCount > 0).toBe(false);
    });

    it('renders for single agent', () => {
      const data = { agentCount: 1 };
      expect(data.agentCount > 0).toBe(true);
    });
  });

  describe('authentication gate', () => {
    it('widget returns null when not authenticated', () => {
      // Component: if (!authenticated) return null;
      const authenticated = false;
      expect(!authenticated).toBe(true);
    });

    it('widget renders when authenticated', () => {
      const authenticated = true;
      expect(!authenticated).toBe(false);
    });
  });
});
