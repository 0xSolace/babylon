# 10 Agent Prompts for Babylon Game QA

**Token (expires ~1hr from 13:52 UTC):**
```
eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw
```

**Base URL:** `https://play.babylon.market`
**User:** ben.b@elizalabs.ai / bluesquid678 / balance: 1,874.07 pts
**Output dir:** `/home/deploy/working-dir/elizaOS/babylon/qa-reports/`

---

## Agent 1: Auth & User Profile

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL auth and user profile endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market

TEST THESE ENDPOINTS (use curl via Bash tool):
1. GET /api/health - check env, uptime
2. GET /api/users/me - full user profile, verify all fields
3. PATCH /api/users/me - try updating bio, displayName (then revert)
4. GET /api/users/search?q=bluesquid - search for own user
5. GET /api/users/search?q=roach - search other users
6. POST /api/activity/heartbeat - session tracking
7. GET /api/twitter/auth-status - twitter linking status
8. GET /api/stats - game stats (day, running, totals)
9. GET /api/notifications - user notifications
10. GET /api/notifications?unread=true - unread only
11. Try GET /api/users/me without auth header (should 401)
12. Try GET /api/users/me with garbage token (should 401)
13. GET /api/waitlist/position - waitlist info
14. GET /api/nft/access - NFT access check
15. GET /api/game/guide - game guide endpoint

For each: record HTTP status, response time, response shape, any errors.
Test edge cases: missing params, wrong types, empty strings.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/01-auth-profile.md
Format: markdown table with endpoint, status, latency, notes. Include raw response snippets for interesting findings.
```

---

## Agent 2: Feed & Posts (Read)

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL feed and post READ endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market

TEST THESE ENDPOINTS:
1. GET /api/posts?limit=5 - list posts, check pagination
2. GET /api/posts?limit=5&offset=5 - page 2
3. GET /api/posts?limit=100 - large page
4. GET /api/posts?limit=0 - edge case
5. GET /api/posts?limit=-1 - edge case
6. GET /api/posts/feed - aggregated feed
7. GET /api/feed/hot - hot/trending feed
8. GET /api/feed/widgets - widget data
9. GET /api/posts/287581091047407616 - single post by ID (known valid)
10. GET /api/posts/287580128014237696 - another post
11. GET /api/posts/999999999999999999 - nonexistent post
12. GET /api/posts/abc - invalid ID format
13. GET /api/posts/{id}/replies - replies to a post (try both valid post IDs above)
14. GET /api/posts/{id}/reactions - reactions on a post
15. GET /api/trending - trending content
16. GET /api/questions - questions endpoint

For each post, document the response shape: id, text, author, reactions, reposts, timestamps.
Identify what content the AI NPCs are generating. Note any content quality issues.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/02-feed-posts-read.md
```

---

## Agent 3: Posts (Write) & Social Interactions

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL post WRITE and social interaction endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market
KNOWN POST IDS: 287581091047407616, 287580128014237696

TEST THESE ENDPOINTS:
1. POST /api/posts - create a new post (body: {"content": "QA test post from bluesquid678"})
2. POST /api/posts - try empty content
3. POST /api/posts - try very long content (1000+ chars)
4. POST /api/posts/{id} - like a post (try POST, PUT, PATCH with various bodies like {"action":"like"})
5. POST /api/posts/{id}/like - try this path
6. PUT /api/posts/{id}/like - try this path
7. POST /api/posts/{id}/reaction - try with {"type":"like"}, {"type":"heart"}, etc
8. POST /api/posts/{id}/reply - reply to post (body: {"content": "QA test reply"})
9. POST /api/posts/{id}/reply - try {"text": "QA test reply"} (different field name)
10. POST /api/posts/{id}/reply - try {"body": "QA test reply"}
11. POST /api/posts/{id}/repost - repost
12. DELETE /api/posts/{id} - try deleting own post (if created in step 1)
13. GET /api/profiles/favorites - favorites list
14. GET /api/profiles/favorites?page=1&limit=10 - with params
15. POST /api/profiles/favorites - try adding a favorite

Document the exact request/response for each. Find the correct field names and methods for liking, replying, reposting.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/03-posts-write-social.md
```

---

## Agent 4: Prediction Markets

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL prediction market endpoints. You have 1,874 pts balance - USE SMALL AMOUNTS (5-10 pts max per trade).

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market

TEST THESE ENDPOINTS:
1. GET /api/markets/predictions - list all, note total count, pagination
2. GET /api/markets/predictions?status=active - active only
3. GET /api/markets/predictions?status=resolved - resolved only
4. GET /api/markets/predictions?limit=1 - pagination test
5. GET /api/markets/predictions/{id} - pick an active market, get details
6. POST /api/markets/predictions/{id}/buy - buy YES position: {"outcome":"yes","amount":5}
7. POST /api/markets/predictions/{id}/buy - buy NO position: {"outcome":"no","amount":5}
8. POST /api/markets/predictions/{id}/sell - sell some shares: {"outcome":"yes","shares":2}
9. GET /api/markets/predictions/{id}/trades - trade history for market
10. GET /api/trades - user's trade history
11. POST /api/markets/predictions/{id}/buy - try amount:0 (edge case)
12. POST /api/markets/predictions/{id}/buy - try amount:-1 (edge case)
13. POST /api/markets/predictions/{id}/buy - try amount:999999 (more than balance)
14. POST /api/markets/predictions/{id}/buy - try on a resolved market
15. GET /api/markets/predictions/{id}/comments - market comments

Document: market structure, probabilities, share math, trade confirmations, error handling.
Note the market content quality - all markets seem to use same template.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/04-prediction-markets.md
```

---

## Agent 5: Perpetual Trading

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL perpetual trading endpoints. You have 1,874 pts - USE SMALL AMOUNTS (min order 10, use 10-20 size).

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market
KNOWN TICKERS: TSLAI, OPENAGI, CRFT, CIA, DOW (max leverage 100, min order 10)

TEST THESE ENDPOINTS:
1. GET /api/markets/perps - list all perp markets
2. GET /api/markets/perps/{ticker} - individual market (try each ticker)
3. GET /api/markets/perps/{ticker}/history?range=1D - price history
4. GET /api/markets/perps/{ticker}/history?range=1W - weekly
5. GET /api/markets/perps/{ticker}/history?range=1M - monthly
6. GET /api/markets/perps/{ticker}/orderbook - if exists
7. POST /api/markets/perps/{ticker}/open - long: {"side":"long","size":10,"leverage":2}
8. POST /api/markets/perps/{ticker}/open - short: {"side":"short","size":10,"leverage":2}
9. GET /api/markets/perps/positions - user's open positions
10. POST /api/markets/perps/{ticker}/close - close a position
11. POST /api/markets/perps/{ticker}/open - try leverage:101 (exceeds max)
12. POST /api/markets/perps/{ticker}/open - try size:0
13. POST /api/markets/perps/{ticker}/open - try size:999999
14. POST /api/markets/perps/FAKE/open - nonexistent ticker
15. GET /api/markets/perps/{ticker}/funding - funding rate details

Close any positions you open! Document: entry price, margin, PnL calculation, leverage limits, error handling.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/05-perp-trading.md
```

---

## Agent 6: Agents, Actors & NPCs

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL agent, actor, and NPC endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market
KNOWN ACTORS: aellai (aellAI_girl), aidam-aron (ceoadAIm), ailex-jones (realAIlexjones)

TEST THESE ENDPOINTS:
1. GET /api/agents - list agents (KNOWN BUG: was returning 500 previously)
2. GET /api/agents?limit=5 - with pagination
3. GET /api/agents/search?q=ai - search agents
4. GET /api/agents/search?q=trading - search by function
5. GET /api/agent-templates - agent creation templates
6. GET /api/actors - list all actors/NPCs
7. GET /api/actors?limit=5 - with pagination
8. GET /api/actors/{id} - get specific actor (try: aellai, aidam-aron)
9. GET /api/actors/{id}/posts - actor's posts
10. GET /api/actors/{id}/positions - actor's trading positions
11. GET /api/actors/{id}/stats - actor statistics
12. GET /api/groups - list groups
13. GET /api/groups/{id} - group details
14. POST /api/agents - try creating an agent (explore what fields needed)
15. GET /api/actors?type=npc - filter by type
16. GET /api/actors?type=agent - filter by type

Document: total actor/agent count, their roles, activity levels, the relationship between agents vs actors.
Note if the /api/agents 500 bug is fixed.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/06-agents-actors.md
```

---

## Agent 7: Chat & Messaging

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL chat and messaging endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market
KNOWN ACTORS: aellai, aidam-aron, ailex-jones (these are NPCs)

TEST THESE ENDPOINTS:
1. GET /api/chats - list user's chats
2. GET /api/chats?limit=10 - with pagination
3. GET /api/chats/unread-count - unread messages
4. POST /api/chats/dm - try DM to NPC: {"recipientId":"aellai"} (should fail: "Cannot DM NPC actors")
5. POST /api/chats/dm - try DM with various body shapes: {"to":"aellai"}, {"userId":"aellai"}, {"recipient":"aellai","message":"hello"}
6. Find a real user to DM - GET /api/users/search?q=roach to find a real user, then try DMing them
7. POST /api/chats/{chatId}/messages - send message in existing chat (if any from step 6)
8. GET /api/chats/{chatId}/messages - read messages in a chat
9. POST /api/chats/group - try creating group chat
10. DELETE /api/chats/{id} - try deleting a chat
11. PUT /api/chats/{id}/read - mark as read
12. GET /api/chats/{id}/participants - chat participants
13. Try WebSocket/SSE endpoints for real-time chat if discoverable
14. POST /api/chats/dm with empty body
15. POST /api/chats/dm with no auth (should 401)

Document: chat data model, DM vs group chats, message format, real-time capabilities.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/07-chat-messaging.md
```

---

## Agent 8: Leaderboard & Rankings

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL leaderboard and ranking endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market

TEST THESE ENDPOINTS:
1. GET /api/leaderboard - default leaderboard
2. GET /api/leaderboard?type=pnl - PnL leaderboard
3. GET /api/leaderboard?type=points - points leaderboard
4. GET /api/leaderboard?type=reputation - reputation leaderboard
5. GET /api/leaderboard?type=volume - trading volume
6. GET /api/leaderboard?type=invalid - invalid type
7. GET /api/leaderboard?limit=5 - pagination
8. GET /api/leaderboard?limit=5&offset=10 - page 2
9. GET /api/leaderboard?limit=1000 - large page
10. GET /api/leaderboard?period=daily - daily rankings
11. GET /api/leaderboard?period=weekly - weekly
12. GET /api/leaderboard?period=monthly - monthly
13. GET /api/leaderboard?period=alltime - all time
14. Find current user's rank/position on each leaderboard type
15. GET /api/leaderboard/me - user's own ranking (if exists)
16. Analyze top 10 players: what scores, are they real users or bots?

Document: total users, ranking algorithm, leaderboard types available, data freshness.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/08-leaderboard.md
```

---

## Agent 9: NFT, Rewards & Waitlist

```
You are a QA tester for Babylon game (play.babylon.market). Test ALL NFT, rewards, waitlist, and miscellaneous endpoints.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market

TEST THESE ENDPOINTS:
1. GET /api/nft/access - NFT access status
2. GET /api/nft/gallery - NFT gallery
3. GET /api/nft/collection - NFT collection
4. GET /api/nft/mint - mint status/info
5. POST /api/nft/mint - try minting (explore what's needed)
6. GET /api/waitlist/position - waitlist position
7. GET /api/waitlist/status - waitlist status
8. GET /api/waitlist/referrals - referral info
9. POST /api/waitlist/join - try joining (already joined)
10. GET /api/rewards - rewards info
11. GET /api/rewards/history - reward history
12. GET /api/rewards/claim - claimable rewards
13. POST /api/rewards/claim - try claiming
14. GET /api/referrals - referral program
15. GET /api/referrals/stats - referral stats
16. GET /api/quests - quests/missions
17. GET /api/achievements - achievements
18. GET /api/daily-rewards - daily login rewards

Explore aggressively - try every path you can think of. Many may 404 and that's useful info.

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/09-nft-rewards.md
```

---

## Agent 10: API Discovery & Architecture Analysis

```
You are a QA tester and architecture analyst for Babylon game (play.babylon.market). Your job is ENDPOINT DISCOVERY and ARCHITECTURE ANALYSIS.

AUTH HEADER for all requests:
Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlDc2lNMlNxX19GS1RubDBfTDlkM1hJZ1Jxbm00aGkyWlpmcThCS09kV3MifQ.eyJzaWQiOiJjbWw4bDRrbmEwMTN2bGQwY21vcG11N3JxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzI2Mjk5MzYsImF1ZCI6ImNtaGpyNjJkOTAwMDVreTBjbmF1eTR6Z20iLCJzdWIiOiJkaWQ6cHJpdnk6Y21sOGw0a3A4MDEzeGxkMGNtNGptY2FhOCIsImV4cCI6MTc3MjYzMzUzNn0.Mf-i80Oets0NPJ_bNbU6NS60P0ZjwDGaiSjNRiwJtkIr0itjLVTVQMSKnn6z6xO30Bzzwvz-J5vneni9Fr3FRw

BASE URL: https://play.babylon.market

PART 1: ENDPOINT DISCOVERY
Try these undiscovered paths to map the full API surface:
- GET /api/organizations, /api/organizations/{id}
- GET /api/search, /api/search?q=test
- GET /api/analytics, /api/analytics/dashboard
- GET /api/settings, /api/settings/game
- GET /api/economy, /api/economy/stats
- GET /api/events, /api/events/live
- GET /api/portfolio, /api/portfolio/summary
- GET /api/portfolio/history
- GET /api/transactions, /api/transactions/history
- GET /api/market-makers, /api/market-makers/stats
- GET /api/feed/following, /api/feed/latest, /api/feed/personalized
- GET /api/explore, /api/discover
- GET /api/onboarding, /api/onboarding/status
- GET /api/config, /api/config/game
- GET /api/version, /api/status
- GET /api/docs, /api/swagger, /api/openapi
- GET /api/admin (should 403 for non-admin... but user IS admin)
- Try OPTIONS on major endpoints to check CORS

PART 2: ARCHITECTURE ANALYSIS
Also read the codebase to understand the server architecture:
- Read files in /home/deploy/working-dir/elizaOS/babylon/apps/web/app/api/ to find all API routes
- Check /home/deploy/working-dir/elizaOS/babylon/packages/ for shared logic
- Map the database schema if visible in packages/db/
- Identify: auth middleware, rate limiting, caching, error handling patterns

PART 3: REPORT
Write a comprehensive architecture report covering:
- Full API route map (discovered + from source code)
- Auth system design (Privy JWT flow)
- Data model (users, actors, posts, markets, trades)
- Game engine (how markets resolve, how NPCs post, game day progression)
- Tech stack (Next.js, database, caching, etc.)

WRITE YOUR FULL REPORT to: /home/deploy/working-dir/elizaOS/babylon/qa-reports/10-architecture.md
```

---

## Master Report Compilation (run last, after all 10 complete)

```
You are the master QA coordinator. Read all 10 agent reports and compile a final master report.

Read these files:
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/01-auth-profile.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/02-feed-posts-read.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/03-posts-write-social.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/04-prediction-markets.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/05-perp-trading.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/06-agents-actors.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/07-chat-messaging.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/08-leaderboard.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/09-nft-rewards.md
- /home/deploy/working-dir/elizaOS/babylon/qa-reports/10-architecture.md

Compile into: /home/deploy/working-dir/elizaOS/babylon/qa-reports/MASTER-REPORT.md

Include:
1. Executive Summary (pass/fail counts, critical bugs)
2. Bug List (Critical / Medium / Low) with reproduction steps
3. Full endpoint map with status codes
4. Architecture overview
5. Game state snapshot
6. Content quality assessment
7. Recommendations for improvement
```
