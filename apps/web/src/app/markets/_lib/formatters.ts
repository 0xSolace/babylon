/**
 * Markets UI formatting helpers (`/markets`, `/markets/trending`, prediction tables).
 *
 * **WHY this file (not only `@babylon/shared`):** Screener tables need Babylon-specific
 * rules: ƀ prefix, column-width safety (compact T/Q tiers), and “missing value” glyphs
 * for bad API data. Shared `formatCompactCurrency` serves engine/prompts; these helpers
 * target **dense tables** where `NaN%` or a 20-digit `…B` string breaks layout.
 *
 * **Docs:** `docs/markets/trending-screener.md` → “Display & formatting”.
 */

import { PredictionPricing } from '@babylon/core/markets/prediction/client';
import { BABYLON_POINTS_SYMBOL } from '@babylon/shared';

/** U+2014 — single missing-value glyph; avoids “NaN” / empty string ambiguity in tables. */
const EM_DASH = '\u2014';

/**
 * Perp / table price in Babylon points.
 *
 * **WHY `Number.isFinite`:** A poisoned `currentPrice` would render `ƀNaN` and stretch
 * or confuse readers; em dash matches other guarded columns.
 */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) {
    return `${BABYLON_POINTS_SYMBOL}${EM_DASH}`;
  }
  return `${BABYLON_POINTS_SYMBOL}${price.toFixed(2)}`;
}

/**
 * 24h change for sortable screener columns.
 *
 * **WHY clamp ±9999.99%:** Extreme outliers should not produce 10+ character mantissas.
 * **WHY leading `+`:** Matches trader screener convention; negatives keep a single `-` from `toFixed`.
 * **WHY not alter sort:** Callers sort on raw `changePercent24h`; this is display-only.
 */
export function formatChange24h(pct: number): string {
  if (!Number.isFinite(pct)) {
    return EM_DASH;
  }
  const clamped = Math.max(-9999.99, Math.min(9999.99, pct));
  const sign = clamped >= 0 ? '+' : '';
  return `${sign}${clamped.toFixed(2)}%`;
}

/**
 * Funding APR from annual **decimal** rate (`0.01` → `+1.00%`), per `PerpMarketService` storage.
 *
 * **WHY clamp ±999.99%:** Engine caps near ~50% APR; corrupt JSON should never widen the Fund. column.
 * **WHY `decimals` option:** Screener uses 2; detail panels may pass 4 without duplicating math.
 */
export function formatFundingApr(
  rate: number,
  options: { decimals?: number } = {}
): string {
  const decimals = options.decimals ?? 2;
  if (!Number.isFinite(rate)) {
    return EM_DASH;
  }
  const pct = rate * 100;
  const clamped = Math.max(-999.99, Math.min(999.99, pct));
  const sign = clamped >= 0 ? '+' : '';
  return `${sign}${clamped.toFixed(decimals)}%`;
}

/**
 * Balance with locale grouping (user-facing readability).
 *
 * **WHY finite guard:** `toLocaleString` on `NaN` yields a literal “NaN” in many locales.
 */
export function formatBalance(balance: number): string {
  if (!Number.isFinite(balance)) {
    return `${BABYLON_POINTS_SYMBOL}${EM_DASH}`;
  }
  return `${BABYLON_POINTS_SYMBOL}${balance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Open interest, 24h volume, or prediction share totals — compact ƀ + suffix.
 *
 * **WHY T and Q tiers:** Stopping at `B` left values like 1e16 as `ƀ10000000.00B` (useless width).
 * **WHY 2 decimals:** Aligns OI and Vol columns visually; shared `formatCompactNumber` uses 1 dp for different UX.
 * **WHY non-finite → ƀ—:** Same “missing metric” pattern as price.
 */
export function formatVolume(volume: number): string {
  if (!Number.isFinite(volume)) {
    return `${BABYLON_POINTS_SYMBOL}${EM_DASH}`;
  }
  const abs = Math.abs(volume);
  const sign = volume < 0 ? '-' : '';
  if (abs >= 1e15) {
    return `${sign}${BABYLON_POINTS_SYMBOL}${(abs / 1e15).toFixed(2)}Q`;
  }
  if (abs >= 1e12) {
    return `${sign}${BABYLON_POINTS_SYMBOL}${(abs / 1e12).toFixed(2)}T`;
  }
  if (abs >= 1e9) {
    return `${sign}${BABYLON_POINTS_SYMBOL}${(abs / 1e9).toFixed(2)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${BABYLON_POINTS_SYMBOL}${(abs / 1e6).toFixed(2)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${BABYLON_POINTS_SYMBOL}${(abs / 1e3).toFixed(2)}K`;
  }
  return `${sign}${BABYLON_POINTS_SYMBOL}${abs.toFixed(2)}`;
}

/**
 * Calculates days remaining until a target date.
 *
 * @param date - ISO date string or undefined
 * @returns Number of days remaining, or null if no date provided
 */
export function getDaysLeft(date?: string): number | null {
  if (!date) return null;
  const diff = Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

/**
 * Calculates YES/NO percentages from share counts.
 *
 * Note: In our CPMM-style YES/NO markets, the displayed "probability" should
 * match the AMM price (not the raw share ratio). We therefore use
 * `PredictionPricing.getCurrentPrice()` as the source of truth.
 *
 * @param yesShares - Number of YES shares
 * @param noShares - Number of NO shares
 * @returns Object with yesPercent and noPercent
 */
export function calculateSharePercentages(
  yesShares: number | undefined,
  noShares: number | undefined
): { yesPercent: number; noPercent: number; totalShares: number } {
  const yes = yesShares ?? 0;
  const no = noShares ?? 0;
  const total = yes + no;

  if (total === 0) {
    return { yesPercent: 50, noPercent: 50, totalShares: 0 };
  }

  const yesPrice = PredictionPricing.getCurrentPrice(yes, no, 'yes');
  const noPrice = PredictionPricing.getCurrentPrice(yes, no, 'no');

  return {
    yesPercent: yesPrice * 100,
    noPercent: noPrice * 100,
    totalShares: total,
  };
}
