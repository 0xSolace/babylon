/**
 * ⚠️  DEV-ONLY mock data for the /wallet page.
 *
 * This file seeds Zustand stores and provides fake API responses so every
 * possible UI state can be previewed locally without a backend.
 *
 * 🔴  REMOVE before merging to production.  See /WALLET-DEV-REMINDER.md
 */

import type { PerpPosition, UserPredictionPosition } from '@babylon/shared';

// ---------------------------------------------------------------------------
// Feature flag — flip to `false` to disable all mocks instantly
// ---------------------------------------------------------------------------
export const WALLET_MOCK_ENABLED = false;

// ---------------------------------------------------------------------------
// Wallet balance  (feeds Balance tab "Cash" column & P&L tab lifetimePnL)
// ---------------------------------------------------------------------------
export const MOCK_BALANCE = 24_819.42;
export const MOCK_LIFETIME_PNL = 6_530.17;

// ---------------------------------------------------------------------------
// Perp positions (open)
//
// UI elements exercised:
//   • LONG badge (green)          → perp-1, perp-3, perp-5, perp-7
//   • SHORT badge (red)           → perp-2, perp-4, perp-6
//   • Owner label                 → perp-1, perp-2, perp-5
//   • Agent label                 → perp-3, perp-4, perp-6, perp-7
//   • Positive PnL (green text)   → perp-1, perp-3, perp-4, perp-7
//   • Negative PnL (red text)     → perp-2, perp-5, perp-6
//   • High leverage (10x)         → perp-2
//   • Low leverage (2x)           → perp-7
//   • Various sizes for column variety
// ---------------------------------------------------------------------------
export const MOCK_PERP_POSITIONS: PerpPosition[] = [
  // ── Owner positions ──────────────────────────────────────────────────
  {
    id: 'mock-perp-1',
    userId: 'mock-user',
    ticker: 'AAPL',
    organizationId: 'org-1',
    side: 'long',
    entryPrice: 178.5,
    currentPrice: 192.3,
    size: 5_000,
    leverage: 5,
    liquidationPrice: 145.2,
    unrealizedPnL: 387.64,
    unrealizedPnLPercent: 7.75,
    fundingPaid: 6.24,
    openedAt: '2026-03-15T10:30:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: false,
  },
  {
    id: 'mock-perp-2',
    userId: 'mock-user',
    ticker: 'TSLA',
    organizationId: 'org-1',
    side: 'short',
    entryPrice: 245.0,
    currentPrice: 260.75,
    size: 3_600,
    leverage: 10,
    liquidationPrice: 268.0,
    unrealizedPnL: -231.82,
    unrealizedPnLPercent: -6.44,
    fundingPaid: 10.8,
    openedAt: '2026-03-17T14:00:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: false,
  },
  {
    id: 'mock-perp-5',
    userId: 'mock-user',
    ticker: 'COIN',
    organizationId: 'org-1',
    side: 'long',
    entryPrice: 210.0,
    currentPrice: 195.5,
    size: 2_000,
    leverage: 4,
    liquidationPrice: 158.0,
    unrealizedPnL: -138.1,
    unrealizedPnLPercent: -6.91,
    fundingPaid: 4.5,
    openedAt: '2026-03-19T08:15:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: false,
  },
  // ── Alpha Trader (agent) positions ───────────────────────────────────
  {
    id: 'mock-perp-3',
    userId: 'mock-user',
    ticker: 'NVDA',
    organizationId: 'org-1',
    side: 'long',
    entryPrice: 880.0,
    currentPrice: 920.5,
    size: 8_000,
    leverage: 3,
    liquidationPrice: 590.0,
    unrealizedPnL: 368.18,
    unrealizedPnLPercent: 4.6,
    fundingPaid: 16.5,
    openedAt: '2026-03-10T09:00:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: true,
    agentId: 'agent-alpha',
    agentName: 'Alpha Trader',
  },
  {
    id: 'mock-perp-7',
    userId: 'mock-user',
    ticker: 'AMZN',
    organizationId: 'org-1',
    side: 'long',
    entryPrice: 185.0,
    currentPrice: 198.25,
    size: 6_000,
    leverage: 2,
    liquidationPrice: 95.0,
    unrealizedPnL: 429.73,
    unrealizedPnLPercent: 7.16,
    fundingPaid: 3.0,
    openedAt: '2026-03-08T11:00:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: true,
    agentId: 'agent-alpha',
    agentName: 'Alpha Trader',
  },
  // ── Risk Sentinel (agent) positions ──────────────────────────────────
  // NOTE: Risk Sentinel's total unrealized is intentionally negative
  // (−82.16 + −175.0 + 4.95 + −8.4 = −260.61) so the P&L table shows
  // red text + red badges for at least one entity row.
  {
    id: 'mock-perp-4',
    userId: 'mock-user',
    ticker: 'META',
    organizationId: 'org-1',
    side: 'short',
    entryPrice: 510.0,
    currentPrice: 523.4,
    size: 6_400,
    leverage: 4,
    liquidationPrice: 632.0,
    unrealizedPnL: -168.16,
    unrealizedPnLPercent: -2.63,
    fundingPaid: 5.6,
    openedAt: '2026-03-12T11:45:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: true,
    agentId: 'agent-beta',
    agentName: 'Risk Sentinel',
  },
  {
    id: 'mock-perp-6',
    userId: 'mock-user',
    ticker: 'GOOG',
    organizationId: 'org-1',
    side: 'short',
    entryPrice: 170.0,
    currentPrice: 183.5,
    size: 3_500,
    leverage: 5,
    liquidationPrice: 203.0,
    unrealizedPnL: -277.94,
    unrealizedPnLPercent: -7.94,
    fundingPaid: 7.2,
    openedAt: '2026-03-18T16:00:00Z',
    lastUpdated: '2026-03-20T08:00:00Z',
    isAgentPosition: true,
    agentId: 'agent-beta',
    agentName: 'Risk Sentinel',
  },
];

// ---------------------------------------------------------------------------
// Prediction positions (open)
//
// UI elements exercised:
//   • YES badge (green)            → pred-1, pred-3, pred-5, pred-7
//   • NO badge (red)               → pred-2, pred-4, pred-8
//   • Owner label                  → pred-1, pred-2, pred-5, pred-7
//   • Agent label                  → pred-3, pred-4, pred-8
//   • Positive unrealizedPnL       → pred-1, pred-3, pred-4, pred-7
//   • Negative unrealizedPnL       → pred-2, pred-8
//   • "Too Small" button (<0.01)   → pred-5
//   • Long question (truncated)    → pred-7
//   • Resolved (filtered out)      → pred-6
// ---------------------------------------------------------------------------
export const MOCK_PREDICTION_POSITIONS: UserPredictionPosition[] = [
  // ── Owner predictions ────────────────────────────────────────────────
  {
    id: 'mock-pred-1',
    marketId: 'market-btc-100k',
    question: 'Will Bitcoin reach $100k by end of Q2 2026?',
    side: 'YES',
    shares: 150,
    avgPrice: 0.62,
    currentPrice: 0.78,
    currentProbability: 0.78,
    currentValue: 117.0,
    costBasis: 93.0,
    unrealizedPnL: 24.0,
    resolved: false,
    isAgentPosition: false,
  },
  {
    id: 'mock-pred-2',
    marketId: 'market-fed-rate',
    question: 'Will the Fed cut rates at the June 2026 meeting?',
    side: 'NO',
    shares: 80,
    avgPrice: 0.45,
    currentPrice: 0.38,
    currentProbability: 0.62,
    currentValue: 30.4,
    costBasis: 36.0,
    unrealizedPnL: -5.6,
    resolved: false,
    isAgentPosition: false,
  },
  // Tiny position → triggers "Too Small" disabled sell button
  {
    id: 'mock-pred-5',
    marketId: 'market-tiny',
    question: 'Will Mars colony launch happen by 2030?',
    side: 'YES',
    shares: 0.005,
    avgPrice: 0.4,
    currentPrice: 0.55,
    currentProbability: 0.55,
    currentValue: 0.00275,
    costBasis: 0.002,
    unrealizedPnL: 0.00075,
    resolved: false,
    isAgentPosition: false,
  },
  // Long question → triggers truncation (> 40 chars)
  {
    id: 'mock-pred-7',
    marketId: 'market-long-question',
    question:
      'Will the S&P 500 close above its all-time high at the end of every trading week in Q3 2026?',
    side: 'YES',
    shares: 300,
    avgPrice: 0.29,
    currentPrice: 0.41,
    currentProbability: 0.41,
    currentValue: 123.0,
    costBasis: 87.0,
    unrealizedPnL: 36.0,
    resolved: false,
    isAgentPosition: false,
  },
  // ── Alpha Trader (agent) predictions ─────────────────────────────────
  {
    id: 'mock-pred-3',
    marketId: 'market-ai-agi',
    question: 'Will OpenAI announce AGI capabilities before 2027?',
    side: 'YES',
    shares: 200,
    avgPrice: 0.35,
    currentPrice: 0.52,
    currentProbability: 0.52,
    currentValue: 104.0,
    costBasis: 70.0,
    unrealizedPnL: 34.0,
    resolved: false,
    isAgentPosition: true,
    agentId: 'agent-alpha',
    agentName: 'Alpha Trader',
  },
  // ── Risk Sentinel (agent) predictions ────────────────────────────────
  {
    id: 'mock-pred-4',
    marketId: 'market-eth-merge',
    question: 'Will Ethereum flip Bitcoin market cap this cycle?',
    side: 'NO',
    shares: 45,
    avgPrice: 0.71,
    currentPrice: 0.82,
    currentProbability: 0.18,
    currentValue: 36.9,
    costBasis: 31.95,
    unrealizedPnL: 4.95,
    resolved: false,
    isAgentPosition: true,
    agentId: 'agent-beta',
    agentName: 'Risk Sentinel',
  },
  {
    id: 'mock-pred-8',
    marketId: 'market-sol-eth',
    question: 'Will Solana overtake Ethereum in daily transactions?',
    side: 'NO',
    shares: 120,
    avgPrice: 0.55,
    currentPrice: 0.48,
    currentProbability: 0.52,
    currentValue: 57.6,
    costBasis: 66.0,
    unrealizedPnL: -8.4,
    resolved: false,
    isAgentPosition: true,
    agentId: 'agent-beta',
    agentName: 'Risk Sentinel',
  },
  // ── Resolved position — filtered out by PositionsTab (!resolved) ─────
  // Still counted by Balance tab's currentValue calculation
  {
    id: 'mock-pred-6',
    marketId: 'market-resolved',
    question: 'Did Apple release Vision Pro 2 in 2025?',
    side: 'YES',
    shares: 100,
    avgPrice: 0.8,
    currentPrice: 1.0,
    currentProbability: 1.0,
    currentValue: 100,
    costBasis: 80,
    unrealizedPnL: 20,
    resolved: true,
    resolution: true,
    isAgentPosition: false,
  },
];

// ---------------------------------------------------------------------------
// Closed perp positions
//
// UI elements exercised:
//   • LONG badge + CLOSED badge        → closed-1, closed-3, closed-5
//   • SHORT badge + CLOSED badge       → closed-2, closed-4, closed-6
//   • Positive realized PnL (green)    → closed-1, closed-3, closed-4
//   • Negative realized PnL (red)      → closed-2, closed-5, closed-6
//   • Owner (no agentName shown)       → closed-1, closed-2, closed-5
//   • Agent name label                 → closed-3, closed-4, closed-6
//   • closedAt date displayed          → all
//   • closedAt = null (no date shown)  → closed-5
// ---------------------------------------------------------------------------
export interface MockClosedPerpPosition {
  id: string;
  ticker: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  realizedPnL: number;
  closedAt: string | null;
  isAgentPosition: boolean;
  agentName: string | null;
}

export const MOCK_CLOSED_PERPS: MockClosedPerpPosition[] = [
  // ── Owner closed positions ───────────────────────────────────────────
  {
    id: 'mock-closed-1',
    ticker: 'GOOG',
    side: 'long',
    entryPrice: 155.0,
    currentPrice: 172.3,
    size: 3_000,
    leverage: 5,
    realizedPnL: 334.19,
    closedAt: '2026-03-18T16:30:00Z',
    isAgentPosition: false,
    agentName: null,
  },
  {
    id: 'mock-closed-2',
    ticker: 'AMD',
    side: 'short',
    entryPrice: 198.0,
    currentPrice: 205.5,
    size: 2_000,
    leverage: 8,
    realizedPnL: -60.61,
    closedAt: '2026-03-16T12:00:00Z',
    isAgentPosition: false,
    agentName: null,
  },
  // No closedAt → date row hidden
  {
    id: 'mock-closed-5',
    ticker: 'SQ',
    side: 'long',
    entryPrice: 78.0,
    currentPrice: 72.5,
    size: 1_200,
    leverage: 6,
    realizedPnL: -84.62,
    closedAt: null,
    isAgentPosition: false,
    agentName: null,
  },
  // ── Alpha Trader closed ──────────────────────────────────────────────
  {
    id: 'mock-closed-3',
    ticker: 'MSFT',
    side: 'long',
    entryPrice: 420.0,
    currentPrice: 445.0,
    size: 5_000,
    leverage: 3,
    realizedPnL: 297.62,
    closedAt: '2026-03-14T09:45:00Z',
    isAgentPosition: true,
    agentName: 'Alpha Trader',
  },
  // ── Risk Sentinel closed ─────────────────────────────────────────────
  {
    id: 'mock-closed-4',
    ticker: 'NFLX',
    side: 'short',
    entryPrice: 620.0,
    currentPrice: 580.0,
    size: 1_500,
    leverage: 6,
    realizedPnL: 96.77,
    closedAt: '2026-03-13T15:20:00Z',
    isAgentPosition: true,
    agentName: 'Risk Sentinel',
  },
  {
    id: 'mock-closed-6',
    ticker: 'PYPL',
    side: 'short',
    entryPrice: 68.0,
    currentPrice: 74.2,
    size: 2_500,
    leverage: 4,
    realizedPnL: -227.94,
    closedAt: '2026-03-11T14:10:00Z',
    isAgentPosition: true,
    agentName: 'Risk Sentinel',
  },
];

// ---------------------------------------------------------------------------
// PnL chart history — deterministic data (seeded PRNG) for each timeframe
// so the chart always looks the same across reloads.
// ---------------------------------------------------------------------------
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generatePnlPoints(
  count: number,
  startValue: number,
  volatility: number,
  trend: number,
  seed: number
) {
  const rng = seededRandom(seed);
  const now = Date.now();
  const intervalMs = (4 * 60 * 60 * 1000) / count;
  const points: { time: number; value: number }[] = [];
  let value = startValue;

  for (let i = 0; i < count; i++) {
    const noise = (rng() - 0.5) * 2 * volatility;
    value += trend + noise;
    points.push({ time: now - (count - i) * intervalMs, value });
  }
  return points;
}

export const MOCK_PNL_HISTORY: Record<
  string,
  { time: number; value: number }[]
> = {
  // 1H trends DOWN → red chart colour, so both green & red chart paths are visible
  '1H': generatePnlPoints(12, 24_900, 30, -12, 111),
  '4H': generatePnlPoints(24, 24_200, 50, 15, 222),
  '1D': generatePnlPoints(48, 23_000, 80, 30, 333),
  '1W': generatePnlPoints(84, 18_000, 150, 65, 444),
  ALL: generatePnlPoints(120, 5_000, 200, 140, 555),
};
