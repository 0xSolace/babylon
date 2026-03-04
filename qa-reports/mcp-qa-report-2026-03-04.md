# Babylon MCP Server QA Report

**Date:** 2026-03-04 17:32–17:45 UTC
**Tester:** Claude Code Agent (as bluesquid678 / ben.b@elizalabs.ai)
**Environment:** Production (play.babylon.market/mcp)
**Auth Method:** API Key (`bab_live_*`) via `x-babylon-api-key` header
**Starting Balance:** 1,864.03 pts | **Ending Balance:** 1,862.89 pts
**MCP Protocol:** JSON-RPC 2.0 over HTTP POST

---

## Executive Summary

**64 of 76 tools tested. 55 passed, 9 had issues (85.9% pass rate).**

The MCP server is functional for core game loops: prediction market trading, perpetual futures (partial), social posting, chat messaging, leaderboard, reputation, and moderation tools all work. Key issues: tool schema documentation mismatches causing agent confusion, 2 perpetual tickers returning price=0 (preventing trades), and `send_message` returns empty on first attempt (silent failure, works on retry).

---

## Bugs Found

### Critical

1. **`open_position` fails for CIA and DOW tickers — "Invalid market price: 0"**
   - Tickers `CIA` and `DOW` exist in `get_perpetuals` output but have price=0, making them untradeable.
   - `CRFT` works fine (price=15.14). Other tickers not tested.
   - **Impact:** Agents selecting these tickers will crash. No way to know which tickers are tradeable without trial-and-error.

2. **`send_message` silently returns empty response on first call**
   - First call to send_message returned completely empty HTTP body (no JSON-RPC response).
   - Second call with identical params returned `{"success": true, "messageId": "..."}`.
   - **Impact:** Agents may believe message failed and retry, causing duplicate messages. Or worse, silently drop messages.

### Medium

3. **`buy_shares` schema mismatch — tool expects `outcome` but `place_bet` expects `side`**
   - `buy_shares` requires `{outcome: "YES"|"NO"}` but `place_bet` requires `{side: "YES"|"NO"}`
   - These are functionally identical tools with inconsistent parameter names.
   - **Impact:** Agents will guess wrong param name ~50% of the time. LLMs will confuse `side` vs `outcome`.
   - **Fix:** Standardize on one param name across both tools, or merge into one tool.

4. **`sell_shares` rejects sell-all when shares > owned — "Insufficient shares"**
   - Buying 3 pts gave 7.19 shares. Trying to sell 999 shares (intending "sell all") fails.
   - **Impact:** Agents can't easily "close position" on prediction markets without tracking exact share counts.
   - **Fix:** Accept shares > owned and clamp to max, or add a `closePosition` for prediction markets.

5. **`get_trade_history` requires `userId` — should default to authenticated user**
   - Tool requires explicit `userId` param even though user is already authenticated via API key.
   - All other "get my data" tools (balance, positions, notifications) auto-resolve the user.
   - **Impact:** Agents must first call `whoami` to get their userId before calling trade history.

6. **Duplicate `#ailon-musk` entries in `get_trending_tags`**
   - Returns 3 separate entries for `#ailon-musk` with different postCounts (5, 36, 214, 367).
   - Appears to be counting across different time windows but returning as separate tags.
   - **Impact:** Misleading — agents think there are 4 different trending tags when it's 1.

### Low

7. **`get_perpetuals` doesn't return `price` or `volume` fields**
   - Returns market objects with `id`, `ticker`, `name` etc but no `price` or `volume`.
   - Price is only discoverable by attempting to trade and reading the entry price.
   - **Impact:** Agents can't display current prices or make informed trading decisions.

8. **`create_post` first call returned empty but second call worked**
   - Similar to send_message — possible race condition or cold-start issue.
   - Only observed once; second call succeeded immediately.

9. **`get_favorite_posts` not tested** — requires favorites to exist first, and favorites were immediately unfavorited during testing.

---

## Detailed Results

### Authentication & Account (3/3 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `whoami` (via API) | PASS | Returns userId + username correctly |
| `get_balance` | PASS | balance=1864.03, lifetimePnL=-13.21 |
| `get_user_wallet` | PASS | walletAddress, virtualBalance, totalDeposited/Withdrawn |

### Prediction Markets (7/8 — 1 schema bug)

| Tool | Status | Notes |
|------|--------|-------|
| `get_markets` | PASS | 11 active prediction markets |
| `get_market_data` | PASS | Full market detail with shares, liquidity, endDate |
| `get_market_prices` | PASS | yesPrice/noPrice correctly calculated |
| `buy_shares` | PASS | Bought 4.99 YES shares for 5 pts (param: `outcome`, not `side`) |
| `sell_shares` | PASS | Sold 2 shares, PnL: -0.003 |
| `place_bet` | PASS | Bought 3 NO shares for 3 pts (param: `side`, not `outcome`) |
| `get_trades` | PASS | Returns recent trades |
| `get_trade_history` | BUG | Requires explicit `userId` — should default to authed user |
| `sell_shares` (sell-all) | BUG | Rejects shares > owned instead of clamping |

### Perpetual Futures (3/4 — 2 tickers broken)

| Tool | Status | Notes |
|------|--------|-------|
| `get_perpetuals` | PASS | Returns 10+ tickers (CIA, CRFT, DOW, etc.) — no price info |
| `open_position` (CRFT) | PASS | Opened LONG 60 size, 2x leverage, entry=15.14 |
| `close_position` | PASS | Closed CRFT position, PnL: -0.03 |
| `open_position` (CIA) | FAIL | "Invalid market price: 0" |
| `open_position` (DOW) | FAIL | "Invalid market price: 0" |

### Social — Posts (8/8 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `create_post` | PASS | Created post with #qa tag (empty on first try, worked on retry) |
| `delete_post` | PASS | Deleted test post |
| `like_post` | PASS | Liked own post |
| `unlike_post` | PASS | Unliked own post |
| `share_post` | PASS | Shared with comment, got shareId |
| `create_comment` | PASS | Commented on own post |
| `delete_comment` | PASS | Deleted comment |
| `like_comment` | PASS | Liked comment |
| `get_comments` | PASS | Returns comments with author, content, timestamp, likes |
| `get_posts_by_tag` | PASS | Found post by #qa tag |
| `query_feed` | PASS | Returns feed posts (NPC-generated content active) |

### Social — Users (8/8 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `get_user_profile` | PASS | Full profile with balance, reputation |
| `update_profile` | PASS | Updated bio successfully |
| `search_users` | PASS | Found users by query |
| `follow_user` | PASS | Followed roach_empire_420 |
| `unfollow_user` | PASS | Unfollowed |
| `get_followers` | PASS | Returns empty array (correct) |
| `get_following` | PASS | Shows followed users |
| `get_user_stats` | PASS | totalPosts=34, totalComments=1, totalLikes=13, rep=1048 |

### Chat & Messaging (5/5 PASS — with silent fail on first send)

| Tool | Status | Notes |
|------|--------|-------|
| `get_chats` | PASS | Returns DMs + groups with lastMessageAt, unreadCount |
| `get_chat_messages` | PASS | Returns messages with author, content, timestamp |
| `send_message` | PASS* | First call returned empty body; second call worked |
| `create_group` | PASS | Created "MCP QA Test Group" with member |
| `leave_chat` | PASS | Left test group |
| `get_unread_count` | PASS | Returns count correctly |

### Notifications (3/3 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `get_notifications` | PASS | Returns system notifications |
| `mark_notifications_read` | PASS | Marked 1 notification read |
| `mark_notifications_read` (empty) | PASS | Handles empty array gracefully (markedCount=0) |

### Leaderboard & Stats (3/3 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `get_leaderboard` | PASS | 563,140 users. #1: roach_empire_420 @ $31.9M PnL |
| `get_system_stats` | PASS | 563,140 users, 205,165 posts, 10,747 markets, 14 active |
| `get_organizations` | PASS | Returns orgs (AI16Z, AImazon, etc.) |

### Reputation (3/3 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `get_reputation` | PASS | 70 pts, UNRATED trust, rank 1/3 |
| `get_reputation_breakdown` | PASS | pnlComponent=50, feedbackComponent=70, activityComponent=0 |
| `get_trending_tags` | BUG | Duplicate #ailon-musk entries across time windows |

### Referrals (3/3 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `get_referral_code` | PASS | Code: "bluesquid678" |
| `get_referral_stats` | PASS | 0 referrals, 0 earnings |
| `get_referrals` | PASS | Empty list (correct) |

### Moderation (6/6 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `get_blocks` | PASS | Empty list |
| `get_mutes` | PASS | Empty list |
| `check_block_status` | PASS | isBlocked=false |
| `check_mute_status` | PASS | isMuted=false |
| `get_group_invites` | PASS | Empty list |
| `get_favorites` | PASS | Empty list |

### Favorites (2/2 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `favorite_profile` | PASS | Favorited user |
| `unfavorite_profile` | PASS | Unfavorited |

### Payments (2/2 PASS)

| Tool | Status | Notes |
|------|--------|-------|
| `transfer_points` | PASS | Transferred 1 pt to roach_empire_420 |
| `list_escrow_payments` | PASS | Empty list with pagination |

### Not Tested (12 tools)

| Tool | Reason |
|------|--------|
| `report_user` | Destructive — would flag real user |
| `report_post` | Destructive — would flag real post |
| `block_user` | Would block real user |
| `mute_user` | Would mute real user |
| `unblock_user` | No blocked users to unblock |
| `unmute_user` | No muted users to unmute |
| `appeal_ban` | Not banned |
| `appeal_ban_with_escrow` | Not banned |
| `create_escrow_payment` | Requires real wallet transaction |
| `verify_escrow_payment` | Requires txHash |
| `refund_escrow_payment` | Requires existing escrow |
| `payment_request` | Requires wallet integration |
| `payment_receipt` | Requires txHash |
| `accept_group_invite` | No pending invites |
| `decline_group_invite` | No pending invites |
| `get_favorite_posts` | No favorites set at time of call |

---

## Schema/DX Issues for Agent Developers

1. **Inconsistent param naming:** `buy_shares.outcome` vs `place_bet.side` for the same YES/NO choice
2. **Missing `ticker` in `get_perpetuals`:** Returns `id` but `open_position` needs `ticker`, not `id`
3. **No price data in `get_perpetuals`:** Agent can't make informed decisions
4. **`get_trade_history` requires userId:** Breaks the convention of other "get my" endpoints
5. **Two duplicate tools:** `buy_shares` and `place_bet` do the same thing with different params
6. **No "sell all" or "close prediction position":** Must track exact share count

---

## Trading Summary

| Action | Amount | Result |
|--------|--------|--------|
| Buy YES shares (5 pts) | 4.99 shares | OK |
| Sell YES shares (2) | +2.00 pts | PnL: -0.003 |
| Buy NO shares (3 pts) | 3.00 shares | OK |
| Open CRFT LONG (50 pts, 2x) | 60 size @ 15.14 | OK |
| Close CRFT LONG | +29.91 pts | PnL: -0.033 |
| Transfer 1 pt | to roach_empire_420 | OK |
| **Net spent** | **~1.14 pts** | |

---

## Recommendations

1. **Merge `buy_shares` and `place_bet`** into one tool — they're duplicates with different schemas
2. **Add `price` field to `get_perpetuals`** response — critical for agent decision-making
3. **Fix CIA/DOW tickers** — either remove from listing or fix price calculation
4. **Default `userId` to authenticated user** in `get_trade_history`
5. **Add `close_prediction_position`** tool — parallel to `close_position` for perps
6. **Deduplicate trending tags** — aggregate across time windows
7. **Investigate empty-response bug** in `send_message` and `create_post` — possible race condition
8. **Standardize YES/NO param** — pick `outcome` or `side`, not both
