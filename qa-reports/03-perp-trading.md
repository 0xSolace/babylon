# QA Report: Perpetual Trading

**Date:** 2026-03-04
**Tester:** Automated QA (Claude)
**Environment:** play.babylon.market (production)
**Auth:** Cookie-based privy-token (user: bluesquid678)

---

## Executive Summary

38 perpetual markets are available with max 100x leverage. Core trading flow (open/close/partial close/position stacking/position flipping) works correctly. Several bugs found: **3 critical (500 errors on expected edge cases), 2 high (history endpoint broken without limit param, stale funding data), and multiple medium issues** around data quality and missing features.

---

## Endpoints Tested

### 1. GET /api/markets/perps -- List All Markets

**Status:** 200 OK (public, no auth required)
**Response structure:**
```json
{
  "success": true,
  "markets": [{
    "ticker": "NVDAI",
    "organizationId": "nvidai",
    "name": "NVIDAI",
    "currentPrice": 1362.70438,
    "price24hAgo": 1390.08438,
    "change24h": -27.38,
    "changePercent24h": -1.97,
    "high24h": 1393.08438,
    "low24h": 1362.08438,
    "volume24h": 13489669.55,
    "openInterest": 159692.19,
    "fundingRate": {
      "rate": 0.01,
      "ticker": "NVDAI",
      "predictedRate": 0.01,
      "nextFundingTime": "2026-02-06T10:27:44.282Z"
    },
    "maxLeverage": 100,
    "minOrderSize": 10,
    "markPrice": 1362.72,
    "indexPrice": 1250
  }],
  "count": 38
}
```

**Findings:**
- 38 markets returned
- 2 markets with currentPrice=0: **CIA** and **DOW** (no markPrice/indexPrice either)
- All markets show `maxLeverage: 100`, `minOrderSize: 10`

### 2. GET /api/markets/perps/{ticker} -- Single Ticker Detail

**Status:** 404 (HTML not-found page)
**Bug:** This endpoint does NOT exist. No dedicated single-ticker detail endpoint is implemented. Clients must filter from the full list.

### 3. GET /api/markets/perps/{ticker}/history -- Price History

**Status:** 200 OK (public, no auth required) when called correctly
**Valid ranges:** `1H`, `4H`, `1D`, `1W`, `ALL` (docs say optional but it is effectively required)

**Response structure:**
```json
{
  "ticker": "NVDAI",
  "organizationId": "nvidai",
  "history": [{
    "price": 1335.48,
    "change": 0.40,
    "changePercent": 0.03,
    "timestamp": "2026-03-03T13:45:00.000Z",
    "openPrice": 1335.08,
    "highPrice": 1335.48,
    "lowPrice": 1335.08,
    "volume": 0
  }]
}
```

| Test Case | Result |
|-----------|--------|
| `?range=1D&limit=100` | 200 OK, returns data |
| `?range=1H&limit=5` | 200 OK, returns data |
| `?range=1W&limit=5` | 200 OK, 8 points |
| `?range=ALL&limit=5` | 200 OK, 12 points |
| `?range=4H&limit=3` | 200 OK, 1 point |
| `?range=1D` (no limit) | **400** - `{"error":"Validation failed","details":[{"field":"limit","message":"Invalid input: expected number, received NaN"}]}` |
| `?limit=200` (no range) | **400** - range validation error |
| No params | **400** - both limit and range validation errors |
| `?range=1M&limit=5` | **400** - `1M` not in valid enum |

#### BUG: History `limit` Parameter Not Optional (MEDIUM)

The `limit` query parameter is documented as optional with default 200, but calling without it returns 400. Root cause: the Zod schema uses `z.preprocess` to convert `null` to `undefined`, then `z.coerce.number()` which converts `undefined` to `NaN` before `.optional()` can intercept.

**File:** `apps/web/src/app/api/markets/perps/[ticker]/history/route.ts` line 77-81

#### BUG: `range` Parameter Not Optional (MEDIUM)

Schema marks `range` as `.optional()` but `searchParams.get('range')` returns `null` which the `.enum()` rejects. Calling with just `?limit=200` fails.

#### BUG: `1M` Range Not Supported (LOW)

Only `1H`, `4H`, `1D`, `1W`, `ALL` are valid. No monthly range available. Not documented anywhere in the UI.

### 4. GET /api/markets/perps/{ticker}/orderbook

**Status:** 404 (HTML not-found page)
**Finding:** No orderbook endpoint exists. The `OrderBookSchema` exists in shared validation code (`packages/shared/src/validation/schemas/trade.ts`) but no API route implements it.

### 5. POST /api/markets/perps/open -- Open Position

**Status:** 201 Created (requires auth)
**Note:** Ticker is passed in request body, NOT in URL path.

**Request body:**
```json
{
  "ticker": "CRFT",
  "side": "long",       // "long" | "short"
  "size": 10,           // positive number
  "leverage": 2,        // integer 1-100
  "maxSlippage": 0.01   // optional, 0-1
}
```

**Response:**
```json
{
  "position": {
    "positionId": "287578537248948224",
    "ticker": "CRFT",
    "side": "long",
    "size": 10,
    "leverage": 2,
    "entryPrice": 15.09,
    "liquidationPrice": 8.2995,
    "marginPaid": 5,
    "feePaid": 0.01,
    "balance": 1778.39
  },
  "marginPaid": 5,
  "fee": { "amount": 0.01, "referrerPaid": 0 },
  "newBalance": 1778.39
}
```

#### Validation Tests

| Test Case | Status | Result |
|-----------|--------|--------|
| Valid long | 201 | Position opened |
| Valid short | 201 | Position opened (or flips existing long) |
| size=0 | 400 | `"Size must be positive"` |
| size=-10 | 400 | `"Size must be positive"` |
| size=5 (below min 10) | **500** | `"An unexpected error occurred"` |
| leverage=0 | 400 | `"Minimum leverage is 1x"` |
| leverage=-1 | 400 | `"Minimum leverage is 1x"` |
| leverage=2.5 | 400 | `"Leverage must be an integer"` |
| leverage=101 | 400 | `"Maximum leverage is 100x"` |
| leverage="abc" | 400 | `"Invalid input: expected number, received string"` |
| side="UP" | 400 | `"Side must be either 'long' or 'short'"` |
| missing side | 400 | `"Side must be either 'long' or 'short'"` |
| ticker="NONEXISTENT" | **500** | `"An unexpected error occurred"` |
| ticker="CIA" (0 price) | **500** | `"An unexpected error occurred"` |
| size=1000000 (> balance) | **500** | `"An unexpected error occurred"` |
| No auth | 401 | `"Missing or invalid authorization header or cookie"` |
| maxSlippage=0.001 | 201 | Position opened (slippage accepted) |

#### BUG: Size Below Minimum Returns 500 (CRITICAL)

Opening with `size=5` when `minOrderSize=10` returns HTTP 500 instead of a proper 400 validation error. The `PerpOpenPositionSchema` only validates `size > 0`, not against the market's `minOrderSize`.

#### BUG: Invalid Ticker Returns 500 (CRITICAL)

Opening with a non-existent ticker returns HTTP 500 instead of 404 or 400 with a message like "Market not found".

#### BUG: Zero-Price Ticker Returns 500 (CRITICAL)

Opening on CIA/DOW (currentPrice=0) returns 500. These markets should either be hidden or return a proper error.

#### BUG: Size Exceeding Balance Returns 500 (HIGH)

Opening with size=1000000 returns 500 instead of a 400 "Insufficient balance" error.

### 6. Position Behaviors (Stack/Flip/Close)

#### Stacking (Same Side)

Opening a second position on the same ticker + same side **merges** into the existing position:
- Same positionId is returned
- Size is accumulated
- Entry price is averaged
- `isRebalance: true`, `rebalanceType: "add"` in response
- **Note:** Leverage from second open is IGNORED -- original leverage is kept

#### Flipping (Opposite Side, Larger)

Opening opposite side with larger size **closes** existing and opens new:
- New positionId is created
- Old position is closed with realized PnL
- Net size becomes the difference
- `isRebalance: true`, `rebalanceType: "flip"` in response

#### Closing via Opposite Side (Equal Size)

Opening opposite side with equal size **closes** the existing position:
- `isRebalance: true`, `rebalanceType: "close"` in response
- `remainingSize: 0`, `fullyClosed: true`

### 7. POST /api/markets/perps/position/{id}/close -- Close Position

**Status:** 200 OK (requires auth)

**Request body (optional):**
```json
{
  "percentage": 0.5,     // 0-1, partial close
  "slippage": 0.01       // 0-0.1, max slippage tolerance
}
```

**Full close response:**
```json
{
  "position": {
    "positionId": "...",
    "ticker": "BLPRNT",
    "side": "long",
    "size": 30,
    "leverage": 2,
    "entryPrice": 15.12,
    "exitPrice": 15.11,
    "liquidationPrice": 8.31,
    "realizedPnL": -0.013,
    "feePaid": 0.03,
    "marginPaid": 15,
    "balance": 1838.17,
    "remainingSize": 0,
    "fullyClosed": true
  },
  "grossSettlement": 14.99,
  "netSettlement": 14.96,
  "marginReturned": 15,
  "pnl": -0.013,
  "fee": { "amount": 0.03, "referrerPaid": 0 },
  "wasLiquidated": false,
  "newBalance": 1838.17
}
```

**Partial close (50%) response:**
```json
{
  "position": {
    "remainingSize": 5,
    "fullyClosed": false
  }
}
```

| Test Case | Status | Result |
|-----------|--------|--------|
| Full close (no body) | 200 | Position fully closed |
| Partial close (50%) | 200 | Half closed, half remains |
| Close remaining | 200 | Fully closed |
| With slippage | 200 | Accepted, closed |
| percentage > 1 | 400 | `"Too big: expected number to be <=1"` |
| percentage < 0 | 400 | `"Too small: expected number to be >=0"` |
| Non-existent position ID | **500** | `"An unexpected error occurred"` |
| Already-closed position | **500** | `"An unexpected error occurred"` |
| No auth | 401 | Proper error |

#### BUG: Close Non-Existent Position Returns 500 (HIGH)

Closing a position that doesn't exist or is already closed returns 500 instead of 404.

### 8. GET /api/markets/positions/{userId} -- User Positions

**Status:** 200 OK (public)

**Response structure:**
```json
{
  "perpetuals": {
    "positions": [{
      "id": "...",
      "ticker": "NVDAI",
      "side": "long",
      "entryPrice": 1362.69,
      "currentPrice": 1362.70,
      "size": 3600,
      "leverage": 1,
      "unrealizedPnL": -70.03,
      "unrealizedPnLPercent": -1.94,
      "liquidationPrice": 749.48,
      "fundingPaid": 0,
      "openedAt": "2026-03-04T12:29:39.016Z",
      "isAgentPosition": false,
      "agentId": null,
      "agentName": null
    }]
  }
}
```

**Finding:** This endpoint is public -- any user's positions can be viewed by anyone with their userId. This may be intentional for a game but is notable.

### 9. GET /api/markets/perps/trades/{ticker} -- Perp Trades

**Status:** 200 OK (public)

**Response structure:**
```json
{
  "trades": [
    { "type": "perp", "side": "long", "size": 10, "..." : "..." },
    { "type": "npc", "action": "buy", "reason": "...", "..." : "..." },
    { "type": "balance", "transactionType": "perp_close", "..." : "..." }
  ],
  "total": 5601,
  "hasMore": true,
  "ticker": "nvidai",
  "organization": { "name": "NVIDAI", "type": "company", "currentPrice": 1362.70 }
}
```

| Test Case | Status | Result |
|-----------|--------|--------|
| Valid ticker | 200 | Returns trades with pagination |
| Invalid ticker | 404 | `"Market not found"` (proper error) |
| limit/offset params | 200 | Pagination works |

### 10. GET /api/markets/perps/tune -- Tuning Parameters

**Status:** 200 OK (requires auth, admin-only per code)
**Note:** Returns hardcoded default values. The POST handler also accepts params but doesn't persist them -- it's a stub.

```json
{
  "success": true,
  "parameters": {
    "global": {
      "riskMultiplier": 1.0,
      "entryThreshold": 0.6,
      "exitThreshold": 0.4,
      "positionSizeMultiplier": 1.0,
      "sentimentOverride": null,
      "maxLeverageOverride": null
    }
  }
}
```

**Finding:** Despite `requireAdmin` in code, the authenticated non-admin user got 200 OK. Either the user has admin privileges, or the admin check is not working.

### 11. GET /api/trades -- Trade History

**Status:** 200 OK (requires auth)

**Finding:** The `?type=perp` filter does NOT work. Returns the same generic balance/prediction trades regardless of type filter. No perp-specific trades are returned from this endpoint.

### 12. Missing Endpoints

| Expected Endpoint | Status |
|-------------------|--------|
| GET /api/markets/perps/{ticker} (single ticker detail) | NOT IMPLEMENTED (404) |
| GET /api/markets/perps/{ticker}/orderbook | NOT IMPLEMENTED (404) |
| GET /api/markets/perps/positions (user's positions via perp path) | NOT IMPLEMENTED (404) |
| Limit orders | NOT IMPLEMENTED (no route exists) |
| Stop-loss / Take-profit orders | NOT IMPLEMENTED (schemas exist but no routes) |

---

## Funding Rate Issues

### BUG: All Funding Rates Identical and Stale (HIGH)

Every single market has:
- `rate: 0.01` (1%)
- `predictedRate: 0.01`
- `nextFundingTime: "2026-02-06T10:27:44.282Z"` (26 days in the past!)

This means:
1. Funding rates are not dynamic -- they appear hardcoded at 1%
2. The `nextFundingTime` is stale/never updated
3. `fundingPaid` on all positions is `0` -- funding is never actually charged

---

## Mark Price vs Index Price Divergence

Massive divergences between mark price and index price suggest the mark price (which equals the current trading price) has diverged significantly from the underlying "fair value" (index price):

| Ticker | Mark Price | Index Price | Divergence |
|--------|-----------|-------------|------------|
| TSLAI | 980.01 | 245.00 | **+300.0%** |
| METAI | 1766.76 | 520.00 | **+239.8%** |
| SPCX | 394.91 | 180.00 | **+119.4%** |
| AITRP | 800.64 | 380.00 | **+110.7%** |
| AIPPL | 68.06 | 225.00 | **-69.7%** |
| OPENAGI | 112.50 | 450.00 | **-75.0%** |

This level of divergence (100-300%) is extreme and would trigger liquidations and funding rebalancing in a real perp system. It indicates either:
- Index prices are not being updated
- The mark/index mechanism is decorative rather than functional
- No arbitrage or rebalancing mechanism exists

---

## Fee Structure

- Opening fee: ~0.1% of notional (size * price / leverage)
- Closing fee: ~0.1% of notional
- Fees calculated as `feePaid` in response
- Example: size=10, leverage=2, price=15.09 -> margin=5.00, fee=0.01

---

## Rate Limiting

| Action | Limit | Window |
|--------|-------|--------|
| Open position | 10 per minute | Per user |
| Close position | 10 per minute | Per user |
| Public reads | Higher limit | Per IP |

Rate limiting works correctly. Returns 429 with `retryAfter` field.

---

## Liquidation Mechanics

- Liquidation price is calculated and returned on every position
- `wasLiquidated: false` field present on close responses
- No evidence of automatic liquidation processing found in API testing
- All `fundingPaid: 0` on positions suggests no margin erosion from funding

### Liquidation Price Formula (Observed)

For LONG: `liquidationPrice ~ entryPrice * (1 - 1/leverage) * ~1.1` (approximate, includes maintenance margin)
For SHORT: `liquidationPrice ~ entryPrice * (1 + 1/leverage) * ~0.9` (approximate)

---

## PnL Calculation

PnL is calculated correctly based on entry vs exit price:
- LONG PnL: `(exitPrice - entryPrice) / entryPrice * size`
- SHORT PnL: `(entryPrice - exitPrice) / entryPrice * size`
- Results are properly returned as `realizedPnL` on close and `unrealizedPnL` on positions
- Very small PnL values show floating point precision issues (e.g., `2.065e-15`)

---

## Bug Summary

### Critical (P0)
1. **Size below `minOrderSize` returns 500** -- Should return 400 with "Minimum order size is 10"
2. **Invalid/non-existent ticker returns 500** -- Should return 404 "Market not found"
3. **Zero-price markets (CIA, DOW) cause 500 on open** -- Should be hidden or return proper error

### High (P1)
4. **History endpoint fails without `limit` param** -- `z.coerce.number()` on null/undefined produces NaN before `.optional()` can intercept
5. **All funding rates are hardcoded at 1% with stale `nextFundingTime`** from 2026-02-06 (26 days ago)
6. **Size exceeding balance returns 500** -- Should return 400 "Insufficient balance"
7. **Close non-existent/already-closed position returns 500** -- Should return 404

### Medium (P2)
8. **History `range` parameter is required** despite being documented as optional
9. **Mark/Index price divergence up to 300%** -- No rebalancing mechanism apparent
10. **`/api/trades?type=perp` filter does not work** -- Returns same generic trades
11. **Leverage ignored when stacking** -- Second position's leverage is silently dropped, original kept
12. **Tune endpoint returns hardcoded values** -- POST stub doesn't persist anything

### Low (P3)
13. **No `1M` (monthly) range** for history -- only 1H, 4H, 1D, 1W, ALL
14. **No single-ticker detail endpoint** -- Must filter from full list
15. **No orderbook endpoint** -- Schema exists but no route
16. **No limit/stop orders** -- Schema exists but no route
17. **Floating point precision** in PnL (e.g., `2.065e-15` instead of `0`)
18. **User positions endpoint is public** -- Anyone can view anyone's positions

---

## Files Referenced

| File | Description |
|------|-------------|
| `apps/web/src/app/api/markets/perps/route.ts` | GET /api/markets/perps |
| `apps/web/src/app/api/markets/perps/open/route.ts` | POST open position |
| `apps/web/src/app/api/markets/perps/position/[id]/close/route.ts` | POST close position |
| `apps/web/src/app/api/markets/perps/[ticker]/history/route.ts` | GET price history |
| `apps/web/src/app/api/markets/perps/trades/[ticker]/route.ts` | GET perp trades |
| `apps/web/src/app/api/markets/perps/tune/route.ts` | GET/POST tuning params |
| `apps/web/src/app/api/markets/positions/[userId]/route.ts` | GET user positions |
| `packages/shared/src/validation/schemas/trade.ts` | PerpOpenPositionSchema |
| `packages/shared/src/validation/schemas/market.ts` | ClosePerpPositionSchema |
