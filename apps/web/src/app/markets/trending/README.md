# `/markets/trending` — Markets screener

**Browse-first** markets page: tables for perpetuals and predictions before the heavy `MarketsTradingTerminal`.

## Quick links

- **Full documentation (WHY, roadmap, data mapping, localStorage keys):** [`docs/markets/trending-screener.md`](../../../../../../docs/markets/trending-screener.md)
- **Markets docs index:** [`docs/markets/README.md`](../../../../../../docs/markets/README.md)
- **Changelog:** root [`CHANGELOG.md`](../../../../../../CHANGELOG.md)

## Why this folder exists

Next.js App Router keeps route-specific UI next to `page.tsx`. The screener is **not** the same product surface as `MarketsTradingTerminal` (split chart + order flow), so it lives under `trending/` instead of bloating the terminal component.

## Local development

- Route: same origin as your web app, e.g. `https://localhost:3001/markets/trending` if using HTTPS dev on 3001.
- **Terminal** nav item lands here; row actions deep-link to `/markets` with `marketKind` / `marketId` / `filter`.

## Behavior notes (WHY in code)

| Concern | Where |
|--------|--------|
| Shared debounced search across tabs | `useMarketsPageData` → `deferredSearchQuery` |
| Perp sort + cap | `_lib/sortPerpsForScreener.ts` |
| Prediction column sort (no refetch) | `_components/PredictionsScreenerTable.tsx` |
| Predictions fetch, 429 retry, Strict Mode mount | `../_hooks/useMarketsPageData.ts` |
| Tab + sort persistence | `page.tsx` (`screener:*` localStorage keys) |

## Touch points when changing behavior

1. **URL contract** for Trade/Predict — must match `parseSelected` in `MarketsTradingTerminal.tsx`.
2. **Search** — do not bypass `deferredSearchQuery` for one tab without updating both.
3. **New columns** — only add fields that exist on `PerpMarket` / prediction types, or document API work in `docs/markets/trending-screener.md`.
4. **New localStorage keys** — document in `docs/markets/trending-screener.md` and validate reads in `page.tsx` (never trust raw `JSON.parse`).
