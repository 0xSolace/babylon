# Markets trending screener (`/markets/trending`)

Browse-first markets surface: perpetuals and predictions in a table layout, with a path into the full trading terminal. Shell navigation label **Terminal** routes here instead of opening the split-panel terminal immediately.

The page title is **Terminal** so it matches the nav item users tap to arrive here (shared vocabulary between chrome and page).

---

## Why this exists

| Problem | Approach |
|--------|----------|
| **Cognitive load** — Landing users on `MarketsTradingTerminal` forces chart + order UI before they know *what* is moving. | **Browse-first**: screener lists momentum and liquidity signals; **Trade** (perps) / **Predict** (predictions) opens `/markets` with the instrument pre-selected. |
| **DEX-style expectations** — Traders expect a scannable grid (sortable columns, sparklines, many columns). | **Visual parity where honest**: same *density* as external screeners; **no fake** on-chain fields (pool liq, buy/sell tx split, “paid” badges). |
| **Data truth** — Synthetic Babylon perps are not ERC-20s; inventing mcap/tax would mislead. | Columns map to real `PerpMarket` / prediction fields; tooltips explain **OI**, **24h %** vs **chart range**, and **funding**. |
| **Performance** — Dozens of rows × full history would DDoS our own API. | **IntersectionObserver** before `usePerpHistory`; cap rows (100 perps / 100 predictions). |
| **Search consistency** — Split filters per tab would double-fetch or diverge. | **Single** search bar, **debounced** via `useMarketsPageData`’s `deferredSearchQuery`, applies to whichever tab is active. |
| **Sort without backend churn** — Re-sorting a table should not hit `/api/markets/predictions` or perp APIs again; data is already in memory. | **Client-side sort** for both tables after the initial load: perps via `sortPerpsForScreener`, predictions via column sort inside `PredictionsScreenerTable` (`useMemo` over the row list). |
| **Rate limits** — Public read tier returns **429** under burst traffic; a single failed fetch should not strand the UI in “loading” forever. | **429 retries** with backoff + `Retry-After` in `useMarketsPageData` `fetchData`; **Strict Mode** mount cleanup resets `hasMountedRef` so the second mount still fetches predictions (see code comments there). |
| **Remember UX choices** — Users expect the screener to feel like a tool, not reset every visit. | **localStorage** for last **asset tab**, **perp sort**, and **prediction sort** (validated keys only; corrupt values fall back to defaults). **Why not session-only:** return visits and refresh should preserve intent without requiring accounts. |

---

## User flows

1. **Terminal** (sidebar / bottom nav) → `/markets/trending`.
2. **Perpetuals** — Click column headers to sort (trending composite, asset A–Z, price, 24h %, OI, volume, funding); filter string debounced; **Trade** on a row.
3. **Predictions** — Same filter bar; click **Market**, **YES %**, or **Volume** headers to sort (all client-side); **Predict** opens the terminal for that market.
4. **Deep link to terminal** — `/markets?marketKind=…&marketId=…&filter=…` (see below).

---

## Deep links into the terminal

Must stay aligned with `parseSelected()` in `MarketsTradingTerminal`:

| Asset | Query |
|-------|-------|
| Perp | `?marketKind=perp&marketId=<TICKER>&filter=perp` |
| Prediction | `?marketKind=prediction&marketId=<id>&filter=prediction` |

**Why `filter`:** Keeps the unified market list in the same “universe” (perp vs prediction) as the selection.

---

## localStorage keys (screener persistence)

| Key | Value | Default if missing/invalid |
|-----|--------|----------------------------|
| `screener:assetTab` | `perps` \| `predictions` | `perps` |
| `screener:perpSort` | JSON `{ key, dir }` per `ScreenerSortKey` | `{ key: 'trending', dir: 'desc' }` |
| `screener:predSort` | JSON `{ key, dir }` (`market` \| `yesPercent` \| `volume`) | `{ key: 'volume', dir: 'desc' }` |

**Why separate keys:** Perp and prediction sort dimensions differ; merging into one object would complicate validation and migrations.

---

## Code map

| Path | Role |
|------|------|
| `apps/web/src/app/markets/trending/page.tsx` | Route shell: tabs, shared search, `localStorage` restore/write, row builders. |
| `apps/web/src/app/markets/trending/_components/TrendingScreenerTable.tsx` | Perp table: sortable column headers, sparklines, tooltips. |
| `apps/web/src/app/markets/trending/_components/PredictionsScreenerTable.tsx` | Prediction table: client-side column sort, empty/loading states, **Predict** CTA. |
| `apps/web/src/app/markets/trending/_components/PerpSparklineCell.tsx` | Lazy sparkline from `usePerpHistory`. |
| `apps/web/src/app/markets/trending/_lib/sortPerpsForScreener.ts` | Pure perp sort + cap; trending weights mirror dashboard logic. |
| `apps/web/src/app/markets/_hooks/useMarketsPageData.ts` | Perp store, debounced filter, **one** predictions fetch, 429 retry, Strict Mode–safe mount effect. |
| `apps/web/src/app/markets/_lib/formatters.ts` | Screener/table formatting: `formatVolume` (T/Q), `formatPrice`, `formatChange24h`, `formatFundingApr`, `formatBalance`, prediction helpers. |
| `packages/testing/unit/markets/sort-perps-screener.test.ts` | Unit tests for perp sort. |
| `packages/testing/unit/markets/market-cards.test.ts` | Unit tests for markets `_lib/formatters` (guards, T/Q, funding, change %). |
| `packages/shared/src/utils/format.ts` | `formatCompactCurrency` / `formatCompactNumber` with T/Q for shared consumers. |

---

## Data mapping (perps vs DEX reference UI)

Reference UIs show mcap, pool liquidity, txn splits, etc. We intentionally **do not** show those unless the backend exposes them.

- **OI** — Open interest (notional in app points).
- **24h vol** — `volume24h`.
- **24h %** — Snapshot field; **not** recomputed for the chart’s timeframe (tooltips clarify).
- **Chart** — Driven by `usePerpHistory` after the row enters the viewport.

---

## Display & formatting

Dense tables break when **strings get wide** (wrong suffix tier) or **values are non-finite** (NaN/Infinity from API glitches). This section documents what we format, where, and **why**.

### Compact notional: K / M / B / T / Q

| Suffix | Magnitude (divide by) | Why it exists |
|--------|------------------------|---------------|
| K | 1e3 | Human-readable thousands without full digit strings. |
| M | 1e6 | Same for millions. |
| B | 1e9 | Same for billions — was the **top** tier before huge OI/volume blew columns. |
| T | 1e12 | Values above 1e12 were still shown as `X.XXB` with `X` enormous (e.g. 14 digits). **T** caps mantissa length. |
| Q | 1e15 | Same for quadrillion-scale notionals; keeps worst-case cell width bounded. |

**Where implemented**

- **Screener & prediction volume cells** — `apps/web/src/app/markets/_lib/formatters.ts` → `formatVolume` (ƀ prefix, 2 decimals per tier).
- **Shared package** — `packages/shared/src/utils/format.ts` → `formatCompactCurrency`, `formatCompactNumber` (engine, prompts, other UI).
- **Trading terminal market list** — `MarketsTradingTerminal.tsx` local `formatCompactNumber` for sidebar “Vol …” text (**why duplicate**: avoids importing shared into a file that already has many concerns; tiers kept in sync intentionally).

**Why not `Intl` compact notation everywhere**: We need a **stable ƀ + K/M/B/T/Q** vocabulary across NPC prompts, CLI-ish strings, and UI; custom tiers match product copy and tests.

**Floating-point caveat**: JavaScript `number` loses integer precision above `Number.MAX_SAFE_INTEGER`. Formatting is for **display**; sort and business logic should not rely on string round-trips for huge IDs.

### Finite guards and clamps (Price, 24h %, Fund., volume)

| Helper | Column / use | Non-finite | Clamp | Why |
|--------|----------------|------------|-------|-----|
| `formatPrice` | Perp price | `ƀ—` | — | Avoids `ƀNaN` / `ƀInfinity`. |
| `formatVolume` | OI, 24h vol, prediction volume | `ƀ—` | — | Same; negative signed rarely but supported for symmetry. |
| `formatChange24h` | 24h % | `—` | ±9999.99% | Prevents absurd `%` strings; color uses `Number.isFinite` so NaN is muted, not red/green. |
| `formatFundingApr` | Fund. | `—` | ±999.99% displayed | Engine caps near ~50% APR; clamp is **UI safety** for corrupt payloads, not economics. |
| `formatBalance` | (markets balances) | `ƀ—` | — | `toLocaleString(NaN)` is ugly; consistent with price. |

**Why em dash (U+2014)**: Single glyph, accessible “missing value” pattern; matches other panels (e.g. agents perp funding).

**Why sort unchanged**: `sortPerpsForScreener` compares **raw numbers**. Display formatting must not change ranking.

### Organization image in the Asset column

- **Path**: `/images/organizations/{organizationId}.jpg` under `apps/web/public/images/organizations/`.
- **Component**: `Avatar` with `type="business"`, `id={organizationId}`, `name={name}` for alt/fallback initial.
- **Why `Avatar`**: Centralizes static path, sanitize rules, and img `onError` → initials fallback.
- **Why `rounded-md` on the tile**: Screener uses **square tiles** with radius; default `Avatar` is `rounded-full` — merged `className` + wrapper `overflow-hidden` keeps the tile shape.
- **Numeric-only org ids**: `Avatar` skips static filename lookup for all-digit ids (snowflake-style); fallback initials still work until API supplies `imageUrl`.

---

## Navigation

- **Terminal** `href`: `/markets/trending`.
- **Active** when path is trending, root `/markets`, or legacy `/markets/perps/*` / `/markets/predictions/*` so the item stays highlighted across the markets journey.

---

## Testing

- **Unit**: `sortPerpsForScreener` modes; `market-cards.test.ts` for `apps/web/.../markets/_lib/formatters.ts`; `packages/testing/unit/shared/format.test.ts` for shared compact T/Q tiers.
- **E2E**: Synpress `ROUTES.MARKETS_TRENDING`, `data-testid="markets-trending-screener"` / `markets-trending-predictions`.

---

## Roadmap (intended next steps)

Prioritized by impact and dependency on backend work.

1. ~~**Redis cache-aside for list APIs + SSE predictions patching**~~ — **Shipped.** See [`markets-api-caching.md`](./markets-api-caching.md).
2. ~~**`usePerpMarketsPolling` on trending**~~ — **Shipped.** 30 s polling ensures perps refresh even during SSE reconnect gaps.
3. ~~**Optional server-side pagination**~~ — **Shipped.** `?page=N&limit=M` on both endpoints for external consumers.
4. **Batch / server sparklines** — **Why**: N visible rows still means N history streams; a single batch endpoint reduces fan-out and stabilizes p95 under scroll.
5. **Intraday list stats** — **Why**: If product needs list columns to match short time windows, the API must expose windowed aggregates (avoid client-side lies).
6. **Virtualized rows** — **Why**: When market count grows past ~100, DOM + observers cost rises; virtualization keeps scroll smooth.
7. **Column visibility (“eye” tool)** — **Why**: Power users on small laptops can hide OI or funding; low priority vs correctness.
8. ~~**Org avatars**~~ — **Shipped.** Static files at `public/images/organizations/{id}.jpg` + `Avatar type="business"` in `TrendingScreenerTable`. **Why**: Initials-only tiles read as broken logos; org art is curated, not synthetic token imagery.
9. **Prediction sort tests** — **Why**: Pure sort comparators for predictions could mirror `sort-perps-screener.test.ts` for regression safety.

Items we are **not** planning without domain support: DEX-style “paid listing”, tax %, buy/sell txn ratios, chain social links.

---

## Changelog (feature history)

See the root [`CHANGELOG.md`](../../CHANGELOG.md) **[Unreleased]** / dated sections for release notes. This file is the **design + rationale** source; the changelog is the **what shipped** log.

---

## Related

- Formatters entry: `apps/web/src/app/markets/_lib/README.md` (why web-specific formatting vs `@babylon/shared`)
- Dev entry: `apps/web/src/app/markets/trending/README.md`
- Full trading UI: `apps/web/src/app/markets/page.tsx` → `MarketsTradingTerminal`
- Public read rate limits: `packages/api/src/rate-limiting/README.md`
- Agent rules: [`CLAUDE.md`](../../CLAUDE.md) at repo root
