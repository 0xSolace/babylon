import { describe, expect, it } from 'bun:test';
import { BABYLON_POINTS_SYMBOL } from '@babylon/shared';

import {
  calculateSharePercentages,
  formatBalance,
  formatChange24h,
  formatFundingApr,
  formatPrice,
  formatVolume,
  getDaysLeft,
} from '../../../../apps/web/src/app/markets/_lib/formatters';

const EM_DASH = '\u2014';

describe('formatPrice', () => {
  it('formats with currency symbol and 2 decimals', () => {
    expect(formatPrice(123.456)).toBe(`${BABYLON_POINTS_SYMBOL}123.46`);
    expect(formatPrice(100)).toBe(`${BABYLON_POINTS_SYMBOL}100.00`);
    expect(formatPrice(0)).toBe(`${BABYLON_POINTS_SYMBOL}0.00`);
    expect(formatPrice(-100)).toBe(`-${BABYLON_POINTS_SYMBOL}100.00`);
  });

  it('handles edge values', () => {
    expect(formatPrice(0.001)).toBe(`${BABYLON_POINTS_SYMBOL}0.00`);
    expect(formatPrice(0.01)).toBe(`${BABYLON_POINTS_SYMBOL}0.01`);
    expect(formatPrice(999999)).toBe(`${BABYLON_POINTS_SYMBOL}999999.00`);
  });

  it('returns em dash for non-finite values', () => {
    expect(formatPrice(Number.NaN)).toBe(`${BABYLON_POINTS_SYMBOL}${EM_DASH}`);
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe(
      `${BABYLON_POINTS_SYMBOL}${EM_DASH}`
    );
  });
});

describe('formatVolume', () => {
  it('formats under 1K without suffix', () => {
    expect(formatVolume(0)).toBe(`${BABYLON_POINTS_SYMBOL}0.00`);
    expect(formatVolume(500)).toBe(`${BABYLON_POINTS_SYMBOL}500.00`);
    expect(formatVolume(999)).toBe(`${BABYLON_POINTS_SYMBOL}999.00`);
  });

  it('adds K/M/B suffix for larger values', () => {
    expect(formatVolume(1000)).toBe(`${BABYLON_POINTS_SYMBOL}1.00K`);
    expect(formatVolume(1500)).toBe(`${BABYLON_POINTS_SYMBOL}1.50K`);
    expect(formatVolume(1000000)).toBe(`${BABYLON_POINTS_SYMBOL}1.00M`);
    expect(formatVolume(1000000000)).toBe(`${BABYLON_POINTS_SYMBOL}1.00B`);
  });

  it('adds T and Q suffix for very large values', () => {
    expect(formatVolume(2e12)).toBe(`${BABYLON_POINTS_SYMBOL}2.00T`);
    expect(formatVolume(3e15)).toBe(`${BABYLON_POINTS_SYMBOL}3.00Q`);
  });

  it('returns em dash for non-finite values', () => {
    expect(formatVolume(Number.NaN)).toBe(`${BABYLON_POINTS_SYMBOL}${EM_DASH}`);
  });

  it('prefixes minus for negative values', () => {
    expect(formatVolume(-1500)).toBe(`-${BABYLON_POINTS_SYMBOL}1.50K`);
  });
});

describe('formatBalance', () => {
  it('uses locale separators and two decimals', () => {
    const expected = `${BABYLON_POINTS_SYMBOL}${(1234.5).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

    expect(formatBalance(1234.5)).toBe(expected);
  });

  it('returns em dash for non-finite values', () => {
    expect(formatBalance(Number.NaN)).toBe(
      `${BABYLON_POINTS_SYMBOL}${EM_DASH}`
    );
  });
});

describe('formatChange24h', () => {
  it('adds plus for non-negative finite values', () => {
    expect(formatChange24h(1.234)).toBe('+1.23%');
    expect(formatChange24h(0)).toBe('+0.00%');
  });

  it('formats negative without duplicate minus', () => {
    expect(formatChange24h(-5.5)).toBe('-5.50%');
  });

  it('returns em dash for non-finite', () => {
    expect(formatChange24h(Number.NaN)).toBe(EM_DASH);
  });

  it('clamps extreme magnitudes', () => {
    expect(formatChange24h(50000)).toBe('+9999.99%');
    expect(formatChange24h(-50000)).toBe('-9999.99%');
  });
});

describe('formatFundingApr', () => {
  it('converts annual decimal to percent with sign', () => {
    expect(formatFundingApr(0.01)).toBe('+1.00%');
    expect(formatFundingApr(-0.02)).toBe('-2.00%');
  });

  it('respects decimals option', () => {
    expect(formatFundingApr(0.01, { decimals: 4 })).toBe('+1.0000%');
  });

  it('returns em dash for non-finite', () => {
    expect(formatFundingApr(Number.NaN)).toBe(EM_DASH);
  });

  it('clamps display magnitude', () => {
    expect(formatFundingApr(10)).toBe('+999.99%');
    expect(formatFundingApr(-10)).toBe('-999.99%');
  });
});

describe('getDaysLeft', () => {
  it('returns null for missing date', () => {
    expect(getDaysLeft(undefined)).toBeNull();
    expect(getDaysLeft('')).toBeNull();
  });

  it('calculates days for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const result = getDaysLeft(future.toISOString());
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(6);
  });

  it('clamps past dates to 0', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(getDaysLeft(past.toISOString())).toBe(0);
  });
});

describe('calculateSharePercentages', () => {
  it('defaults to 50/50 when no shares', () => {
    const result = calculateSharePercentages(undefined, undefined);
    expect(result.totalShares).toBe(0);
    expect(result.yesPercent).toBe(50);
    expect(result.noPercent).toBe(50);
  });

  it('returns 50/50 when shares are equal', () => {
    const result = calculateSharePercentages(10, 10);
    expect(result.totalShares).toBe(20);
    expect(result.yesPercent).toBe(50);
    expect(result.noPercent).toBe(50);
  });

  it('is symmetric when swapping sides', () => {
    const a = calculateSharePercentages(90, 10);
    const b = calculateSharePercentages(10, 90);

    expect(a.totalShares).toBe(100);
    expect(b.totalShares).toBe(100);

    expect(a.yesPercent + a.noPercent).toBeCloseTo(100, 6);
    expect(b.yesPercent + b.noPercent).toBeCloseTo(100, 6);

    expect(a.yesPercent).toBeCloseTo(b.noPercent, 6);
    expect(a.noPercent).toBeCloseTo(b.yesPercent, 6);
  });
});
