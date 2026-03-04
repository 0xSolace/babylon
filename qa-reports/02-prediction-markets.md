# QA Report: Prediction Markets Deep Dive

**Date:** 2026-03-04
**Tester:** ben.b@elizalabs.ai (limekiwi_dao)
**Environment:** https://play.babylon.market
**User ID:** did:privy:cml8l4kp8013xld0cm4jmcaa8

---

## 1. Executive Summary

The prediction markets system is a CPMM (Constant Product Market Maker) binary outcomes market seeded with AI-generated questions and NPC (AI character) traders. Markets are auto-generated with short timeframes (15 min to 2 days), all following the same absurdist theme template. Trading mechanics work correctly with proper validation. The system has significant quality and variety issues that would concern real users.

---

## 2. API Endpoints Discovered

### Working Endpoints

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/api/markets/predictions?limit=N` | OK | Lists active markets. Default sort by endDate ascending |
| GET | `/api/markets/predictions?status=ACTIVE` | OK | Accepted values: `ACTIVE`, `RESOLVED`, `CANCELLED` |
| GET | `/api/markets/predictions?status=RESOLVED` | BROKEN | Returns active markets regardless (see Bug #1) |
| GET | `/api/markets/predictions?status=CANCELLED` | BROKEN | Same issue |
| GET | `/api/markets/predictions?sort=volume` | IGNORED | Returns same order as default |
| GET | `/api/markets/predictions?sort=newest` | IGNORED | Returns same order as default |
| GET | `/api/markets/predictions?sort=ending_soon` | IGNORED | Returns same order as default |
| GET | `/api/markets/predictions?category=crypto` | IGNORED | Returns all markets (no categories) |
| GET | `/api/markets/predictions?limit=N&offset=N` | OK | Pagination works |
| GET | `/api/markets/predictions/{id}` | OK | Full detail (includes `liquidity`, `tradeCount`) |
| GET | `/api/markets/predictions/{id}/trades` | OK | Full trade history |
| POST | `/api/markets/predictions/{id}/buy` | OK | Body: `{"amount":N,"side":"yes"|"no"}` |
| POST | `/api/markets/predictions/{id}/sell` | OK | Body: `{"shares":N,"side":"yes"|"no"}` |
| GET | `/api/markets/bias/active` | OK | Returns empty `{"biases":[],"count":0}` |

### Non-existent / 404 Endpoints

| Endpoint | Returns |
|----------|---------|
| `/api/markets/predictions/{id}/comments` | HTML 404 |
| `/api/markets/predictions/{id}/resolve` | HTML 404 |
| `/api/markets/positions/{userId}` | HTML 404 |
| `/api/markets/positions` | HTML 404 |
| `/api/user/positions` | HTML 404 |

---

## 3. Market Schema

### List View (from `/api/markets/predictions`)

```json
{
  "success": true,
  "questions": [...],
  "count": 17
}
```

### Market Object (List View)

```json
{
  "id": "287542687844794368",              // Snowflake-style ID
  "text": "Will AIlon Musk ban...",         // Duplicate of question
  "question": "Will AIlon Musk ban...",     // Same as text
  "status": "active",                       // Only seen: "active"
  "resolution": null,                       // null when unresolved
  "resolved": false,
  "resolutionDate": "2026-03-04T13:23:11Z", // Same as endDate
  "endDate": "2026-03-04T13:23:11Z",
  "createdDate": "2026-03-04T11:11:59Z",
  "yesShares": 14001.903482,               // Current YES pool
  "noShares": 7141.88611,                  // Current NO pool
  "yesProbability": 0.3377770138566937,     // Derived from shares
  "noProbability": 0.6622229861433062,
  "userPosition": null,                     // ALWAYS null (Bug #2)
  "userPositions": [],                      // ALWAYS empty (Bug #2)
  "oracleCommitTxHash": null,              // On-chain oracle fields
  "oracleRevealTxHash": null,
  "resolutionProofUrl": null,
  "resolutionDescription": null
}
```

### Market Object (Detail View - additional fields)

```json
{
  "liquidity": 82237.7,    // Only in detail view
  "tradeCount": 28         // Only in detail view
}
```

### Status Filter Validation

```
Valid options: "ACTIVE" | "RESOLVED" | "CANCELLED"
// Case-sensitive: "resolved" returns validation error
// "RESOLVED" and "CANCELLED" accepted but return ACTIVE markets (Bug #1)
```

---

## 4. CPMM Market Maker Mechanics

### Constant Product Formula

The system uses a standard **x*y=k** CPMM identical to Uniswap v2:

```
k = yesShares * noShares = constant
```

**Verified mathematically:**

| Market | yesShares | noShares | k (product) |
|--------|-----------|----------|-------------|
| Watermelon | 12,086.68 | 8,273.57 | 100,000,000.05 |
| Guava | 4,696.17 | 21,293.93 | ~100,000,000 |
| Persimmon | 9,045.01 | 11,055.83 | ~100,000,000 |

**All markets have k = 100,000,000 (initial pool: 10,000 YES x 10,000 NO).**

### Price Derivation

```
P(yes) = noShares / (yesShares + noShares)
P(no) = yesShares / (yesShares + noShares)
P(yes) + P(no) = 1.0 (always)
```

This was verified to match the API's reported `yesProbability` to 16 decimal places.

### Initial Pool Setup

- Every market starts with **10,000 YES shares** and **10,000 NO shares**
- Initial probability: **50/50**
- Initial k: **100,000,000**
- No variation in initial liquidity across markets

### Fees

| Fee Type | Rate | Applied To |
|----------|------|------------|
| Trading fee | **0.1%** | Both buy and sell amounts |
| Referrer fee | 0 | Always zero in testing |

Example: 5 pts buy -> 0.005 fee. 2.267 pts sell -> 0.00227 fee.

### Price Impact

Price impact varies significantly based on trade size relative to pool depth:

| Trade | Amount | Price Impact |
|-------|--------|-------------|
| Guava YES buy | 5 pts | 0.85% |
| Watermelon NO buy | 5 pts | 3.36% |
| Orange YES buy | 5 pts | 6.84% |

The variation is due to different pool states (deeper pools = less impact), not trade size.

### Slippage

No explicit slippage tolerance parameter was found in the buy/sell API. The API executes at whatever the current price is. There is no `maxSlippage` or `minShares` parameter.

---

## 5. Trading Mechanics

### Buy Response Schema

```json
{
  "position": {
    "id": "287571245774405632",
    "marketId": "287436103655358464",
    "side": "yes",
    "shares": 1.1016235025072092,
    "avgPrice": 4.534216988500853,
    "totalCost": 5
  },
  "market": {
    "yesPrice": 0.8193406896371914,
    "noPrice": 0.1806593103628086,
    "yesShares": 4695.673722497493,
    "noShares": 21296.198565,
    "priceImpact": 0.008477671119043803,
    "liquidity": 105156.35762899999
  },
  "fee": {
    "amount": 0.005,
    "referrerPaid": 0
  },
  "newBalance": 1804.65
}
```

### Sell Response Schema

```json
{
  "sharesSold": 0.5,
  "grossProceeds": 2.267398932159267,
  "netProceeds": 2.265131533227108,
  "pnl": -0.004246344650769895,
  "market": {
    "yesPrice": 0.8193091662297972,
    "noPrice": 0.18069083377020279,
    "yesShares": 4696.173722,
    "noShares": 21293.93116606784,
    "priceImpact": -0.0038474133501190983,
    "liquidity": 105154.09023006784
  },
  "fee": {
    "amount": 0.002267398932159267,
    "referrerPaid": 0
  },
  "remainingShares": 0.6016239999999999,
  "positionClosed": false,
  "newBalance": 1796.92,
  "positionId": "287571245774405632"
}
```

### Validation Rules

| Input | Validation | Error Message |
|-------|-----------|---------------|
| amount <= 0 | Rejected | "Amount must be positive" |
| amount < 1 | Rejected | "Minimum order size is 1" |
| side not yes/no | Rejected | "Side must be either 'yes' or 'no'" |
| Sell more than owned | Generic error | "An unexpected error occurred" |
| Buy on expired market | Generic error | "An unexpected error occurred" |
| Buy > balance (100000) | Generic error | "An unexpected error occurred" |

### My Trading Activity

| Action | Market | Amount | Shares | Effective Price |
|--------|--------|--------|--------|----------------|
| BUY YES | Guava (2-day) | 5 pts | 1.1016 | 4.54/share |
| BUY NO | Watermelon (12hr) | 5 pts | 3.4206 | 1.46/share |
| BUY YES | Orange Peel | 5 pts | 6.9265 | 0.72/share |
| SELL YES | Guava (partial) | 0.5 shares | -- | 2.27 returned |

**Final balance:** 1796.92 pts (started ~1809.65)

---

## 6. Trade History Analysis

### Trade Object Schema (NPC)

```json
{
  "id": "287559013472665600",
  "type": "npc",
  "user": {
    "id": "jordain-peterson",
    "username": "jordain-peterson",
    "displayName": "JordAIn Peterson",
    "profileImageUrl": null,
    "isActor": true
  },
  "marketType": "prediction",
  "ticker": "",
  "action": "buy_yes",           // "buy_yes" | "buy_no"
  "side": "YES",
  "amount": 2000,                // Points spent
  "price": 410.78,               // Shares received? (naming confusing)
  "sentiment": 0.77,             // -1.0 to 1.0
  "reason": "Jordain is following the momentum...",
  "timestamp": "2026-03-04T12:16:51.361Z"
}
```

### Trade Object Schema (Human)

```json
{
  "id": "287571318973399040",
  "type": "balance",             // "balance" for human trades
  "user": {
    "id": "did:privy:cml8l4kp8013xld0cm4jmcaa8",
    "username": "limekiwi_dao",
    "displayName": "limekiwi_dao",
    "profileImageUrl": "https://...",
    "isActor": false
  },
  "transactionType": "pred_buy", // "pred_buy" | "pred_sell"
  "amount": -5,                  // Negative for buys, positive for sells
  "timestamp": "2026-03-04T13:05:45.252Z",
  "marketId": "287436103655358464"
}
```

**Key difference:** NPC trades have `action`, `side`, `sentiment`, `reason`, `price` fields. Human trades have `transactionType` and different `amount` semantics (balance change, not trade size).

### NPC Trader Roster (Observed)

AI parodies of real public figures (all with "AI" puns in names):

| NPC Username | Display Name | Notes |
|-------------|-------------|-------|
| sam-ailtman | Sam AIltman | High amounts (3000) |
| jordain-peterson | JordAIn Peterson | Momentum trader |
| kanyai-west | KanyAI West | Unhinged reasoning text |
| jim-craimer | Jim CrAImer | -- |
| steven-craiwder | Steven CrAIwder | -- |
| ryain-cohen | RyAIn Cohen | -- |
| larry-faink | Larry FAInk | -- |
| muraid | MurAId | -- |
| demis-hassaibis | Demis HassAIbis | -- |
| paul-graiham | Paul GrAIham | -- |
| nassaim-taleb | NassAIm Taleb | -- |
| amjad-masaid | Amjad MasAId | -- |
| cameron-wainklevoss | Cameron WAInklevoss | -- |
| tyler-wainklevoss | Tyler WAInklevoss | -- |
| reid-hoffmain | Reid HoffmAIn | -- |
| tailyor-lorenz | TAIylor Lorenz | -- |
| donaild-trump-jr | DonAIld Trump Jr | -- |
| mairjorie-tailor-greene | MAIrjorie TAIlor Greene | -- |
| tulsai-gabbard | TulsAI Gabbard | -- |
| mitch-mcconnai | Mitch McConnAI | -- |
| glenn-greenaiwald | Glenn GreenAIwald | -- |
| logain-paul | LogAIn Paul | -- |
| mario-nawfal | Mario NAWfal | -- |
| chamaith-palihapitiya | ChamAIth Palihapitiya | -- |
| andrew-taite | Andrew TAIte | -- |
| jason-calacainis | Jason CalacAInis | -- |
| bill-aickman | Bill AIckman | -- |
| yainn-lecun | YAInn LeCun | -- |
| brain-roemmele | BrAIn Roemmele | -- |
| aellai | AellAI | -- |
| aindre-cronje | AIndre Cronje | -- |
| zohran-mamdanai | Zohran MamdanAI | -- |
| john-ratclaiffe | John RatclAIffe | -- |
| maiggie-haberman | MAIggie Haberman | -- |

**30+ unique NPC traders observed.** All have `isActor: true` and `profileImageUrl: null`.

### NPC Trading Patterns

- **Amount range:** 800 - 3,000 pts per trade
- **Sentiment range:** -0.85 to +0.85
- **All provide reasoning text** (AI-generated, in-character)
- **Actions:** Only `buy_yes` and `buy_no` observed (NPCs never sell)
- NPCs trade with large amounts relative to human trades
- NPCs dominate all markets by volume

### Human Trading Activity Observed

Only 2 unique human traders across all markets examined:
1. **limekiwi_dao** (me) - small test trades
2. **wlt** (wlt.vibe) - Large trader: 1000pt buys, 2920pt and 7041pt sells

---

## 7. Market Quality & Variety Analysis

### CRITICAL ISSUE: All Markets Are Template-Generated Nonsense

Every single market (17/17 active) follows the **exact same template:**

```
"Will AIlon Musk ban burp-powered AI [modifier] [fruit/plant part] [device type]
in MetAI's 12D [category] labs within [timeframe]?"
```

**Template variables observed:**

| Slot | Values |
|------|--------|
| Modifier | "financier", "blood", "financier financier", (empty) |
| Fruit/Plant | tamarind shell, papaya seed, dragonfruit peel, kumquat flesh, quince rind, passionfruit rind, durian aril, persimmon seed, mango peel, coconut husk, kiwi core, guava core, orange peel, watermelon rind, dragonfruit membrane, fig leaf |
| Device Type | diffusers, regulators, oscillators, modulators, amplifiers |
| Lab Category | spice, seed, fruit, juice, nut, tropical, bio, hydration, citrus, coral |
| Timeframe | 12 min, 15 min, 16 min, 26 min, 30 min, 56 min, 1 hour, 2 hours, 6 hours, 12 hours, 2 days |

### Market Timeframes Distribution

| Timeframe | Count |
|-----------|-------|
| < 30 minutes | 6 |
| 30 min - 1 hour | 3 |
| 1-2 hours | 4 |
| 6-12 hours | 2 |
| 1-2 days | 2 |

**Most markets are extremely short-lived (< 1 hour).** By the time of testing, several had already passed their endDate but still showed `status: "active"`.

### Categories

No real category system exists. The `?category=X` filter is accepted but ignored -- all markets are returned regardless of the value.

### Creator Diversity

**Zero.** All markets appear to be system-generated. There is no `creator` or `createdBy` field in the market schema. There is no user-created market capability evident.

---

## 8. Positions Tracking

### Bug: userPosition Always Null

Despite having active positions (confirmed via buy/sell responses), the market detail endpoint always returns:
```json
"userPosition": null,
"userPositions": []
```

This means there is **no way for a user to view their aggregate positions** through the API. The only confirmation of holdings comes from the buy/sell response itself.

### No Portfolio Endpoint

Attempted endpoints that all returned 404:
- `/api/markets/positions/{userId}`
- `/api/markets/positions`
- `/api/user/positions`

**Users cannot see their full portfolio of prediction market positions.**

---

## 9. Bias System

The `/api/markets/bias/active` endpoint returned:
```json
{"success": true, "biases": [], "count": 0}
```

The bias system exists in the API but has no active biases. Purpose unknown -- possibly for nudging NPC trading behavior or market creation patterns.

---

## 10. Oracle / Resolution System

Markets include on-chain oracle fields:
- `oracleCommitTxHash` - null on all active markets
- `oracleRevealTxHash` - null on all active markets
- `resolutionProofUrl` - null
- `resolutionDescription` - null
- `resolutionDate` - always equals `endDate`

The resolve endpoint (`/api/markets/predictions/{id}/resolve`) returns 404, suggesting resolution is handled internally/by admin only.

**No resolved markets were observable** despite the RESOLVED status filter being accepted. This means either:
1. No markets have ever been resolved
2. Resolved markets are purged from the API
3. The status filter is non-functional (most likely, see Bug #1)

---

## 11. Bugs & Issues Found

### Bug #1: Status Filter Non-Functional (HIGH)

**Severity:** High
**Steps:** GET `/api/markets/predictions?status=RESOLVED`
**Expected:** Return only resolved markets
**Actual:** Returns all active markets, identical to `?status=ACTIVE`
**Impact:** Users cannot browse resolved markets or track resolution history

### Bug #2: userPosition Always Null (HIGH)

**Severity:** High
**Steps:** Buy a position on any market, then GET the market detail
**Expected:** `userPosition` should reflect current holdings
**Actual:** Always `null`, `userPositions` always `[]`
**Impact:** Users cannot see their positions on market detail pages

### Bug #3: No Portfolio View Endpoint (HIGH)

**Severity:** High
**Steps:** Try any variation of `/api/markets/positions/*`
**Expected:** Should return user's open positions across all markets
**Actual:** 404 on all attempted paths
**Impact:** No way to track portfolio of prediction positions

### Bug #4: Sort Parameters Ignored (MEDIUM)

**Severity:** Medium
**Steps:** GET `/api/markets/predictions?sort=volume` (or `newest`, `ending_soon`)
**Expected:** Markets sorted by specified criteria
**Actual:** Same order regardless of sort value
**Impact:** Poor discoverability of interesting markets

### Bug #5: Category Filter Ignored (MEDIUM)

**Severity:** Medium
**Steps:** GET `/api/markets/predictions?category=crypto`
**Expected:** Filtered results or error for invalid category
**Actual:** Returns all markets unchanged, silently ignores parameter
**Impact:** No way to filter by topic

### Bug #6: Generic Error on Expired Market Buy (MEDIUM)

**Severity:** Medium
**Steps:** POST buy on a market past its endDate
**Expected:** Clear error: "Market has ended" or similar
**Actual:** `{"error":"An unexpected error occurred"}`
**Impact:** Poor user experience, unclear why trade failed

### Bug #7: Generic Error on Insufficient Balance (MEDIUM)

**Severity:** Medium
**Steps:** POST buy with amount exceeding balance (e.g. 100,000)
**Expected:** Clear error: "Insufficient balance"
**Actual:** `{"error":"An unexpected error occurred"}`
**Impact:** No useful feedback to user

### Bug #8: Generic Error on Overselling (MEDIUM)

**Severity:** Medium
**Steps:** POST sell with shares exceeding owned position
**Expected:** Clear error: "Insufficient shares"
**Actual:** `{"error":"An unexpected error occurred"}`
**Impact:** No useful feedback to user

### Bug #9: Expired Markets Still Show as Active (MEDIUM)

**Severity:** Medium
**Steps:** List markets, observe several with `endDate` in the past
**Expected:** Should be resolved or removed from active list
**Actual:** Still show `status: "active"` with past endDates
**Impact:** Users see stale markets they can't trade on

### Bug #10: text and question Fields Are Duplicates (LOW)

**Severity:** Low
**Steps:** Inspect any market object
**Expected:** `text` and `question` should serve different purposes (e.g., title vs full question)
**Actual:** Always identical
**Impact:** Wasted payload, confusing schema

### Bug #11: No Slippage Protection (MEDIUM)

**Severity:** Medium
**Steps:** Submit a buy order with no slippage parameter
**Expected:** API should accept `maxSlippage` or `minShares` to protect users
**Actual:** No such parameter exists; trades execute at any price
**Impact:** Users vulnerable to front-running or unexpected price moves, especially in low-liquidity markets

### Bug #12: NPC Trade "price" Field Semantics Unclear (LOW)

**Severity:** Low
**Steps:** Examine NPC trade objects
**Observed:** NPC buys 2000 pts, `price` field shows 410.78
**Expected:** `price` should be per-share cost
**Actual:** Appears to be shares received (not price), making the field name misleading

---

## 12. Market Content Quality Assessment

### Problems

1. **Zero variety:** All 17 markets are the same nonsensical AI-generated template about "AIlon Musk banning burp-powered AI" devices. No real-world questions, no political questions, no crypto questions, no sports questions.

2. **No resolution criteria:** Markets have no description, rules, or resolution criteria beyond the question text. How would "Will AIlon Musk ban burp-powered AI blood blood kumquat flesh regulators" be resolved?

3. **Meaningless questions:** The questions are gibberish. There is no real-world event to predict. This undermines the entire purpose of a prediction market.

4. **Very short timeframes:** Most markets expire within 30-60 minutes, giving users little time to discover and trade.

5. **No creator diversity:** All markets are system-generated. No user-created markets.

6. **NPC-dominated trading:** Human participation appears minimal (2 humans vs 30+ NPCs across all markets).

---

## 13. Summary of CPMM Parameters

| Parameter | Value |
|-----------|-------|
| Model | Constant Product (x*y=k) |
| Initial YES shares | 10,000 |
| Initial NO shares | 10,000 |
| Initial k | 100,000,000 |
| Initial probability | 50/50 |
| Trading fee | 0.1% |
| Referrer fee | 0% (unused) |
| Minimum order | 1 pt |
| Slippage protection | None |
| Price formula | P(yes) = noShares/(yesShares+noShares) |

---

## 14. Recommendations

1. **Fix status filter** to allow browsing resolved/cancelled markets
2. **Fix userPosition** to reflect user's actual holdings
3. **Add portfolio endpoint** for viewing all open positions
4. **Add real market questions** -- crypto prices, world events, platform milestones
5. **Add resolution criteria** to each market
6. **Improve error messages** for expired markets, insufficient balance, overselling
7. **Add slippage tolerance** parameter to protect users
8. **Add sort/filter functionality** that actually works
9. **Add comments/discussion** on markets
10. **Allow user-created markets** for organic content
11. **Diversify timeframes** -- add more multi-day and weekly markets
12. **Fix expired markets** to auto-resolve or at least show correct status

---

## 15. Retest Findings (2026-03-04, Session 2)

**Tester:** bluesquid678 (automated QA retest)

### Confirmed Bugs (Still Present)

| Bug # | Status | Notes |
|-------|--------|-------|
| #1 Status filter non-functional | **CONFIRMED** | `?status=RESOLVED` and `?status=CANCELLED` both return only active markets |
| #2 userPosition always null | **CONFIRMED** | After buying YES and NO on market ...655296, detail still shows null |
| #3 No portfolio endpoint | **CONFIRMED** | `/api/markets/predictions/{id}/positions` returns HTML 404 |
| #6 Generic error on expired buy | **CONFIRMED** | 500 instead of clear message |
| #7 Generic error on large amount | **CONFIRMED** | `amount: 9999999` returns 500 |
| #8 Generic error on overselling | **CONFIRMED** | `shares: 99999` returns 500 |
| #9 Expired markets still active | **CONFIRMED** | 1 of 14 markets past endDate but status=active |
| #10 text/question duplicate | **CONFIRMED** | All 14 markets identical |
| #11 No slippage protection | **CONFIRMED** | No `maxSlippage` or `minShares` param |

### New Bugs Found

#### Bug #13: Sell Without positionId Returns 500 (MEDIUM)

**Steps:** POST `/api/markets/predictions/{id}/sell` with `{"side":"yes","shares":1}` (no `positionId`)
**Expected:** 400 with validation error telling user to include positionId
**Actual:** `{"error":"An unexpected error occurred"}` (500)
**Note:** Selling works fine with `positionId` included (even without `side` field). The `side` is inferred from the position.

#### Bug #14: Buy on Non-Existent Market Returns 500 (MEDIUM)

**Steps:** POST `/api/markets/predictions/000000000000000000/buy` with valid body
**Expected:** 404 "Market not found"
**Actual:** `{"error":"An unexpected error occurred"}` (500)

#### Bug #15: Can Sell on Expired Market (MEDIUM)

**Steps:** POST sell on market ...655296 (endDate in the past)
**Expected:** Reject with "market expired" or similar
**Actual:** Sell succeeds (200), shares sold, proceeds returned
**Impact:** Inconsistent with buy behavior (which returns 500 on expired). Either both should work or neither.

#### Bug #16: Pagination Ignored on Predictions List (MEDIUM)

**Steps:** GET `/api/markets/predictions?limit=2` or `?page=1&limit=5` or `?offset=0&limit=3`
**Expected:** Paginated results
**Actual:** All return full set (13-14 results). `count` field exists but pagination params ignored.
**Note:** Pagination DOES work on `/api/trades` endpoint (limit/offset functional).

#### Bug #17: "categories" and "trending" Misroute (LOW)

**Steps:** GET `/api/markets/predictions/categories` or `/api/markets/predictions/trending`
**Expected:** Either valid endpoint or proper 404
**Actual:** `{"error":"Market not found"}` (404) -- "categories"/"trending" treated as a market ID by the single-market handler

### Sell Endpoint Documentation (New Detail)

The sell endpoint requires `positionId` (obtained from buy response) and `shares` count. The `side` field is optional -- inferred from position.

**Minimum sell:** 0.01 shares
**Working payload:** `{"shares": 2, "positionId": "287578198214967296"}`

### Trade History Filtering (New Detail)

`/api/trades` supports:
- `?transactionType=pred_buy` -- works, filters to prediction buys only
- `?transactionType=pred_sell` -- works
- `?limit=N&offset=N` -- pagination works
- `?type=prediction` -- does NOT filter (returns all types)

### Fee Structure Confirmation

Fee = 0.1% of trade amount for both buys and sells.
`referrerPaid` field always 0, even when `referrer` field provided in buy request body.

### Case Sensitivity Inconsistency Detail

| Parameter | Required Case | Example |
|-----------|---------------|---------|
| `status` query param | UPPERCASE | `?status=ACTIVE` |
| `side` body field | lowercase | `"side": "yes"` |
| NPC trade `side` field | UPPERCASE | `"side": "YES"` |
| NPC trade `action` field | lowercase | `"action": "buy_yes"` |

Four different casing conventions across the same domain.
