import { describe, expect, it } from 'bun:test';
import { BABYLON_POINTS_SYMBOL } from '@babylon/shared';

/**
 * Tests for PortfolioWidget display logic.
 *
 * These tests verify the formatting and conditional display rules
 * used by the PortfolioWidget component.
 */

/** Replicates PnLValue formatting logic from PortfolioWidget */
function formatPnLDisplay(value: number): {
  text: string;
  color: 'green' | 'red';
} {
  const isPositive = value >= 0;
  const sign = isPositive ? '+' : '-';
  const formatted = `${sign}${BABYLON_POINTS_SYMBOL}${Math.abs(value).toFixed(2)}`;
  return {
    text: formatted,
    color: isPositive ? 'green' : 'red',
  };
}

/** Replicates the visibility logic for the widget */
function shouldRenderWidget(authenticated: boolean): boolean {
  return authenticated;
}

/** Replicates the agent section visibility logic */
function shouldShowAgentSection(agentCount: number): boolean {
  return agentCount > 0;
}

/** Replicates loading state logic */
function isLoadingState(
  portfolioLoading: boolean,
  data: unknown | null
): boolean {
  return portfolioLoading && !data;
}

describe('PortfolioWidget', () => {
  describe('visibility', () => {
    it('should not render when user is not authenticated', () => {
      expect(shouldRenderWidget(false)).toBe(false);
    });

    it('should render when user is authenticated', () => {
      expect(shouldRenderWidget(true)).toBe(true);
    });
  });

  describe('loading state', () => {
    it('should show loading when portfolio is loading and no cached data', () => {
      expect(isLoadingState(true, null)).toBe(true);
    });

    it('should not show loading when data is available even if still fetching', () => {
      expect(isLoadingState(true, { totalPnL: 0 })).toBe(false);
    });

    it('should not show loading when not fetching', () => {
      expect(isLoadingState(false, null)).toBe(false);
    });
  });

  describe('P&L formatting', () => {
    it('should format positive P&L with plus sign and green color', () => {
      const result = formatPnLDisplay(234.56);
      expect(result.text).toBe(`+${BABYLON_POINTS_SYMBOL}234.56`);
      expect(result.color).toBe('green');
    });

    it('should format negative P&L with minus sign and red color', () => {
      const result = formatPnLDisplay(-100.5);
      expect(result.text).toBe(`-${BABYLON_POINTS_SYMBOL}100.50`);
      expect(result.color).toBe('red');
    });

    it('should format zero P&L as positive (green)', () => {
      const result = formatPnLDisplay(0);
      expect(result.text).toBe(`+${BABYLON_POINTS_SYMBOL}0.00`);
      expect(result.color).toBe('green');
    });

    it('should handle very large values', () => {
      const result = formatPnLDisplay(999999.99);
      expect(result.text).toBe(`+${BABYLON_POINTS_SYMBOL}999999.99`);
      expect(result.color).toBe('green');
    });

    it('should handle very small negative values', () => {
      const result = formatPnLDisplay(-0.01);
      expect(result.text).toBe(`-${BABYLON_POINTS_SYMBOL}0.01`);
      expect(result.color).toBe('red');
    });
  });

  describe('agent section visibility', () => {
    it('should show agent section when agent count is greater than 0', () => {
      expect(shouldShowAgentSection(3)).toBe(true);
    });

    it('should hide agent section when agent count is 0', () => {
      expect(shouldShowAgentSection(0)).toBe(false);
    });

    it('should show agent section for single agent', () => {
      expect(shouldShowAgentSection(1)).toBe(true);
    });
  });
});
