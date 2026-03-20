/** Safely coerce an unknown value (DB column, JSON field) to a finite number. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Canonical mark-to-market value for an open perpetual position.
 *
 * `size` is the leveraged notional, so we recover posted margin as
 * `abs(size / leverage)` and then add current unrealized PnL.
 */
export function calculatePerpPositionMarketValue(position: {
  leverage: unknown;
  size: unknown;
  unrealizedPnL: unknown;
}) {
  const size = toNumber(position.size);
  const leverage = toNumber(position.leverage);
  const unrealizedPnL = toNumber(position.unrealizedPnL);
  const effectiveLeverage =
    Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
  const margin = Math.abs(size / effectiveLeverage);

  return margin + unrealizedPnL;
}
