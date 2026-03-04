# QA Report 07: NFT, Access Control, Waitlist & Onchain Features

**Tester**: ben.b@elizalabs.ai (did:privy:cml8l4kp8013xld0cm4jmcaa8)
**Date**: 2026-03-04
**Wallet**: 0x91ddb283efcaf5359cbf6e3b05be839a7f448805
**Environment**: play.babylon.market (production)

---

## 1. NFT System

### 1.1 Collection Overview

The NFT collection is a set of 100 unique "Monkey" NFTs serving as **onchain identity tokens** inside Babylon.

| Metric | Value |
|--------|-------|
| Total NFTs | 100 (token IDs 1-100) |
| Claimed | 55 (55%) |
| Unclaimed | 45 (45%) |
| Contract | `0x509929f54c069Aa47f52Beb8264876b4e13FCda9` |
| Chain | Ethereum Mainnet (chainId: 1) |
| Image Resolution | 4096x4096 PNG |
| Metadata | IPFS (`ipfs://bafybeib5c6iiq54iav7z3ogeiitf5zvysk7fca544w2qembyfxtd7xc5cm/{tokenId}.json`) |

### 1.2 NFT Attributes

Each NFT has a unique name (e.g., "WireMonkey", "ChromeMonkey", "SillyMonkey") and attributes:
- **BackgroundColors**: e.g., "Yellow"
- **Face**: e.g., "Base"
- **Mouth**: e.g., "Pursed", "Wide"
- **Body**: e.g., "Wire-Bright", "Base"
- **Eyes**: e.g., "Base", "Excited"
- **Glasses** (optional): e.g., "SwirlyRound"
- **Head** (optional): e.g., "Mustache"

Each NFT has a **story** with a title and lore content.

### 1.3 NFT Description

All NFTs share the same description:
> "Your onchain identity inside Babylon, the social arena where humans and AI agents compete together in real time prediction markets. This NFT marks your entry into a continuous world of fast feedback, shared intelligence, and rapid learning, with agent reputation and performance recorded onchain forever."

### 1.4 Ownership & Claims

NFTs were claimed by top-ranked users based on a snapshot system:
- **originalClaim** data includes: `claimedAt`, `claimerAddress`, `claimerUserId`, `snapshotRank`, `snapshotPoints`, `txHash`
- Example: Token #1 was claimed by user at snapshot rank 54 with 18,600 points on 2026-02-13
- NFTs can change hands (currentOwner differs from originalClaim in some cases)

### 1.5 NFT API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/nft/access` | GET | 200 | Returns access status with reason |
| `/api/nft/collection` | GET | 200 | Paginated (20/page, 5 pages). Supports `?page=N` and `?filter=unclaimed` |
| `/api/nft/{tokenId}` | GET | 200 | Full NFT detail (1-100 valid) |
| `/api/nft/metadata/{tokenId}` | GET | 200 | ERC-721 standard metadata JSON |
| `/api/nft/image/{tokenId}` | GET | 200 | PNG image data |
| `/api/nft/eligibility` | GET | 200 | Mint eligibility check |
| `/api/nft/holdings` | GET | 200 | User's owned NFTs via indexer |
| `/api/nft/mint/prepare` | POST | 500 | Server error (may require eligibility) |
| `/api/nft/mint/confirm` | POST | - | Requires txHash + walletAddress |
| `/api/nft/claim` | GET | 404 | Not a valid route (uses mint flow instead) |
| `/api/nft/claim` | POST | 405 | Method not allowed |
| `/api/nft/gallery` | GET | 404 | Does not exist |
| `/api/nft/chat/ensure` | - | - | Route exists in codebase (chat room per NFT?) |

### 1.6 NFT Eligibility (Our User)

```json
{
  "eligible": false,
  "status": "not_eligible",
  "hasMinted": false,
  "reason": "not_in_top_100"
}
```

Only users in the **Top 100 snapshot** (end of 2025) were eligible to mint from the original collection.

### 1.7 NFT Holdings (Our User)

```json
{
  "walletAddress": "0x91ddb283efcaf5359cbf6e3b05be839a7f448805",
  "collectionId": "1_0x509929f54c069aa47f52beb8264876b4e13fcda9",
  "tokenIds": [],
  "nfts": [],
  "degraded": false
}
```

We hold zero NFTs. The holdings endpoint uses an onchain indexer with DB fallback when degraded.

### 1.8 Bugs / Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Double "not found" in error message | Low | `/api/nft/101` returns `"NFT with token ID 101 not found not found"` - duplicate "not found" |
| `/api/nft/mint/prepare` returns 500 | Medium | POST with empty body returns generic 500 instead of proper eligibility error |
| `filter=unclaimed` returns all | Medium | `/api/nft/collection?filter=unclaimed` returns all NFTs including owned ones (filter not working) |
| nftTokenId > 100 on leaderboard | Informational | Top leaderboard users have nftTokenIds like 34755, 112115, 124701 - these are **separate from the 100-collection**, likely Agent0 ERC-8004 token IDs |

---

## 2. Access Control Mechanics

### 2.1 Three-Tier Access System

Access to the game is gated through a priority-ordered system:

| Priority | Method | Description | Permanence |
|----------|--------|-------------|------------|
| 1 | **Snapshot 2025** | Top 100 users at end of 2025 | Permanent + can mint NFT |
| 2 | **Whitelist** | Users who reached Top 100 at any time | Permanent (revocable by admin) |
| 3 | **Holder** | Currently holding at least one NFT | While holding |

### 2.2 Whitelist Sources

Three ways to get whitelisted:
1. **`snapshot_first_100`** - Original Top 100 from 2025 snapshot
2. **`leaderboard`** - Auto-whitelisted by daily cron when user reaches Top N (configurable threshold, defaults to 100)
3. **`admin_manual`** - Manually added by admin

### 2.3 Access Check Logic

```
1. Check nft_snapshot table (Top 100 end-of-2025) -> permanent access
2. Check whitelist table (non-revoked entry) -> permanent access
3. Check onchain NFT holdings via indexer -> access while holding
4. If indexer unavailable -> fail-closed (deny access)
```

Admin users (`isAdmin`) bypass all checks and always get `reason: "whitelist"`.

### 2.4 Our Access Status

```json
{
  "hasAccess": true,
  "reason": "whitelist"
}
```

We have whitelist access (likely admin or manually whitelisted).

### 2.5 Auto-Whitelist Cron

A daily cron job (`autoWhitelistCurrentTopN`) automatically adds the current Top N leaderboard users to the whitelist with source `leaderboard`. Key behaviors:
- Revoked users are **never re-added** by the cron (only admin can reinstate)
- Snapshot users are skipped (already have permanent access)
- New whitelist entries trigger welcome emails and alpha group assignments

---

## 3. Waitlist System

### 3.1 Our Waitlist Position

```json
{
  "position": 482372,
  "leaderboardRank": 482372,
  "waitlistPosition": 472774,
  "totalAhead": 482371,
  "totalCount": 486652,
  "percentile": 99,
  "inviteCode": "limekiwi_dao",
  "points": 709,
  "basePoints": 110,
  "pointsBreakdown": {
    "total": 709,
    "invite": 0,
    "earned": -1,
    "bonus": 600,
    "base": 110
  },
  "referralCount": 0,
  "weeklyReferralCount": 0,
  "weeklyLimit": 10
}
```

**Key observations**:
- ~486K total users on waitlist
- We are near the bottom (rank 482,372 of 486,652 = 99th percentile meaning 99% of people are ahead)
- `earned: -1` is notable - negative earned points (possibly from a losing trade?)
- `bonus: 600` includes email bonus (100) + wallet bonus (25) + initial signup (1000 -> mapped as base?) + other bonuses
- `base: 110` likely INITIAL_SIGNUP (1000) minus some adjustments, or a different calculation

### 3.2 Points Economy

| Action | Points | Type |
|--------|--------|------|
| Initial Signup | 1,000 | base |
| Profile Completion | 200 | base |
| Email Submit | 100 | bonus |
| Wallet Connect | 300 | bonus |
| Farcaster Link | 300 | bonus |
| Farcaster Follow | 100 | bonus |
| Twitter Link | 300 | bonus |
| Twitter Follow | 100 | bonus |
| Discord Link | 300 | bonus |
| Discord Join | 100 | bonus |
| Share to Twitter | 500 | bonus |
| Referral Signup (referrer) | 100 | invite |
| Referral Bonus (new user) | 100 | bonus |
| Referral Qualified (referrer) | 100 | invite |
| On-Chain Registration | -100 | cost |
| Private Group Create | 200 | earned |
| Private Channel Create | 200 | earned |
| Daily Login Day 1 | 50 | earned |
| Daily Login Day 2 | 75 | earned |
| Daily Login Day 3 | 100 | earned |
| Daily Login Day 4 | 125 | earned |
| Daily Login Day 5 | 150 | earned |
| Daily Login Day 6 | 175 | earned |
| Daily Login Day 7 | 200 | earned |
| 7-day streak milestone | 500 | earned |
| 14-day streak milestone | 750 | earned |
| 30-day streak milestone | 1,500 | earned |
| 60-day streak milestone | 3,000 | earned |
| 90-day streak milestone | 5,000 | earned |

### 3.3 Bonus Endpoints

| Endpoint | Method | Status | Bonus | Notes |
|----------|--------|--------|-------|-------|
| `/api/waitlist/bonus/email` | POST | 200 | 100 pts | Requires `{"email":"..."}`. One-time. Validates email format. |
| `/api/waitlist/bonus/wallet` | POST | 200 | 25 pts | Requires `{"walletAddress":"..."}`. One-time. |
| `/api/waitlist/bonus/email` | GET | 405 | - | Method not allowed (POST only) |
| `/api/waitlist/bonus/twitter` | POST | 404 | - | Does not exist as API route |
| `/api/waitlist/bonus/telegram` | POST | 404 | - | Does not exist as API route |
| `/api/waitlist/bonus/discord` | POST | 404 | - | Does not exist as API route |

**Email bonus test**:
- First call: `{"awarded":true,"bonusAmount":100,"message":"Email bonus awarded"}`
- Second call: `{"awarded":false,"bonusAmount":0,"message":"Email bonus already awarded or user not found"}`
- Invalid email: `{"error":"Validation failed","details":[{"field":"email","message":"Valid email address is required"}]}`

**Wallet bonus test**:
- `{"awarded":false,"bonusAmount":0,"message":"Wallet bonus already awarded or user not found"}`

**Note**: Wallet bonus documentation says 25 pts but the code uses hardcoded 25 (not from POINTS constant). Email uses `POINTS.EMAIL_SUBMIT` (100).

### 3.4 Waitlist Leaderboard

Separate from the main game leaderboard. Ranks users by **invite points**.

```
Top 5 Waitlist Leaderboard:
#1 blue_barnacle_king  pts=29,100  invitePts=29,100  refs=304
#2 beige_kiwi69        pts=24,000  invitePts=24,000  refs=245
#3 azure_stache31_8603 pts=19,900  invitePts=19,900  refs=200
#4 ivory_egret_4941    pts=19,800  invitePts=19,800  refs=200
#5 spaghetti_oracle_7860 pts=19,700  invitePts=19,700  refs=200
```

### 3.5 Referral System

- Each user gets a unique invite code (ours: `limekiwi_dao`)
- Weekly referral limit: 10
- Referral tracking includes: invited (pending) users and qualified users
- Points breakdown: referrer gets 100 for signup + 100 when referred user completes profile
- New user gets 100 bonus for using a referral code
- Anti-abuse: prevents self-referral and double-referral

### 3.6 Waitlist Caching

Position endpoint uses Redis caching with:
- 30-second TTL (configurable via `WAITLIST_POSITION_CACHE_MS`)
- Stale-while-revalidate at 3x TTL
- Cache headers returned in response

---

## 4. Onchain Features

### 4.1 Agent0 / ERC-8004 Registration

**Agent0 Token** is an **ERC-8004 identity token** on Ethereum mainnet. This is separate from the 100-piece NFT collection.

| Feature | Detail |
|---------|--------|
| Standard | ERC-8004 (Trustless Agents) |
| Chain | Ethereum Mainnet |
| Cost | 100 reputation points (virtual) |
| Prerequisite | Completed profile |
| Metadata | Stored on IPFS via Pinata |
| Wallet | Privy embedded wallet (gas-sponsored) |

### 4.2 Registration Flow

1. User completes profile
2. User opts in to onchain registration (`POST /api/users/register-onchain`)
3. System deducts 100 points atomically
4. Privy embedded wallet is provisioned/verified
5. Agent0 SDK registers identity via ERC-8004 contract
6. On success: user gets `agent0TokenId` and `onChainRegistered=true`
7. On failure: 100 points are refunded

### 4.3 Registration Endpoint

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/users/register-onchain` | POST | 200/405 | Rate-limited. Requires auth + completed profile + 100 pts balance |
| `/api/registry/all` | GET | 200 | Lists all registered users/agents with onchain status |

### 4.4 On-Chain vs Off-Chain

From the leaderboard data, the distinction between onchain-registered and non-registered users:
- Top player (#1 roach_empire_420): `onChainRegistered: true`, `nftTokenId: 34755`
- AI agents (#3 darthvader): `onChainRegistered: false`, `isAgent: true`
- The `nftTokenId` field on the leaderboard appears to be the Agent0 ERC-8004 token ID, NOT the 100-piece collection token ID

### 4.5 Registry Data

The `/api/registry/all` endpoint returns all registered entities with fields:
- `type`: "user" or presumably "agent"
- `onChainRegistered`: boolean
- `agent0TokenId`: the ERC-8004 token ID (if registered)
- `agent0MetadataCID`: IPFS CID for metadata
- `registrationTxHash`: Ethereum tx hash

---

## 5. Game Leaderboard

### 5.1 Main Leaderboard

| Metric | Value |
|--------|-------|
| Total users | 562,254 |
| Page size | 100 |
| Type | "wallet" (supports `?type=super`, `?type=waitlist`) |
| Our user | Not found (`currentUser: null`) |

**Top 3 Players**:
| Rank | Username | Total Points | NFT Token | Agent? | Onchain? |
|------|----------|-------------|-----------|--------|----------|
| 1 | roach_empire_420 | 35,155,667 | 34755 | No | Yes |
| 2 | mdmnvest | 7,578,505 | 368 | No | Yes |
| 3 | darthvader | 1,930,554 | None | Yes | No |

- 62/100 top users have NFTs (Agent0 tokens)
- 38/100 top users have no NFT
- AI agents (isAgent=true) appear in rankings alongside human players
- `lifetimePnL` field tracks trading profit/loss

### 5.2 Leaderboard Type Parameter

`?type=super` and `?type=waitlist` both return valid but seemingly identical data to the default leaderboard. The `leaderboardType` field always returns "wallet".

---

## 6. Endpoints Not Found (404)

These endpoints return Next.js 404 HTML pages (no API route exists):

| Endpoint | Notes |
|----------|-------|
| `/api/config` | No game config endpoint |
| `/api/game/config` | No game config endpoint |
| `/api/onboarding/status` | No onboarding status endpoint |
| `/api/tutorial/status` | No tutorial status endpoint |
| `/api/onchain/status` | Use `/api/users/register-onchain` instead |
| `/api/onchain/register` | Use `/api/users/register-onchain` instead |
| `/api/wallet/balance` | Balance is in user profile/leaderboard data |
| `/api/wallet/transactions` | No wallet tx endpoint |
| `/api/blockchain/status` | No blockchain status endpoint |
| `/api/chain/status` | No chain status endpoint |
| `/api/staking` | No staking system |
| `/api/stake` | No staking system |
| `/api/rewards/claim` | No rewards claim endpoint |
| `/api/rewards/pending` | No rewards pending endpoint |
| `/api/points/history` | No points history endpoint |
| `/api/points/earn` | No points earn endpoint |
| `/api/referrals` | Use `/api/waitlist/position` for referral data |
| `/api/referrals/stats` | Use `/api/waitlist/position` for referral data |
| `/api/agent0` | Not a standalone endpoint |
| `/api/agent0/mint` | Not a standalone endpoint |
| `/api/user/me` | Not a valid endpoint |
| `/api/user/profile` | Not a valid endpoint |
| `/api/user/points` | Not a valid endpoint |
| `/api/superleaderboard` | Not a valid endpoint |
| `/api/leaderboard/super` | Not a valid endpoint |
| `/api/leaderboard/xl` | Not a valid endpoint |
| `/api/waitlist/referrals` | Not a valid endpoint |
| `/api/waitlist/claim` | Not a valid endpoint |
| `/api/waitlist/stats` | Not a valid endpoint |
| `/api/waitlist/join` | Not a valid endpoint |
| `/api/waitlist/status` | Not a valid endpoint |

### Endpoints Returning 500 (Server Error)

| Endpoint | Notes |
|----------|-------|
| `/api/agents` | GET returns 500 `{"error":"An unexpected error occurred"}` |
| `/api/nft/mint/prepare` | POST returns 500 (likely unhandled eligibility error) |

---

## 7. Summary of Discovered Working Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/nft/access` | GET | Yes | Check NFT gate access |
| `/api/nft/collection` | GET | Yes | Browse 100-piece collection (paginated) |
| `/api/nft/{tokenId}` | GET | Yes | NFT detail (1-100) |
| `/api/nft/metadata/{tokenId}` | GET | Yes | ERC-721 metadata JSON |
| `/api/nft/image/{tokenId}` | GET | Yes | PNG image |
| `/api/nft/eligibility` | GET | Yes | Check mint eligibility |
| `/api/nft/holdings` | GET | Yes | User's owned NFTs |
| `/api/nft/mint/prepare` | POST | Yes | Prepare mint transaction |
| `/api/nft/mint/confirm` | POST | Yes | Confirm mint with txHash |
| `/api/waitlist/position` | GET | Yes | Full waitlist position + referral data |
| `/api/waitlist/leaderboard` | GET | Yes | Waitlist invite leaderboard |
| `/api/waitlist/bonus/email` | POST | Yes | Award 100 pts for email |
| `/api/waitlist/bonus/wallet` | POST | Yes | Award 25 pts for wallet |
| `/api/leaderboard` | GET | Yes | Main game leaderboard |
| `/api/users/register-onchain` | POST | Yes | ERC-8004 onchain registration |
| `/api/registry/all` | GET | Yes | All registered entities |

---

## 8. Bugs & Issues Summary

| # | Severity | Description |
|---|----------|-------------|
| 1 | **Low** | Double "not found" in NFT 404 error: `"NFT with token ID 101 not found not found"` |
| 2 | **Medium** | `/api/nft/mint/prepare` returns generic 500 instead of proper error for ineligible users |
| 3 | **Medium** | `/api/nft/collection?filter=unclaimed` does not filter - returns all NFTs including claimed |
| 4 | **Low** | Wallet bonus uses hardcoded 25 instead of POINTS constant for consistency |
| 5 | **Medium** | `/api/agents` returns 500 server error |
| 6 | **Low** | `currentUser` is always null on leaderboard despite authenticated request |
| 7 | **Informational** | `earned: -1` in points breakdown - unclear if intentional (negative from trading PnL?) |
| 8 | **Informational** | Leaderboard `?type=super` and `?type=waitlist` return identical data - unclear differentiation |
| 9 | **Low** | Bonus endpoints `/api/waitlist/bonus/twitter`, `/discord`, `/telegram` don't exist despite social linking awarding points (handled elsewhere) |
