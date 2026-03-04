# Babylon QA Playthrough — 2 Hour Session

You are a QA tester playing the Babylon prediction markets game for 2 HOURS. You MUST keep playing until the 2 hours are up. Do NOT stop early. Check `date +%s` at start and keep going until 7200 seconds have elapsed.

## Setup

API Key: `bab_live_5614f7cb9de9745394a3879ff4b575a7897b14d110da0c97148ff45e74a11f6a`
Base URL: `https://play.babylon.market`
Auth header: `x-babylon-api-key`

All calls go through the MCP JSON-RPC endpoint:
```bash
curl -s -X POST "$BASE/mcp" \
  -H "Content-Type: application/json" \
  -H "x-babylon-api-key: $API_KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"TOOL_NAME","arguments":{...}},"id":1}'
```

GET endpoint (no auth needed for tool discovery):
```bash
curl -s "$BASE/mcp" -H "x-babylon-api-key: $API_KEY"
```

## Your 2-Hour Play Schedule

### Phase 1: Warm-up (0–15 min)
- Check balance, profile, wallet
- Browse prediction markets, check prices
- Browse perpetual markets, check which tickers have valid prices (some have price=0)
- Read the feed, check trending tags
- Check leaderboard position
- Check notifications

### Phase 2: Prediction Market Trading (15–45 min)
- Buy YES/NO positions on 5+ different markets
- Track your positions with get_positions
- Sell some positions for profit/loss
- Try edge cases: buy max amount, buy 0.01, sell more than owned
- Place bets on markets close to expiration
- Check PnL after each trade
- Try place_bet AND buy_shares (they're duplicates — test both)

### Phase 3: Perpetual Futures (45–75 min)
- Open LONG and SHORT positions on different tickers
- Try all leverage levels (1x, 2x, 3x, 5x, 10x)
- Try large positions, small positions
- Close positions and check PnL
- Try opening position on tickers with price=0 (document which ones)
- Try re-opening closed positions
- Check trade history throughout

### Phase 4: Social Features (75–95 min)
- Create 5+ posts with different content and hashtags
- Like/unlike posts from the feed
- Comment on NPC posts
- Share posts with comments
- Search for users, follow/unfollow them
- Check followers/following counts
- Update your profile (bio, displayName)
- Browse posts by trending tags

### Phase 5: Chat & Messaging (95–105 min)
- Send messages to existing chats
- Create a group chat, send messages, leave
- Check unread counts
- Read message history
- Try sending very long messages, empty messages, messages with special chars

### Phase 6: Edge Cases & Stress (105–115 min)
- Transfer points to another user
- Try transferring 0 points, negative points, more than balance
- Rapid-fire: buy and sell same market 10 times in sequence
- Try all error paths: invalid marketId, invalid userId, missing required params
- Check if rate limiting exists
- Try creating duplicate posts
- Favorite/unfavorite profiles rapidly

### Phase 7: Final Report (115–120 min)
- Get final balance and PnL
- Get final positions summary
- Compile all bugs, edge cases, unexpected behaviors
- Write the report

## Reporting Format

Write the report to: `qa-reports/mcp-playthrough-YYYY-MM-DD.md`

Use this structure:
```markdown
# Babylon MCP 2-Hour Playthrough Report

**Date:** [date]
**Duration:** [actual duration]
**Tester:** Claude Code Agent (bluesquid678)
**Starting Balance:** X pts | **Ending Balance:** Y pts
**Total Trades:** N

## Executive Summary
[2-3 sentences: what percentage worked, major findings]

## Critical Bugs
[Bugs that block core functionality]

## Medium Bugs
[Bugs that degrade experience but have workarounds]

## Low Bugs / UX Issues
[Minor issues, inconsistencies, confusing behavior]

## Edge Case Findings
[What happens at boundaries — 0 amounts, huge amounts, special chars, etc.]

## Tool-by-Tool Results
[Table of every tool tested with PASS/FAIL/PARTIAL and notes]

## Trading Log
[Chronological log of every trade with amounts and results]

## Recommendations
[Prioritized list of fixes]
```

## CRITICAL RULES

1. **DO NOT STOP BEFORE 2 HOURS.** Check elapsed time regularly. If you run out of things to test, repeat tests with different parameters, try new edge cases, or explore tools you haven't tried.
2. **Log EVERYTHING.** Every API call result, every error, every unexpected behavior.
3. **Be adversarial.** Try to break things. Send bad inputs. Test boundaries. Race conditions.
4. **Check your balance frequently.** Track every point spent/earned.
5. **Use `date +%s` to track time.** Print elapsed time every 15 minutes.
6. **If the API key expires, document it and stop.** API keys don't expire, but JWTs do.
7. **Commit the report to git** on branch `save/qa-scripts` when done.

## Available Tools (76 total)

### Trading
get_markets, place_bet, buy_shares, sell_shares, get_balance, get_positions, close_position, get_market_data, get_market_prices, open_position, get_perpetuals, get_trades, get_trade_history

### Social
create_post, delete_post, like_post, unlike_post, share_post, get_comments, create_comment, delete_comment, like_comment, get_posts_by_tag, query_feed

### Users
get_user_profile, update_profile, follow_user, unfollow_user, get_followers, get_following, search_users, get_user_wallet, get_user_stats

### Chat
get_chats, get_chat_messages, send_message, create_group, leave_chat, get_unread_count

### Notifications
get_notifications, mark_notifications_read

### System
get_leaderboard, get_system_stats, get_referral_code, get_referrals, get_referral_stats, get_reputation, get_reputation_breakdown, get_trending_tags, get_organizations

### Payments
payment_request, payment_receipt, transfer_points, create_escrow_payment, verify_escrow_payment, refund_escrow_payment, list_escrow_payments

### Moderation
block_user, unblock_user, mute_user, unmute_user, report_user, report_post, get_blocks, get_mutes, check_block_status, check_mute_status, appeal_ban, appeal_ban_with_escrow

### Favorites
favorite_profile, unfavorite_profile, get_favorites, get_favorite_posts, get_group_invites, accept_group_invite, decline_group_invite

## START NOW. Record start time with `date +%s` and begin Phase 1.
