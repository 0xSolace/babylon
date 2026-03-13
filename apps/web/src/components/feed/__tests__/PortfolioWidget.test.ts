import { describe, expect, it } from 'bun:test';
import type { PortfolioBreakdownSnapshot } from '@babylon/engine/client';
import { BABYLON_POINTS_SYMBOL, formatCurrency } from '@babylon/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PnLValue, PortfolioWidgetContent } from '../PortfolioWidget';

const snapshot: PortfolioBreakdownSnapshot = {
  wallet: 1000,
  agents: 250,
  positions: 500,
  available: 1250,
  originalAmount: 900,
  totalAssets: 1750,
  totalPnL: 850,
  agentCount: 3,
  totalPoints: 1750,
};

describe('PnLValue', () => {
  it('renders positive value with green color and + prefix', () => {
    const html = renderToStaticMarkup(createElement(PnLValue, { value: 100 }));
    expect(html).toContain('text-green-500');
    expect(html).toContain('+');
    expect(html).toContain(BABYLON_POINTS_SYMBOL);
  });

  it('renders negative value with red color and no + prefix', () => {
    const html = renderToStaticMarkup(
      createElement(PnLValue, { value: -50.25 })
    );
    expect(html).toContain('text-red-500');
    expect(html).not.toMatch(/\+.*50/);
    expect(html).toContain(BABYLON_POINTS_SYMBOL);
  });

  it('renders zero as positive (green)', () => {
    const html = renderToStaticMarkup(createElement(PnLValue, { value: 0 }));
    expect(html).toContain('text-green-500');
    expect(html).toContain('+');
  });

  it('renders the formatted currency amount', () => {
    const html = renderToStaticMarkup(
      createElement(PnLValue, { value: 1234.56 })
    );
    const formatted = formatCurrency(1234.56, {
      useThousandsSeparator: true,
    });
    expect(html).toContain(formatted);
  });
});

describe('PortfolioWidgetContent', () => {
  it('shows loading skeletons when loading=true', () => {
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 0,
        lifetimePnL: 0,
        data: null,
        loading: true,
      })
    );
    expect(html).toContain('animate-pulse');
    expect(html).toContain('Portfolio');
    expect(html).not.toContain('Balance');
  });

  it('renders balance and lifetime P&L when loaded', () => {
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 1234.56,
        lifetimePnL: 234,
        data: null,
        loading: false,
      })
    );
    const formatted = formatCurrency(1234.56, {
      useThousandsSeparator: true,
    });
    expect(html).toContain('Balance');
    expect(html).toContain(formatted);
    expect(html).toContain('text-green-500'); // positive P&L
    expect(html).toContain('View Full Portfolio');
  });

  it('renders agent section when agentCount > 0', () => {
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 1000,
        lifetimePnL: 100,
        data: snapshot,
        loading: false,
      })
    );
    expect(html).toContain('Agents (3)');
    const agentFormatted = formatCurrency(250, {
      useThousandsSeparator: true,
    });
    expect(html).toContain(agentFormatted);
  });

  it('hides agent section when agentCount is 0', () => {
    const noAgents: PortfolioBreakdownSnapshot = {
      ...snapshot,
      agentCount: 0,
      agents: 0,
    };
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 1000,
        lifetimePnL: 100,
        data: noAgents,
        loading: false,
      })
    );
    expect(html).not.toContain('Agents');
  });

  it('renders positions and total assets', () => {
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 1000,
        lifetimePnL: 100,
        data: snapshot,
        loading: false,
      })
    );
    expect(html).toContain('Positions');
    const posFormatted = formatCurrency(500, {
      useThousandsSeparator: true,
    });
    const totalFormatted = formatCurrency(1750, {
      useThousandsSeparator: true,
    });
    expect(html).toContain(posFormatted);
    expect(html).toContain(`Total ${totalFormatted}`);
  });

  it('does not render positions section when data is null', () => {
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 500,
        lifetimePnL: -10,
        data: null,
        loading: false,
      })
    );
    expect(html).not.toContain('Positions');
    expect(html).toContain('Balance');
    expect(html).toContain('text-red-500'); // negative P&L
  });

  it('renders View Full Portfolio button with type=button', () => {
    const html = renderToStaticMarkup(
      createElement(PortfolioWidgetContent, {
        balance: 100,
        lifetimePnL: 0,
        data: null,
        loading: false,
      })
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('View Full Portfolio');
  });
});
