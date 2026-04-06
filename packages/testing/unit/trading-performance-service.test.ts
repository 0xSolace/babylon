import { describe, expect, it } from 'bun:test';
import {
  getCapitalBaseContribution,
  TRADING_RETURN_CAPITAL_FLOOR,
  TradingPerformanceService,
} from '../../api/src/services/trading-performance-service';

describe('TradingPerformanceService.calculateTradingReturnMetrics', () => {
  it('uses the raw capital base when it is above the floor', () => {
    const result = TradingPerformanceService.calculateTradingReturnMetrics(
      500,
      2000
    );

    expect(result.capitalBase).toBe(2000);
    expect(result.effectiveCapitalBase).toBe(2000);
    expect(result.tradingReturn).toBe(0.25);
  });

  it('applies the canonical floor when capital base is below 1000', () => {
    const result = TradingPerformanceService.calculateTradingReturnMetrics(
      500,
      300
    );

    expect(result.capitalBase).toBe(300);
    expect(result.effectiveCapitalBase).toBe(TRADING_RETURN_CAPITAL_FLOOR);
    expect(result.tradingReturn).toBe(0.5);
  });

  it('clamps negative capital base to zero before applying the floor', () => {
    const result = TradingPerformanceService.calculateTradingReturnMetrics(
      -200,
      -50
    );

    expect(result.capitalBase).toBe(0);
    expect(result.effectiveCapitalBase).toBe(TRADING_RETURN_CAPITAL_FLOOR);
    expect(result.tradingReturn).toBe(-0.2);
  });
});

describe('getCapitalBaseContribution', () => {
  it('counts owner deposits for wallet scope only', () => {
    expect(
      getCapitalBaseContribution(
        { type: 'owner_deposit', amount: 500 },
        'wallet'
      )
    ).toBe(500);
    expect(
      getCapitalBaseContribution(
        { type: 'owner_deposit', amount: 500 },
        'team'
      )
    ).toBe(0);
  });

  it('treats owner withdrawals as wallet-scope capital reversals', () => {
    expect(
      getCapitalBaseContribution(
        { type: 'owner_withdraw', amount: -200 },
        'wallet'
      )
    ).toBe(-200);
    expect(
      getCapitalBaseContribution(
        { type: 'owner_withdraw', amount: -200 },
        'team'
      )
    ).toBe(0);
  });

  it('uses requested balance units for external reversals when present', () => {
    expect(
      getCapitalBaseContribution(
        {
          type: 'stripe_refund',
          amount: -120,
          balanceUnitsRequested: 300,
        },
        'wallet'
      )
    ).toBe(-300);
  });
});
