# QA Report: Prediction Markets & Perpetual Trading

**Date:** 2026-03-04
**Tester:** bluesquid678 (ben.b@elizalabs.ai)
**Starting Balance:** ~1,874 pts
**Ending Balance:** ~1,864 pts
**Environment:** play.babylon.market (API)

---

## TASK A: Prediction Markets

### A1. GET /api/markets/predictions

| Field | Value |
|-------|-------|
| HTTP Status | 200 |
| Response Time | ~0.3s |
| success | true |
| count | 20 (default, no status filter) |

**Response Structure (per question):**
```json
{
  "id": "287592328393129984",
  "text": "Will AIlon Musk ban...",
  "question": "Will AIlon Musk ban...",
  "status": "active",
  "resolution": null,
  "resolved": false,
  "resolutionDate": "2026-03-04T14:44:00.328Z",
  "endDate": "2026-03-04T14:44:00.328Z",
  "createdDate": "2026-03-04T14:29:14.334Z",
  "yesShares": 10000,
  "noShares": 10000,
  "yesProbability": 0.5,
  "noProbability": 0.5,
  "userPosition": null,
  "userPositions": [],
  "oracleCommitTxHash": null,
  "oracleRevealTxHash": null,
  "resolutionProofUrl": null,
  "resolutionDescription": null
}
```

**Key Observations:**
- `text` and `question` fields are duplicated (always identical)
- `resolutionDate` and `endDate` are identical on every market
- All questions follow same pattern: "Will AIlon Musk ban burp-powered AI..."
- Initial markets start at 50/50 (10000 yes / 10000 no shares)
- Oracle fields present but all null (commit/reveal tx hashes)

### A2. GET /api/markets/predictions?status=ACTIVE

| Field | Value |
|-------|-------|
| HTTP Status | 200 |
| count | 19 |

**BUG: Status filter is case-sensitive** - `?status=active` returns validation error: `"Invalid option: expected one of 'ACTIVE'|'RESOLVED'|'CANCELLED'"`. Only uppercase works. The API error message helpfully lists valid values, but this is inconsistent with the `status` field in responses which uses lowercase `"active"`.

### A3. GET /api/markets/predictions?status=RESOLVED

| Field | Value |
|-------|-------|
| HTTP Status | 200 |
| count | 19 |

**BUG: Resolved markets still show `status: "active"`** - The first resolved market (id=287585351701102592) returned `status="active"` and `resolution=null`, even though it was returned by the RESOLVED filter. Either the status field isn't updated after resolution, or the filter is wrong.

### A4. GET /api/markets/predictions/{id}

| Field | Value |
|-------|-------|
| HTTP Status | 200 |
| Response Time | 0.325s |

Single market detail adds `liquidity` and `tradeCount` fields not present in list response.

### A5. Pagination

| Query Param | Result |
|-------------|--------|
| `?page=2` | Empty/no JSON response |
| `?limit=5` | Empty/no JSON response |
| `?limit=5&offset=5` | Empty/no JSON response |
| (no params) | Returns all 20 markets |

**BUG: No pagination support.** The endpoint returns all markets in one response with no documented pagination params. The `count` field exists but `page`/`limit`/`offset` params are not functional.

### A6. BUY YES Position

```
POST /api/markets/predictions/{id}/buy
Body: {"side":"yes","amount":5}
```

| Field | Value |
|-------|-------|
| HTTP Status | 201 |
| Response Time | 0.318s |

**Response:**
```json
{
  "position": {
    "id": "287571245774405632",
    "marketId": "287436103655358464",
    "side": "yes",
    "shares": 1.1013413332939308,
    "avgPrice": 4.5353786777989855,
    "totalCost": 5
  },
  "market": {
    "yesPrice": 0.8193786010937216,
    "noPrice": 0.18062139890627835,
    "yesShares": 4695.0723806667065,
    "noShares": 21298.926165999997,
    "priceImpact": 0.008474806246290571,
    "liquidity": 105159.08523
  },
  "fee": { "amount": 0.005, "referrerPaid": 0 },
  "newBalance": 1869.07
}
```

**Share Math:**
- 5 pts spent -> 1.10 YES shares at avg price 4.54
- Fee: 0.005 (0.1% of amount)
- Market yesProbability was ~0.82, so YES shares are expensive
- Price impact: 0.85%

**API Documentation Note:** The task description says `{"outcome":"yes","amount":5}` but the actual field is `side`, not `outcome`. The API returns a clear validation error for this.

### A7. BUY NO Position

```
POST /api/markets/predictions/{id}/buy
Body: {"side":"no","amount":5}
```

| Field | Value |
|-------|-------|
| HTTP Status | 201 |
| Response Time | 0.385s |

**Response:**
- 5 pts -> 22.64 NO shares at avg price 0.221
- NO shares much cheaper (market strongly favors YES)
- Price impact: 17.4% (much higher due to low NO liquidity)
- Fee: 0.005 (same 0.1%)

### A8. SELL Shares

```
POST /api/markets/predictions/{id}/sell
Body: {"side":"yes","shares":1}  OR  {"side":"no","shares":2}
```

| Side | HTTP Status | Result |
|------|-------------|--------|
| YES (1 share) | 500 | `"An unexpected error occurred"` |
| NO (2 shares) | 500 | `"An unexpected error occurred"` |

**BUG (CRITICAL): Sell endpoint returns 500 for both YES and NO sides.** The sell functionality appears completely broken. Users cannot exit prediction market positions.

### A9. Edge Cases

| Test | HTTP | Response |
|------|------|----------|
| amount=0 | 400 | `"Amount must be positive"`, `"Minimum order size is B1"` |
| amount=-1 | 400 | `"Amount must be positive"`, `"Minimum order size is B1"` |
| amount=999999 | **500** | `"An unexpected error occurred"` |
| Buy on resolved market | **500** | `"An unexpected error occurred"` |

**BUG: amount=999999 returns 500 instead of 400.** Should return a validation error like "Insufficient balance" (user has ~1864 pts). The server crashes instead of validating against user balance.

**BUG: Buying on resolved/expired market returns 500 instead of a clear error** like "Market is resolved/expired". No user-friendly error message.

### A10. userPosition Not Populated

After buying YES and NO on market 287436103655358464, the `GET /api/markets/predictions/{id}` still shows:
```json
"userPosition": null,
"userPositions": []
```

**BUG: User positions not reflected in market detail response.** The buy response returns position data, but subsequent GET requests don't show user's holdings.

---

## TASK B: Perpetual Trading

### B1. GET /api/markets/perps

| Field | Value |
|-------|-------|
| HTTP Status | 200 |
| Response Time | 0.190s |
| count | 38 |

**Available Tickers (sample):**

| Ticker | Name | Price | 24h Change | Max Leverage | Min Order |
|--------|------|-------|------------|-------------|-----------|
| TSLAI | TeslAI | 980 | +1500% | 100x | 10 |
| OPENAGI | OpenAGI | 112.5 | -82.6% | 100x | 10 |
| CRFT | CrAIft Ventures | 15.1 | +193% | 100x | 10 |
| CIA | CIAI | 0 | 0 | 100x | 10 |
| DOW | Dept of War | 0 | 0 | 100x | 10 |
| METAI | MetAI | 2080 | +48.3% | 100x | 10 |
| NVDAI | NVIDAI | 1362.68 | -1.97% | 100x | 10 |

**Key Fields per Market:**
- `ticker`, `organizationId`, `name`, `currentPrice`
- `price24hAgo`, `change24h`, `changePercent24h`
- `high24h`, `low24h`, `volume24h`, `openInterest`
- `fundingRate` (rate, predictedRate, nextFundingTime)
- `maxLeverage`, `minOrderSize`
- `markPrice`, `indexPrice`

**Note:** CIA and DOW have `currentPrice: 0` with no volume — appear to be placeholder/inactive markets. `fundingRate.nextFundingTime` is "2026-02-06" for ALL markets (stale, ~1 month old).

### B2. GET /api/markets/perps/TSLAI/history?range=1D

| Field | Value |
|-------|-------|
| HTTP Status | 200 (with &limit=10) |
| Response Time | 0.231s |

**BUG: Missing limit param causes 400.** `?range=1D` alone returns validation error: `"Invalid input: expected number, received NaN"` for the `limit` field. The `limit` parameter should have a default value.

History returns 2-hour OHLCV candles with `price`, `change`, `changePercent`, `openPrice`, `highPrice`, `lowPrice`, `volume` (volume always 0 in returned data), `timestamp`.

### B3. Open Long Position

```
POST /api/markets/perps/open
Body: {"ticker":"TSLAI","side":"long","size":10,"leverage":2}
```

**NOTE:** The actual endpoint is `/api/markets/perps/open` with ticker in body, NOT `/api/markets/perps/TSLAI/open` as described in the task.

| Field | Value |
|-------|-------|
| HTTP Status | 201 |
| Response Time | 0.859s |

**Response:**
```json
{
  "position": {
    "positionId": "287593132344737792",
    "ticker": "TSLAI",
    "side": "long",
    "size": 10,
    "leverage": 2,
    "entryPrice": 980.01,
    "liquidationPrice": 539.0055,
    "marginPaid": 5,
    "feePaid": 0.01,
    "balance": 1859.06
  },
  "marginPaid": 5,
  "fee": { "amount": 0.01, "referrerPaid": 0 },
  "newBalance": 1859.06
}
```

**Margin Math:**
- Size 10 / Leverage 2 = 5 margin
- Fee: 0.01 (0.1% of size? Actually 0.1% of margin)
- Liquidation price: 539.0055 (entry 980 * (1 - 1/leverage + buffer))

### B4. Open Short Position

```
POST /api/markets/perps/open
Body: {"ticker":"OPENAGI","side":"short","size":10,"leverage":2}
```

| Field | Value |
|-------|-------|
| HTTP Status | 201 |
| Response Time | 0.369s |

**Response:**
- Entry: 112.49, Liquidation: 163.11
- Margin: 5, Fee: 0.01
- Short liquidation is above entry (correct)

### B5. Close Positions

```
POST /api/markets/perps/position/{positionId}/close
Body: {}
```

**NOTE:** Close endpoint is `/api/markets/perps/position/{id}/close`, NOT `/api/markets/perps/{ticker}/close` or `/api/markets/perps/close`.

| Position | HTTP | PnL | Fee |
|----------|------|-----|-----|
| TSLAI Long | 200 | -0.0002 | 0.01 |
| OPENAGI Short | 200 | -0.0018 | 0.01 |

**Close Response includes:**
- `grossSettlement`, `netSettlement`, `marginReturned`
- `pnl`, `wasLiquidated` (false), `fullyClosed` (true)
- `remainingSize` (0 for full close)

Both positions closed successfully with tiny losses (price barely moved).

### B6. Edge Cases

| Test | HTTP | Response |
|------|------|----------|
| leverage=101 | 400 | `"Maximum leverage is 100x"` |
| size=0 | 400 | `"Size must be positive"` |
| size=999999 | **500** | `"An unexpected error occurred"` |
| fake ticker "FAKECOIN" | **500** | `"An unexpected error occurred"` |

**BUG: size=999999 returns 500 instead of 400.** Should validate against user balance.

**BUG: Fake ticker returns 500 instead of 400.** Should return `"Ticker not found"` or similar user-friendly error.

### B7. GET /api/markets/perps/positions

Returns 404 (HTML page). **No discoverable endpoint to list open positions.**

### B8. /api/trades (Trade History)

| Field | Value |
|-------|-------|
| HTTP Status | 200 |
| Response Time | varies |
| trades returned | 50 |

The `/api/trades` endpoint returns a public activity feed of **NPC trades only**. User trades are NOT included. Each trade includes: `type` (always "npc"), `id`, `timestamp`, `user` (NPC details), `marketType`, `action`, `side`, `amount`, `price`, `sentiment`, `reason`.

**Note:** No discoverable endpoint for user's own trade history.

---

## Summary of Bugs Found

### Critical (P0)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| 1 | **Sell endpoint broken (500)** | POST .../sell | Cannot sell YES or NO shares. 500 error on all sell attempts. Users have no way to exit prediction positions. |

### High (P1)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| 2 | **Large amount causes 500** | POST .../buy, POST .../perps/open | amount=999999 / size=999999 returns 500 instead of balance validation error |
| 3 | **Buy on resolved market = 500** | POST .../buy | Should return 400 with "Market resolved" message |
| 4 | **Fake ticker = 500** | POST .../perps/open | Should return 400 with "Ticker not found" |
| 5 | **User positions not shown** | GET .../predictions/{id} | userPosition=null and userPositions=[] even after buying shares |

### Medium (P2)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| 6 | **Status filter case-sensitive** | GET .../predictions?status= | `active` fails, only `ACTIVE` works. Response returns lowercase `"active"`. Inconsistent. |
| 7 | **Resolved markets show status=active** | GET ?status=RESOLVED | Markets returned by RESOLVED filter still have `status: "active"` |
| 8 | **No pagination** | GET .../predictions | No limit/offset/page support. Returns all markets in one response. |
| 9 | **TSLAI history requires limit** | GET .../history?range=1D | Returns validation error without `&limit=N`. Should default. |
| 10 | **No user trade history endpoint** | /api/trades | Only shows NPC trades. No way to retrieve user's own trades via API. |
| 11 | **No positions list endpoint** | /api/markets/perps/positions | Returns 404. Cannot list open perp positions. |

### Low (P3)

| # | Bug | Endpoint | Details |
|---|-----|----------|---------|
| 12 | **Stale funding rate timestamps** | GET .../perps | All markets show `nextFundingTime: "2026-02-06"` (1 month ago) |
| 13 | **Duplicate text/question fields** | GET .../predictions | Both fields always identical — one should be removed |
| 14 | **endDate = resolutionDate** | GET .../predictions | Always identical. Purpose of having both is unclear. |
| 15 | **CIA/DOW markets at price 0** | GET .../perps | Appear to be placeholder markets with no trading activity |

---

## API Endpoint Reference (Discovered)

### Prediction Markets
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | /api/markets/predictions | List all. ?status=ACTIVE\|RESOLVED\|CANCELLED |
| GET | /api/markets/predictions/{id} | Single market detail (adds liquidity, tradeCount) |
| POST | /api/markets/predictions/{id}/buy | Body: `{"side":"yes\|no","amount":N}`. Min amount: 1 |
| POST | /api/markets/predictions/{id}/sell | Body: `{"side":"yes\|no","shares":N}`. **BROKEN (500)** |

### Perpetual Trading
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | /api/markets/perps | List all markets |
| GET | /api/markets/perps/{ticker}/history | Requires `?range=1D&limit=N` |
| POST | /api/markets/perps/open | Body: `{"ticker":"X","side":"long\|short","size":N,"leverage":N}` |
| POST | /api/markets/perps/position/{positionId}/close | Body: `{}` |

### Other
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | /api/trades | Public NPC trade feed (50 trades) |

---

## Market Structure: Prediction Markets (CPMM)

The prediction market uses a **Constant Product Market Maker (CPMM)** model:

- **Initial state:** 10,000 YES shares + 10,000 NO shares = 50/50 probability
- **Probability formula:** `yesProbability = noShares / (yesShares + noShares)`
- **Price impact** scales with trade size relative to liquidity pool
- **Fees:** 0.1% of trade amount (0.005 on a 5 pt trade)
- **Share pricing:** Buying YES when probability is high = expensive shares (4.54 per share at 82% yes). Buying NO when cheap = many shares (22.6 shares for 5 pts at 18% no)
- **Liquidity** field represents total pool value

## Market Structure: Perpetual Trading

- **Margin:** size / leverage (10 size / 2x leverage = 5 margin)
- **Fees:** 0.1% of margin (0.01 on 5 margin)
- **Liquidation (Long):** entryPrice * (1 - 1/leverage + buffer) — roughly 45% below entry at 2x
- **Liquidation (Short):** entryPrice * (1 + 1/leverage - buffer) — roughly 45% above entry at 2x
- **Mark/Index prices:** markPrice includes funding, indexPrice is oracle/reference
- **Funding rate:** Fixed 1% across all markets (appears non-dynamic)
- **Close settlement:** Returns margin + PnL - fees
