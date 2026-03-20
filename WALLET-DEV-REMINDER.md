# Wallet Page — Dev Mock Data Reminder

## REMOVE BEFORE PUSHING TO PRODUCTION

The `/wallet` page currently has **mock data injected** so every UI state can be
previewed without a backend or authentication.

### What to remove

Search the codebase for `DEV MOCK` comments — every touched file is marked.

| File | What to revert |
|---|---|
| `apps/web/src/app/wallet/page.tsx` | Remove mock imports, `useWalletMockData` call, `WALLET_MOCK_ENABLED` guards around auth/redirect logic |
| `apps/web/src/components/wallet/v2/pnl-chart.tsx` | Remove mock import & conditional; restore original `usePnlHistory` usage |
| `apps/web/src/components/wallet/v2/positions-tab.tsx` | Remove mock import & early-return in closed-perps `useEffect` |
| `apps/web/src/components/wallet/__dev__/wallet-mock-data.ts` | Delete entire file |
| `apps/web/src/components/wallet/__dev__/useWalletMockData.ts` | Delete entire file |
| `apps/web/src/components/wallet/__dev__/` | Delete entire directory |
| `WALLET-DEV-REMINDER.md` (this file) | Delete |

### Quick disable (without removing code)

Open `wallet-mock-data.ts` and set:

```ts
export const WALLET_MOCK_ENABLED = false;
```

This instantly disables all mocks and restores normal auth + API behaviour.

### What the mocks cover

Every possible visual element across all three tabs:

**Balance tab**
- Total Balance summary row
- "Agents Only" summary row (visible because agents have positions)
- Table header: Member | Cash | Open Positions | Total
- "You (Owner)" row — cash > 0, open positions from 3 owner perps + 4 owner predictions
- "Alpha Trader" row — cash = 0, open positions from 2 perps + 1 prediction
- "Risk Sentinel" row — cash = 0, open positions from 2 perps + 2 predictions

**P&L tab**
- Entity dropdown: Team / You (Owner) / Alpha Trader / Risk Sentinel
- Time filter buttons: 1H, 4H, 1D, 1W, ALL (deterministic chart data for each)
- Maximize + Help icon buttons
- PnL chart (Recharts AreaChart) with green gradient (upward trend)
- Entity table with 4 rows, each showing:
  - Current P&L (green for positive, red for negative)
  - Lifetime P&L (green/red)
  - Unrealized P&L (green/red)
  - Percentage badges (green/red background)
  - Blue dot indicator on selected entity

**Positions tab**
- Member filter dropdown: All Members / You (Owner) / Alpha Trader / Risk Sentinel
- **Open Perpetuals** section (7 positions):
  - LONG badge (green) — AAPL, NVDA, AMZN, COIN
  - SHORT badge (red) — TSLA, META, GOOG
  - Owner label — 3 positions
  - Agent label — 4 positions (2 per agent)
  - Positive PnL with green text + badge — 4 positions
  - Negative PnL with red text + badge — 3 positions
  - High leverage (10x) — TSLA
  - Close button on each position
- **Open Predictions** section (7 unresolved positions):
  - YES badge (green) — 4 positions
  - NO badge (red) — 3 positions
  - Owner label — 4 positions
  - Agent label — 3 positions
  - Positive unrealized PnL — 4 positions
  - Negative unrealized PnL — 2 positions
  - "Too Small" disabled button (shares < 0.01) — Mars colony
  - Truncated question text (> 40 chars) — S&P 500 question
  - Sell button on each normal position
- **Closed Perpetuals** section (6 positions):
  - LONG + CLOSED badges — 3 positions
  - SHORT + CLOSED badges — 3 positions
  - Positive realized PnL (green) — 3 positions
  - Negative realized PnL (red) — 3 positions
  - Owner (no agent name) — 3 positions
  - Agent name displayed — 3 positions
  - Date displayed — 5 positions
  - No date (closedAt = null) — 1 position
- **Trade confirmation dialog** — triggered by Close / Sell buttons
  - close-perp variant (shows ticker, size, leverage, entry/current price, PnL)
  - sell-prediction variant (shows question, side, shares, avg/current price, PnL)

**Other**
- Auth gate bypassed — page renders without login
- Polling disabled — stores seeded at import time, fetch methods replaced with no-ops
- WidgetSidebar rendered on right (XL+ screens)
- Loading skeletons visible briefly on initial mount
