# Achievements & Challenges System - V1 Implementation Plan

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Design](#3-architecture-design)
4. [Database Schema](#4-database-schema)
5. [Achievement Definitions](#5-achievement-definitions)
6. [Challenge Definitions](#6-challenge-definitions)
7. [Backend Services](#7-backend-services)
8. [API Endpoints](#8-api-endpoints)
9. [Frontend Components](#9-frontend-components)
10. [Integration Points](#10-integration-points)
11. [Implementation Phases](#11-implementation-phases)
12. [Testing Strategy](#12-testing-strategy)

---

## 1. Executive Summary

Build a V1 achievements (permanent milestones) and challenges (time-bound rotating tasks) system that incentivizes early users to play and try Terminal, Agents, group chats, and trading — without reinforcing Reward Farming. PostHog data shows Reward Farmers claim daily rewards without playing; this system must require real actions.

**Key constraints:**
- 15 achievements across Bronze/Silver/Gold tiers (target: 60-80% Bronze, 20-40% Silver, 5-15% Gold completion)
- 20 daily + 20 weekly challenge pools
- 3 daily + 2 weekly shown per rotation (global, deterministic from date)
- +40 bonus for completing all 3 daily, +100 bonus for completing both weekly
- Points awarded on completion; toast notification on unlock
- Challenges visible in Rewards tab
- All actions must be play actions (Terminal, Agents, trades, chats) — not login-only

**Target cohorts:**
- **Reward Farmers** → convert to Players (main goal)
- **Explorers** → convert to Players via discovery achievements
- **Players** → retain via challenge variety
- **Traders** → retain + monetize via depth achievements

---

## 2. Current State Analysis

### What Exists Today

| System | Status | Key Files |
|--------|--------|-----------|
| **Points system** | Mature | `packages/shared/src/constants/points.ts`, `packages/api/src/services/points-service.ts` |
| **Daily login streaks** (BAB-88) | Implemented | `packages/api/src/services/daily-login-service.ts`, `apps/web/src/components/daily-login/` |
| **Rewards page** | Implemented | `apps/web/src/app/rewards/page.tsx` (1005 lines) |
| **Reward tasks** | 3 static tasks | `apps/web/src/app/rewards/reward-tasks.ts` (profile, wallet, on-chain) |
| **Badge components** | 5 badge types | `RankBadge`, `ReputationBadge`, `TrustLevelBadge`, `StreakBadge`, `OnChainBadge` |
| **Toast system** | Sonner | `toast.success()`, `toast.error()` throughout app |
| **Notification service** | 14 types | `packages/api/src/services/notification-service.ts` |
| **Activity logging** | Per-type per-day | `UserActivityLog` table (userId, activityType, activityDate) |
| **Session tracking** | Heartbeat-based | `UserSession` table, `TradeAttempt` table |
| **SSE broadcasting** | Redis streams | `packages/api/src/sse/event-broadcaster.ts` |

### What Doesn't Exist
- Achievement/badge infrastructure (no tables, no service)
- Challenge/quest system
- Achievement display on profile
- Progress tracking toward milestones
- Time-bound rotating tasks
- Achievement unlock modal/celebration

### Key Database Tables We'll Query For Progress
| Data Need | Table | Key Columns |
|-----------|-------|-------------|
| Trade count | `Position` | userId, status, createdAt |
| Perp trades | `PerpPosition` | userId, openedAt |
| Trade wins | `Position` | userId, outcome=true, pnl>0 |
| Markets traded | `Position` | userId, marketId (count distinct) |
| Posts created | `Post` | authorId, type='post', createdAt |
| Comments created | `Comment` | authorId, createdAt |
| Groups joined | `GroupMember` | userId, isActive=true |
| Agents created | `User` | managedBy=userId, isAgent=true |
| Agent messages | `AgentMessage` | agentUserId (via user's agents) |
| Follow count | `Follow` | followingId=userId (followers) |
| Daily visits | `UserActivityLog` | userId, activityType='session' |
| Chat messages | `Message` | senderId=userId, type='user' |
| Terminal visits | `UserActivityLog` | userId, activityType='open_terminal' |
| Agents page visits | `UserActivityLog` | userId, activityType='open_agents' |
| Login streak | `User` | dailyLoginStreak, longestStreak |

---

## 3. Architecture Design

### High-Level Flow

There are TWO event sources, not one:

```
SOURCE 1: User API action (trade, post, chat, follow, etc.)
    |
    v
Route Handler (existing) — e.g., POST /api/markets/predictions/[id]/buy
    |
    v
void AchievementEngine.checkProgress(userId, { type: 'prediction_trade', marketId })
    |  (fire-and-forget, no await — does NOT block the response)

SOURCE 2: Page visit (client-side navigation)
    |
    v
useSessionHeartbeat hook → POST /api/activity/heartbeat (every 5 min)
    |
    v
Heartbeat handler writes UserActivityLog rows (open_terminal, open_agents, etc.)
    |
    v
void AchievementEngine.checkProgress(userId, { type: 'terminal_visited' })

BOTH SOURCES → same engine:
    |
    +---> Query current progress from DB (1-3 queries depending on resolver)
    +---> Compare against achievement/challenge thresholds
    +---> If completed:
    |       +---> Insert userAchievement (unique constraint = dedup)
    |       +---> PointsService.awardPoints() → increments reputationPoints + bonusPoints
    |       +---> createNotification() → DB row for notification bell
    |       +---> broadcastToChannel() → SSE push for real-time toast (REQUIRED, separate from notification)
    v
    Done
```

**Critical:** `createNotification()` and `broadcastToChannel()` are **independent operations**. The notification service only writes to DB + optionally emails. SSE broadcast is a separate call. Both are needed: notification for the bell icon, broadcast for the real-time toast.

### Design Decisions

1. **Fire-and-forget pattern**: Achievement checks are async and don't block the original request. Use `void checkAchievements(...)` (no await) in route handlers so trading/posting latency isn't affected.

2. **Query-based progress** (not event-sourced): Count achievements from existing tables (`Position`, `Post`, `GroupMember`, etc.) rather than maintaining separate counters. Simpler, always accurate, and leverages existing indexes.

3. **Deterministic challenge rotation**: Daily challenges use `hash(date_string) % pool_size` to pick 3 from 20. Weekly uses `hash(week_string)`. Global for all users (no per-user randomness). This means everyone sees the same challenges, enabling community discussion.

4. **Single service, no new package**: Achievement logic lives in `packages/api/src/services/achievement-service.ts` alongside existing services. No need for a separate package.

5. **Extend existing points system**: Achievements award points via `PointsService.awardPoints()` (static method). Requires adding `'achievement_unlock' | 'challenge_complete'` to the `PointsReason` TypeScript union type in `packages/shared/src/constants/points.ts`. Dedup is NOT handled by the existing `pointsAwardedForX` flags (those only cover predefined one-time actions). Instead, achievement dedup uses the `UserAchievement` unique constraint (`onConflictDoNothing`), and challenge dedup uses the `completed` column check in `UserChallengeProgress`.

6. **SSE broadcast is required for toasts**: `createNotification()` only writes to DB. `broadcastToChannel()` is a separate call required to push events to the client SSE stream. Both must be called on unlock — notification for the bell, broadcast for the real-time toast. Client already subscribes to `notifications:${userId}` channel.

---

## 4. Database Schema

### New Tables

Add to `packages/db/src/schema/achievements.ts`:

```typescript
// Achievement definitions (seeded, not user-generated)
export const achievementDefinitions = pgTable('AchievementDefinition', {
  id: text('id').primaryKey(),                    // 'first_trade', 'market_explorer', etc.
  name: text('name').notNull(),                   // "First Blood"
  description: text('description').notNull(),     // "Make your first prediction trade"
  category: text('category').notNull(),           // 'trading', 'social', 'agents', 'exploration'
  tier: text('tier').notNull(),                   // 'bronze', 'silver', 'gold'
  iconKey: text('iconKey').notNull(),             // Key for frontend icon lookup
  pointsReward: integer('pointsReward').notNull(),
  threshold: integer('threshold').notNull(),       // e.g., 5 markets, 10 trades, 3 agents
  trackingType: text('trackingType').notNull(),   // 'prediction_trade', 'perp_trade', 'post', etc.
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});

// User achievement completions
export const userAchievements = pgTable('UserAchievement', {
  id: text('id').primaryKey(),                     // Snowflake ID
  userId: text('userId').notNull(),
  achievementId: text('achievementId').notNull(),  // FK to AchievementDefinition.id
  unlockedAt: timestamp('unlockedAt', { mode: 'date' }).notNull().defaultNow(),
  pointsAwarded: integer('pointsAwarded').notNull(),
}, (table) => [
  unique('UserAchievement_userId_achievementId_idx').on(table.userId, table.achievementId),
  index('UserAchievement_userId_idx').on(table.userId),
  index('UserAchievement_unlockedAt_idx').on(table.unlockedAt),
]);

// Challenge definitions (seeded pool)
export const challengeDefinitions = pgTable('ChallengeDefinition', {
  id: text('id').primaryKey(),                     // 'daily_3_trades', 'weekly_10_markets', etc.
  name: text('name').notNull(),
  description: text('description').notNull(),
  pool: text('pool').notNull(),                    // 'daily' or 'weekly'
  category: text('category').notNull(),
  iconKey: text('iconKey').notNull(),
  pointsReward: integer('pointsReward').notNull(),
  threshold: integer('threshold').notNull(),        // Target count within time window
  trackingType: text('trackingType').notNull(),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});

// User challenge progress (created when challenge becomes active)
export const userChallengeProgress = pgTable('UserChallengeProgress', {
  id: text('id').primaryKey(),                      // Snowflake ID
  userId: text('userId').notNull(),
  challengeId: text('challengeId').notNull(),       // FK to ChallengeDefinition.id
  periodKey: text('periodKey').notNull(),            // '2026-03-06' (daily) or '2026-W10' (weekly)
  progress: integer('progress').notNull().default(0),
  completed: integer('completed').notNull().default(0), // 0 or 1 (boolean as int for indexing)
  completedAt: timestamp('completedAt', { mode: 'date' }),
  pointsAwarded: integer('pointsAwarded').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  unique('UserChallengeProgress_userId_challengeId_periodKey_idx').on(
    table.userId, table.challengeId, table.periodKey
  ),
  index('UserChallengeProgress_userId_periodKey_idx').on(table.userId, table.periodKey),
]);
```

### Points Constants Extension

Add to `packages/shared/src/constants/points.ts`:

```typescript
// Achievement/challenge point values are per-definition (stored in DB seed data).
// Only bonuses and metadata constants go here.

// Completion bonuses
CHALLENGE_DAILY_ALL_BONUS: 40,    // Bonus for completing all 3 daily challenges
CHALLENGE_WEEKLY_ALL_BONUS: 100,  // Bonus for completing both weekly challenges
```

### Points Reason Extension

Add to `PointsReason` type:

```typescript
| 'achievement_unlock'
| 'challenge_complete'
```

---

## 5. Achievement Definitions (15 Total)

> Source: `ACHIEVEMENTS_AND_CHALLENGES_RESEARCH.md` Section 10

Point values are per-achievement (not uniform per tier) to weight harder achievements higher.

### Bronze Tier (7) - First-time actions, 60-80% expected completion

| ID | Name | Pts | Description | Tracking | Threshold |
|----|------|-----|-------------|----------|-----------|
| `first_prediction_trade` | First Prediction | 75 | Make your first prediction trade | prediction_trade_count | 1 |
| `first_perp_trade` | First Perp | 75 | Make your first perpetual trade | perp_trade_count | 1 |
| `first_agent` | Agent Creator | 100 | Create your first agent | agent_count | 1 |
| `first_agent_message` | Chat with Agent | 50 | Send your first message to an agent | agent_message_count | 1 |
| `terminal_explorer` | Terminal Explorer | 50 | Visit the Terminal page | terminal_visit_count | 1 |
| `agents_explorer` | Agents Explorer | 50 | Visit the Agents page | agents_visit_count | 1 |
| `group_chatter` | Group Chatter | 75 | Send a message in a group chat | group_message_count | 1 |
| `feed_commenter` | Feed Commenter | 50 | Leave your first comment on a post | comment_count | 1 |

> Note: 8 Bronze listed; pick 7 or keep all 8 for a total of 16. The research doc lists these 8 + the below as "15 total". The `feed_commenter` could be dropped to hit exactly 15, or we keep 16. Recommendation: **keep all 8 Bronze** for maximum onboarding coverage (16 total achievements).

### Silver Tier (5) - Intermediate milestones, 20-40% expected completion

| ID | Name | Pts | Description | Tracking | Threshold |
|----|------|-----|-------------|----------|-----------|
| `five_markets` | Five Markets | 150 | Trade in 5 different markets | distinct_markets | 5 |
| `ten_trades` | Active Trader | 100 | Complete 10 trades (prediction or perp) | total_trade_count | 10 |
| `first_win` | First Win | 150 | Win your first resolved prediction | prediction_win_count | 1 |
| `three_agents` | Agent Squad | 200 | Create 3 agents | agent_count | 3 |
| `agent_trader` | Agent Trader | 150 | Have an agent execute a trade | agent_trade_count | 1 |

### Gold Tier (2) - Expert milestones, 5-15% expected completion

| ID | Name | Pts | Description | Tracking | Threshold |
|----|------|-----|-------------|----------|-----------|
| `twenty_five_markets` | Market Veteran | 300 | Trade in 25 different markets | distinct_markets | 25 |
| `seven_day_streak` | Week Trader | 250 | Maintain a 7-day login streak | login_streak | 7 |

### Achievement Categories for UI Grouping
- **Trading**: `first_prediction_trade`, `first_perp_trade`, `five_markets`, `ten_trades`, `first_win`, `twenty_five_markets`, `seven_day_streak`
- **Agents**: `first_agent`, `first_agent_message`, `three_agents`, `agent_trader`
- **Exploration**: `terminal_explorer`, `agents_explorer`
- **Social**: `group_chatter`, `feed_commenter`

---

## 6. Challenge Definitions

> Source: `ACHIEVEMENTS_AND_CHALLENGES_RESEARCH.md` Section 10

### Completion Bonuses

- **+40 pts** for completing all 3 daily challenges in a day
- **+100 pts** for completing both weekly challenges in a week

These bonuses incentivize completing the full set rather than cherry-picking easy ones.

### Daily Pool (20 challenges, 3 shown per day)

Each daily challenge resets at midnight UTC. Points range 25-65 based on difficulty. Target: 30-60% daily completion rate.

| ID | Name | Description | Tracking | Threshold | Pts |
|----|------|-------------|----------|-----------|-----|
| `daily_place_prediction` | Predict Something | Place a prediction trade | daily_pred_trade | 1 | 50 |
| `daily_place_perp` | Go Perp | Open a perpetual position | daily_perp_trade | 1 | 50 |
| `daily_agent_message` | Agent Chat | Send a message to an agent | daily_agent_message | 1 | 35 |
| `daily_open_terminal` | Open Terminal | Visit the Terminal page | daily_terminal_visit | 1 | 25 |
| `daily_open_agents` | Visit Agents | Visit the Agents page | daily_agents_visit | 1 | 25 |
| `daily_comment_post` | Leave a Comment | Comment on a post in the feed | daily_comment | 1 | 40 |
| `daily_like_post` | Like a Post | Like a post in the feed | daily_reaction | 1 | 25 |
| `daily_visit_markets` | Browse Markets | Visit the markets page | daily_markets_visit | 1 | 30 |
| `daily_create_post` | Share Your Take | Create a post | daily_post | 1 | 45 |
| `daily_group_message` | Group Talk | Send a message in a group chat | daily_group_message | 1 | 40 |
| `daily_two_trades` | Double Down | Place 2 trades (any type) | daily_total_trade | 2 | 55 |
| `daily_pred_and_perp` | Both Sides | Place a prediction AND a perp trade | daily_pred_and_perp | 1 | 65 |
| `daily_three_markets` | Market Sampler | Trade in 3 different markets | daily_distinct_markets | 3 | 35 |
| `daily_agent_chat` | Agent Deep Dive | Have a 3-message conversation with an agent | daily_agent_message | 3 | 30 |
| `daily_follow_user` | New Connection | Follow a new user | daily_follow | 1 | 25 |
| `daily_check_feed` | Feed Check | Visit the feed | daily_feed_visit | 1 | 25 |
| `daily_reply_comment` | Join Discussion | Reply to someone's comment | daily_comment | 1 | 40 |
| `daily_open_market` | Market Scout | Open a market detail page | daily_market_detail_visit | 1 | 30 |
| `daily_leaderboard` | Check Rankings | Visit the leaderboard | daily_leaderboard_visit | 1 | 25 |
| `daily_notifications` | Stay Informed | Check your notifications | daily_notifications_visit | 1 | 25 |

### Weekly Pool (20 challenges, 2 shown per week)

Each weekly challenge resets Monday midnight UTC. Points range 80-250 based on difficulty. Target: 15-35% weekly completion rate.

| ID | Name | Description | Tracking | Threshold | Pts |
|----|------|-------------|----------|-----------|-----|
| `weekly_five_markets` | Market Explorer | Trade in 5 different markets | weekly_distinct_markets | 5 | 150 |
| `weekly_agent_trade` | Agent Profit | Have an agent execute a trade | weekly_agent_trade | 1 | 200 |
| `weekly_group_chat` | Group Regular | Send 10 messages in group chats | weekly_group_message | 10 | 120 |
| `weekly_two_wins` | Double Win | Win 2 resolved predictions | weekly_trade_win | 2 | 180 |
| `weekly_both_types` | Both Sides Pro | Trade both predictions and perps | weekly_pred_and_perp | 1 | 150 |
| `weekly_ten_trades` | Active Trader | Complete 10 trades | weekly_total_trade | 10 | 130 |
| `weekly_three_agents` | Agent Collector | Create or interact with 3 agents | weekly_agent_interact | 3 | 200 |
| `weekly_agent_chat_5` | Agent Conversationalist | Have 5 agent conversations | weekly_agent_message | 5 | 100 |
| `weekly_five_comments` | Discussion Driver | Leave 5 comments on posts | weekly_comment | 5 | 120 |
| `weekly_three_posts` | Content Creator | Create 3 posts | weekly_post | 3 | 150 |
| `weekly_seven_markets` | Market Veteran | Trade in 7 different markets | weekly_distinct_markets | 7 | 200 |
| `weekly_positive_pnl` | In the Green | End the week with positive PnL | weekly_positive_pnl | 1 | 180 |
| `weekly_group_create` | Group Leader | Create a group chat | weekly_group_create | 1 | 150 |
| `weekly_feed_engage` | Feed Engaged | Like + comment on 3 posts each | weekly_feed_engage | 3 | 80 |
| `weekly_perp_only` | Perp Specialist | Open 3 perp positions | weekly_perp_trade | 3 | 140 |
| `weekly_pred_only` | Prediction Master | Place 5 prediction trades | weekly_pred_trade | 5 | 100 |
| `weekly_agent_in_group` | Agent + Group | Message an agent AND a group chat | weekly_agent_and_group | 1 | 220 |
| `weekly_five_days` | Consistent Player | Log in 5 days this week | weekly_login_days | 5 | 160 |
| `weekly_referral_play` | Bring a Friend | Refer someone who makes a trade | weekly_referral_play | 1 | 250 |
| `weekly_top_market` | Top Market | Trade in the highest-volume market | weekly_top_market | 1 | 170 |

---

## 7. Backend Services

### 7.1 Achievement Service

**File:** `packages/api/src/services/achievement-service.ts`

```typescript
// Core interface
interface AchievementEngine {
  // Called from route handlers (fire-and-forget)
  checkProgress(userId: string, event: AchievementEvent): Promise<void>;

  // Called from API endpoints
  getUserAchievements(userId: string): Promise<UserAchievementWithDef[]>;
  getAchievementProgress(userId: string): Promise<AchievementProgressMap>;
}

// Events from API route handlers (fire-and-forget after successful mutation)
type AchievementEvent =
  | { type: 'prediction_trade'; marketId: string }
  | { type: 'perp_trade'; ticker: string }
  | { type: 'prediction_win' }
  | { type: 'post_created' }
  | { type: 'comment_created' }
  | { type: 'group_message_sent' }
  | { type: 'agent_created' }
  | { type: 'agent_message_sent' }
  | { type: 'agent_trade_executed' }  // From AutonomousTradingService, not a route
  | { type: 'follow_created' }
  | { type: 'reaction_created' }
  | { type: 'share_created' }
  | { type: 'group_joined' }
  | { type: 'group_created' }
  | { type: 'daily_login'; streak: number }
  // Events from heartbeat route (page visits — written to UserActivityLog first)
  | { type: 'page_visited'; activityType: string };  // 'open_terminal', 'open_agents', etc.
```

**Progress computation strategy** - For each `trackingType`, a resolver function queries the relevant table:

```typescript
const PROGRESS_RESOLVERS: Record<string, (userId: string) => Promise<number>> = {
  prediction_trade_count: async (userId) =>
    db.select({ count: count() }).from(positions).where(eq(positions.userId, userId)),

  perp_trade_count: async (userId) =>
    db.select({ count: count() }).from(perpPositions).where(eq(perpPositions.userId, userId)),

  distinct_markets: async (userId) =>
    db.select({ count: countDistinct(positions.marketId) }).from(positions)
      .where(eq(positions.userId, userId)),

  prediction_win_count: async (userId) =>
    db.select({ count: count() }).from(positions)
      .where(and(eq(positions.userId, userId), eq(positions.outcome, true))),

  // ... etc for each tracking type
};
```

### 7.2 Challenge Service

**File:** `packages/api/src/services/challenge-service.ts`

```typescript
interface ChallengeService {
  // Get active challenges for the current period
  getActiveDailyChallenges(): ChallengeDefinition[];   // 3 from pool of 20
  getActiveWeeklyChallenges(): ChallengeDefinition[];   // 2 from pool of 20

  // Get user's progress on active challenges
  getUserChallengeProgress(userId: string): Promise<UserChallengeProgressWithDef[]>;

  // Check and update progress (called from route handlers)
  checkChallengeProgress(userId: string, event: AchievementEvent): Promise<void>;
}

// Deterministic rotation using simple hash
function getActiveChallengeIds(pool: ChallengeDefinition[], count: number, seed: string): string[] {
  // Use a deterministic hash of the seed (date/week string) to select
  // indices from the pool without replacement
  const hash = createHash('sha256').update(seed).digest();
  const indices = new Set<number>();
  let offset = 0;
  while (indices.size < count && offset < hash.length - 4) {
    const idx = hash.readUInt32BE(offset) % pool.length;
    indices.add(idx);
    offset += 4;
  }
  return [...indices].map(i => pool[i].id);
}

// Daily seed: '2026-03-06' (UTC date string)
// Weekly seed: '2026-W10' (ISO week string)
```

### 7.3 Challenge Progress Tracking

For daily challenges, we query activity within the current UTC day. For weekly, within the current ISO week. Use the existing `UserActivityLog` table where possible, and direct table queries where needed.

Daily progress resolvers count rows with `createdAt >= startOfDay AND createdAt < endOfDay`.
Weekly progress resolvers count rows with `createdAt >= startOfWeek AND createdAt < endOfWeek`.

The `userChallengeProgress` table caches the current count to avoid re-querying on every page load. It's updated incrementally when `checkChallengeProgress` is called.

### 7.4 Completion Bonuses

When a challenge is completed, the service checks whether all challenges in that period are now complete:

```typescript
async function checkAndAwardCompletionBonus(userId: string, pool: 'daily' | 'weekly', periodKey: string) {
  const activeIds = getActiveChallengeIds(pool, periodKey);
  const completedCount = await db.select({ count: count() })
    .from(userChallengeProgress)
    .where(and(
      eq(userChallengeProgress.userId, userId),
      eq(userChallengeProgress.periodKey, periodKey),
      inArray(userChallengeProgress.challengeId, activeIds),
      eq(userChallengeProgress.completed, 1),
    ));

  const target = pool === 'daily' ? 3 : 2;
  if (completedCount === target) {
    const bonus = pool === 'daily' ? POINTS.CHALLENGE_DAILY_ALL_BONUS : POINTS.CHALLENGE_WEEKLY_ALL_BONUS;
    await awardPoints(userId, bonus, 'challenge_complete', { type: `${pool}_all_bonus`, periodKey });
    await broadcastChallengeBonus(userId, pool, bonus);
  }
}
```

### 7.5 Compound & Complex Challenge Resolvers

Some challenges have non-trivial resolution logic. Each is documented here with the actual query strategy.

**Compound AND-logic** (returns 0 or 1):

```typescript
// daily_pred_and_perp: Both a prediction AND perp trade in one day
daily_pred_and_perp: async (userId, start, end) => {
  const hasPred = await db.select({ c: count() }).from(positions)
    .where(and(eq(positions.userId, userId), gte(positions.createdAt, start), lt(positions.createdAt, end)));
  const hasPerp = await db.select({ c: count() }).from(perpPositions)
    .where(and(eq(perpPositions.userId, userId), gte(perpPositions.openedAt, start), lt(perpPositions.openedAt, end)));
  return (hasPred[0].c > 0 && hasPerp[0].c > 0) ? 1 : 0;
},

// weekly_agent_and_group: Agent message AND group message this week
weekly_agent_and_group: async (userId, start, end) => {
  // Agent messages: join AgentMessage -> User (where User.managedBy = userId)
  const hasAgent = await db.select({ c: count() }).from(agentMessages)
    .innerJoin(users, eq(agentMessages.agentUserId, users.id))
    .where(and(eq(users.managedBy, userId), gte(agentMessages.createdAt, start), lt(agentMessages.createdAt, end)));
  // Group messages: join Message -> Chat (where Chat.isGroup = true)
  const hasGroup = await db.select({ c: count() }).from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(eq(messages.senderId, userId), eq(chats.isGroup, true),
      gte(messages.createdAt, start), lt(messages.createdAt, end)));
  return (hasAgent[0].c > 0 && hasGroup[0].c > 0) ? 1 : 0;
},

// weekly_both_types: Same pattern as daily_pred_and_perp but weekly window
```

**Complex resolvers** (require special queries):

```typescript
// weekly_positive_pnl: User has positive PnL for the week
// Strategy: Sum resolved Position.pnl (where resolvedAt in week) + sum PerpPosition.realizedPnL (where closedAt in week)
weekly_positive_pnl: async (userId, start, end) => {
  const predPnl = await db.select({ total: sql<number>`COALESCE(SUM(${positions.pnl}), 0)` })
    .from(positions)
    .where(and(eq(positions.userId, userId), isNotNull(positions.resolvedAt),
      gte(positions.resolvedAt, start), lt(positions.resolvedAt, end)));
  const perpPnl = await db.select({ total: sql<number>`COALESCE(SUM(${perpPositions.realizedPnL}), 0)` })
    .from(perpPositions)
    .where(and(eq(perpPositions.userId, userId), isNotNull(perpPositions.closedAt),
      gte(perpPositions.closedAt, start), lt(perpPositions.closedAt, end)));
  const totalPnl = Number(predPnl[0].total) + Number(perpPnl[0].total);
  return totalPnl > 0 ? 1 : 0;
},

// weekly_referral_play: Refer someone who makes a trade this week
// Strategy: Join Referral -> referred user's Position (created this week)
weekly_referral_play: async (userId, start, end) => {
  const result = await db.select({ c: count() }).from(referrals)
    .innerJoin(positions, eq(referrals.referredUserId, positions.userId))
    .where(and(
      eq(referrals.referrerId, userId),
      gte(positions.createdAt, start), lt(positions.createdAt, end),
    ));
  return result[0].c > 0 ? 1 : 0;
},

// weekly_top_market: Trade in the highest-volume market this week
// Strategy: Find market with most positions created this week, then check if user has one
weekly_top_market: async (userId, start, end) => {
  // Step 1: Find top market by volume this week
  const topMarket = await db.select({ marketId: positions.marketId, vol: count() })
    .from(positions)
    .where(and(gte(positions.createdAt, start), lt(positions.createdAt, end)))
    .groupBy(positions.marketId)
    .orderBy(desc(count()))
    .limit(1);
  if (!topMarket[0]) return 0;
  // Step 2: Check if user traded in it
  const userTrade = await db.select({ c: count() }).from(positions)
    .where(and(eq(positions.userId, userId), eq(positions.marketId, topMarket[0].marketId),
      gte(positions.createdAt, start), lt(positions.createdAt, end)));
  return userTrade[0].c > 0 ? 1 : 0;
},

// weekly_feed_engage: Like + comment on 3 posts each
// Strategy: Count distinct posts liked AND distinct posts commented on
weekly_feed_engage: async (userId, start, end) => {
  const likes = await db.select({ c: countDistinct(reactions.postId) }).from(reactions)
    .where(and(eq(reactions.userId, userId), gte(reactions.createdAt, start), lt(reactions.createdAt, end)));
  const comments = await db.select({ c: countDistinct(comments.postId) }).from(comments)
    .where(and(eq(comments.authorId, userId), isNull(comments.deletedAt),
      gte(comments.createdAt, start), lt(comments.createdAt, end)));
  return Math.min(likes[0].c, comments[0].c); // Must have both >= 3
},

// weekly_agent_interact: Create or interact with 3 distinct agents
// Strategy: Count distinct agent userIds where user sent messages OR created them
weekly_agent_interact: async (userId, start, end) => {
  // Agents user created this week
  const created = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.managedBy, userId), eq(users.isAgent, true),
      gte(users.createdAt, start), lt(users.createdAt, end)));
  // Agents user messaged this week (via agent chat route)
  const messaged = await db.selectDistinct({ agentId: agentMessages.agentUserId })
    .from(agentMessages)
    .innerJoin(users, eq(agentMessages.agentUserId, users.id))
    .where(and(eq(users.managedBy, userId),
      gte(agentMessages.createdAt, start), lt(agentMessages.createdAt, end)));
  const uniqueAgents = new Set([...created.map(r => r.id), ...messaged.map(r => r.agentId)]);
  return uniqueAgents.size;
},
```

**Resolver complexity tiers:**
- **Simple count** (12 challenges): Single table, count rows in window. ~1 query each.
- **Distinct count** (4 challenges): countDistinct on marketId, postId, etc. ~1 query each.
- **Page visit** (6 challenges): Check `UserActivityLog` existence. ~1 query each.
- **Compound AND** (3 challenges): Two simple queries, return boolean. ~2 queries each.
- **Complex join** (5 challenges): Multi-table joins or two-step queries. ~2-3 queries each.

Total per `checkChallengeProgress` call: Only resolvers for the 3 active daily + 2 active weekly challenges are run, and only for tracking types that match the incoming event. Worst case: ~3-5 queries per fire-and-forget call.

---

## 8. API Endpoints

### 8.1 Achievements API

```
GET /api/achievements
  -> Returns all 15 achievement definitions + user's unlock status + progress

GET /api/achievements/recent
  -> Returns user's most recently unlocked achievements (for profile display)
```

### 8.2 Challenges API

```
GET /api/challenges
  -> Returns active daily (3) + weekly (2) challenges with user progress

GET /api/challenges/history?period=daily|weekly&page=1
  -> Returns completed challenges history (optional, V2)
```

### 8.3 Schema Definitions

**File:** `packages/api/src/schemas/achievements.ts` (if using zod-openapi pattern)
or validated inline in route handlers (simpler for V1).

**Response shapes:**

```typescript
// GET /api/achievements
{
  achievements: [{
    id: string,
    name: string,
    description: string,
    category: string,
    tier: 'bronze' | 'silver' | 'gold',
    iconKey: string,
    pointsReward: number,
    threshold: number,
    progress: number,          // Current progress toward threshold
    unlocked: boolean,
    unlockedAt: string | null, // ISO date
  }]
}

// GET /api/challenges
{
  daily: {
    challenges: [{
      id: string,
      name: string,
      description: string,
      category: string,
      iconKey: string,
      pointsReward: number,
      threshold: number,
      progress: number,
      completed: boolean,
      completedAt: string | null,
    }],
    allCompletedBonus: 40,           // Bonus pts for completing all 3
    allCompleted: boolean,            // Whether user completed all 3 today
    resetsAt: string,                 // ISO date of next daily reset (midnight UTC)
  },
  weekly: {
    challenges: [{...}],
    allCompletedBonus: 100,           // Bonus pts for completing both
    allCompleted: boolean,            // Whether user completed both this week
    resetsAt: string,                 // ISO date of next weekly reset (Monday midnight UTC)
  }
}
```

### 8.4 OpenAPI / Codegen

Add schema definitions to `packages/api/src/schemas/achievements.ts` with `.meta({ id })` on each schema, then register paths via the swagger auto-generator JSDoc tags on the route handlers. Run `bun run generate:api` to regenerate hooks.

---

## 9. Frontend Components

### 9.1 New Components

**Directory:** `apps/web/src/components/achievements/`

| Component | Purpose |
|-----------|---------|
| `AchievementCard.tsx` | Single achievement with icon, name, tier badge, progress bar, lock/unlock state |
| `AchievementGrid.tsx` | Grid of all 15 achievements, grouped by tier, with category filter tabs |
| `AchievementUnlockToast.tsx` | Custom Sonner toast with achievement icon + points awarded |
| `ChallengeCard.tsx` | Single challenge with progress bar, countdown timer, completion state |
| `ChallengePanel.tsx` | Panel showing 3 daily + 2 weekly challenges with reset timers |
| `AchievementBadge.tsx` | Small badge for profile display (similar to existing StreakBadge pattern) |

### 9.2 Design Patterns (Match Existing)

Follow existing badge patterns:
- **Size variants**: `sm`, `md`, `lg` (like `RankBadge`, `OnChainBadge`)
- **Tier colors**: Bronze (`text-amber-600`), Silver (`text-slate-400`), Gold (`text-yellow-500` with gradient like `StreakBadge`)
- **Icons**: `lucide-react` icons (Trophy, Target, Flame, Sword, Users, Bot, etc.)
- **Progress bars**: Tailwind `bg-primary` with `rounded-full` (match reward task cards)
- **Locked state**: `opacity-40` with lock overlay
- **Unlocked celebration**: Confetti pattern from `DailyLoginModal.tsx`

### 9.3 Toast Implementation

Use Sonner custom toast for achievement unlocks:

```typescript
toast.custom((id) => (
  <AchievementUnlockToast
    name="First Blood"
    tier="bronze"
    points={100}
    onClose={() => toast.dismiss(id)}
  />
));
```

Triggered by SSE event listener on the client (existing SSE subscription in app).

### 9.4 Rewards Page Integration

Add two new sections to `apps/web/src/app/rewards/page.tsx`:

1. **Challenges section** (above daily streak card) - ChallengePanel with daily/weekly
2. **Achievements section** (below reward tasks) - AchievementGrid with all 15

### 9.5 Profile Page Integration

Show unlocked achievements on user profile in `apps/web/src/components/profile/ProfilePageClient.tsx`:
- Row of achievement badges below username/bio
- "View all" link to rewards page achievements section

### 9.6 State Management

**No Zustand store.** Use the generated React Query hooks from Orval (`useGetAchievements`, `useGetChallenges`) for data fetching. React Query already handles caching, refetching, and stale-while-revalidate.

For real-time SSE updates (achievement unlock toast), the `useSSEChannel` hook fires the toast directly — no need to merge into cached state. After the toast, call `queryClient.invalidateQueries(['achievements'])` to refetch fresh data so the UI updates.

```typescript
// In app-level provider or layout:
useSSEChannel(`notifications:${userId}`, (event) => {
  if (event.type === 'achievement_unlocked' || event.type === 'challenge_completed') {
    // Show toast
    toast.custom((id) => <AchievementUnlockToast {...event} onClose={() => toast.dismiss(id)} />);
    // Invalidate cache so Rewards page updates
    queryClient.invalidateQueries({ queryKey: ['/api/achievements'] });
    queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
  }
});
```

---

## 10. Integration Points

### 10.1 Route Handler Hooks

Add `void achievementEngine.checkProgress(userId, event)` calls to existing route handlers. These are fire-and-forget (no `await`).

| Route (verified path) | File | Event |
|----------------------|------|-------|
| `POST /api/markets/predictions/[id]/buy` | `apps/web/src/app/api/markets/predictions/[id]/buy/route.ts` | `{ type: 'prediction_trade', marketId }` |
| `POST /api/markets/predictions/[id]/sell` | `apps/web/src/app/api/markets/predictions/[id]/sell/route.ts` | `{ type: 'prediction_trade', marketId }` |
| `POST /api/markets/perps/open` | `apps/web/src/app/api/markets/perps/open/route.ts` | `{ type: 'perp_trade', ticker }` |
| `POST /api/posts` | `apps/web/src/app/api/posts/route.ts` | `{ type: 'post_created' }` |
| `POST /api/posts/[id]/reply` | `apps/web/src/app/api/posts/[id]/reply/route.ts` | `{ type: 'comment_created' }` |
| `POST /api/users/[userId]/follow` | `apps/web/src/app/api/users/[userId]/follow/route.ts` | `{ type: 'follow_created' }` |
| `POST /api/chats/[id]/message` | `apps/web/src/app/api/chats/[id]/message/route.ts` | `{ type: 'group_message_sent' }` (check `chat.isGroup`) |
| `POST /api/agents` | `apps/web/src/app/api/agents/route.ts` | `{ type: 'agent_created' }` |
| `POST /api/agents/[agentId]/chat` | `apps/web/src/app/api/agents/[agentId]/chat/route.ts` | `{ type: 'agent_message_sent' }` |
| `POST /api/posts/[id]/like` | `apps/web/src/app/api/posts/[id]/like/route.ts` | `{ type: 'reaction_created' }` |
| `POST /api/posts/[id]/share` | `apps/web/src/app/api/posts/[id]/share/route.ts` | `{ type: 'share_created' }` |
| `POST /api/groups/invites/[inviteId]/accept` | `apps/web/src/app/api/groups/invites/[inviteId]/accept/route.ts` | `{ type: 'group_joined' }` |
| `POST /api/groups` | `apps/web/src/app/api/groups/route.ts` | `{ type: 'group_created' }` |
| `POST /api/users/daily-login` | `apps/web/src/app/api/users/daily-login/route.ts` | `{ type: 'daily_login', streak }` |

**Non-route integration points** (these are NOT API routes — different pattern):

| Location | File | Event | Notes |
|----------|------|-------|-------|
| Agent trade execution | `packages/agents/src/autonomous/AutonomousTradingService.ts` | `{ type: 'agent_trade_executed' }` | Called inside cron-driven NPC tick, not a user-facing route. Hook into `DirectExecutors.executeDirectTrade()` or the tracking function `trackAgentTradeExecuted()`. |
| Market resolution | `apps/web/src/app/api/cron/markets-tick/route.ts` | `{ type: 'prediction_win' }` | Batch operation in cron job. After resolving positions, iterate winning users and fire `checkProgress` for each. |

**Page-visit events** (tracked via activity heartbeat — requires changes to 3 files):

The heartbeat currently sends `{ sessionId, pageViews, lastPath }` and writes exactly one `UserActivityLog` row with `activityType: 'session'` per day. We need to extend it.

**Changes required:**

1. **Client hook** (`apps/web/src/hooks/useSessionHeartbeat.ts`):
   - Already tracks `lastPath` via `usePathname()`. Add a route-to-activityType mapping:
   ```typescript
   const PAGE_ACTIVITY_MAP: Record<string, string> = {
     '/terminal': 'open_terminal',
     '/agents': 'open_agents',
     '/markets': 'open_markets',
     '/feed': 'open_feed',
     '/leaderboard': 'open_leaderboard',
     '/notifications': 'open_notifications',
   };
   // For /markets/[id], use startsWith('/markets/') && path !== '/markets'
   ```
   - Track a `Set<string>` of visited activity types since last heartbeat
   - Send them as `visitedPages: string[]` in the heartbeat payload

2. **Heartbeat route** (`apps/web/src/app/api/activity/heartbeat/route.ts`):
   - Accept `visitedPages?: string[]` in request body
   - Validate against an allowlist of known activity types (prevent injection)
   - For each valid activityType, upsert into `UserActivityLog` (existing unique constraint on `(userId, activityDate, activityType)` means one row per type per day — `.onConflictDoNothing()`)

3. **Schema** — no changes needed. `UserActivityLog.activityType` is already `text` (no enum constraint). The unique constraint `(userId, activityDate, activityType)` already handles dedup.

**Key detail:** The unique constraint means "did user visit Terminal today?" is a simple existence check: `SELECT 1 FROM UserActivityLog WHERE userId = ? AND activityDate = ? AND activityType = 'open_terminal'`. This is exactly what daily challenge resolvers need.

| Page | Route Pattern | Activity Type |
|------|--------------|---------------|
| Terminal | `/terminal` | `open_terminal` |
| Agents | `/agents` | `open_agents` |
| Markets | `/markets` | `open_markets` |
| Feed | `/feed` | `open_feed` |
| Leaderboard | `/leaderboard` | `open_leaderboard` |
| Notifications | `/notifications` | `open_notifications` |
| Market detail | `/markets/[id]` | `open_market_detail` |

6 of 20 daily challenges depend on this (`daily_open_terminal`, `daily_open_agents`, `daily_visit_markets`, `daily_check_feed`, `daily_leaderboard`, `daily_notifications`), plus 2 achievements (`terminal_explorer`, `agents_explorer`). This is **blocking for ~30% of challenges** and must be implemented in Phase 3, not deferred.

### 10.2 Notification Type Extension

Add `'achievement_unlocked'` and `'challenge_completed'` to `NotificationType` in `packages/api/src/services/notification-service.ts`.

### 10.3 SSE Event Broadcasting (REQUIRED for toasts)

`createNotification()` only inserts a DB row and optionally sends email. It does **NOT** push to SSE. You **must** separately call `broadcastToChannel()` for real-time toast delivery.

**Server side** — add to `packages/api/src/sse/event-broadcaster.ts`:

```typescript
export async function broadcastAchievementUnlock(userId: string, achievement: {
  id: string; name: string; tier: string; pointsReward: number;
}) {
  // Channel must be notifications:${userId} — this is already subscribed by the client
  // via the useSSE hook's includeNotifications: true token request
  await broadcastToChannel(`notifications:${userId}`, {
    type: 'achievement_unlocked',
    ...achievement,
  });
}

export async function broadcastChallengeComplete(userId: string, challenge: {
  id: string; name: string; pointsReward: number; isAllBonus?: boolean;
}) {
  await broadcastToChannel(`notifications:${userId}`, {
    type: 'challenge_completed',
    ...challenge,
  });
}
```

**Client side** — add listener in the app-level SSE provider. The client already subscribes to `notifications:${userId}` via the realtime token endpoint (`POST /api/realtime/token` with `includeNotifications: true`). The existing `useSSE` hook / `SSEManager` routes messages by channel.

```typescript
// In the app layout or a dedicated hook:
useSSEChannel(`notifications:${userId}`, (event) => {
  if (event.type === 'achievement_unlocked') {
    toast.custom((id) => (
      <AchievementUnlockToast {...event} onClose={() => toast.dismiss(id)} />
    ));
  }
  if (event.type === 'challenge_completed') {
    toast.success(`Challenge complete: ${event.name} +${event.pointsReward} pts`);
  }
});
```

### 10.4 Points Integration

**How the existing PointsService actually works:**
- `PointsService.awardPoints(userId, amount, reason, metadata)` is a static method
- It increments `User.reputationPoints` (always) and `User.bonusPoints` (for non-referral reasons)
- Creates a `PointsTransaction` record for audit trail
- Calls `TotalPointsService.markDirty(userId)` to flag async recompute of `User.totalPoints` (recomputed by a 15-min cron)
- Has built-in duplicate prevention via `pointsAwardedForX` boolean flags on User table — but only for predefined reasons (profile, social links, etc.)

**What we need to handle ourselves:**
- `PointsReason` is a TypeScript union type in `packages/shared/src/constants/points.ts` — we must add `'achievement_unlock' | 'challenge_complete'` to it
- Achievements don't have `pointsAwardedFor*` flags. Dedup is handled by the `UserAchievement` unique constraint: attempt insert, if conflict → already awarded
- Challenge dedup is handled by the `UserChallengeProgress` table: check `completed = 1` before awarding

```typescript
// Achievement unlock (inside achievement-service.ts)
// 1. Try insert into userAchievements (unique on userId + achievementId)
const [inserted] = await db.insert(userAchievements)
  .values({ id: await generateSnowflakeId(), userId, achievementId: def.id, pointsAwarded: def.pointsReward, unlockedAt: new Date() })
  .onConflictDoNothing()
  .returning();

if (!inserted) return; // Already unlocked, skip

// 2. Award points via existing service
await PointsService.awardPoints(userId, def.pointsReward, 'achievement_unlock', {
  achievementId: def.id,
  achievementName: def.name,
});

// 3. Create notification + SSE broadcast (BOTH required for toast)
await createNotification({ userId, type: 'achievement_unlocked', title: def.name, message: `+${def.pointsReward} pts` });
await broadcastToChannel(`notifications:${userId}`, { type: 'achievement_unlocked', data: { id: def.id, name: def.name, tier: def.tier, points: def.pointsReward } });
```

---

## 11. Implementation Phases

### Phase 1: Database & Core Service (2-3 days)

1. **Create schema file** `packages/db/src/schema/achievements.ts`
   - `achievementDefinitions`, `userAchievements`, `challengeDefinitions`, `userChallengeProgress` tables
   - Export from schema barrel `packages/db/src/schema/index.ts`
   - Run `bun run db:generate` + `bun run db:push`

2. **Extend points constants** in `packages/shared/src/constants/points.ts`
   - Add `CHALLENGE_DAILY_ALL_BONUS: 40`, `CHALLENGE_WEEKLY_ALL_BONUS: 100`
   - Add `'achievement_unlock'` and `'challenge_complete'` to `PointsReason`
   - Per-achievement/challenge point values live in the seed data, not constants

3. **Seed data script** `apps/cli/src/commands/db.ts (add seed-achievements subcommand)`
   - Insert 15 achievement definitions (8 Bronze + 5 Silver + 2 Gold) with per-definition point values
   - Insert 40 challenge definitions (20 daily @ 25-65 pts + 20 weekly @ 80-250 pts)

4. **Create AchievementService** `packages/api/src/services/achievement-service.ts`
   - Progress resolvers for each tracking type
   - `checkProgress()` method with duplicate-prevention (check userAchievements before awarding)
   - `getUserAchievements()` with progress calculation
   - Points awarding on unlock

5. **Create ChallengeService** `packages/api/src/services/challenge-service.ts`
   - Deterministic rotation logic
   - Progress tracking and incremental updates
   - Period key generation (daily/weekly)

6. **Extend NotificationType** with `'achievement_unlocked'`, `'challenge_completed'`

### Phase 2: API Endpoints (1-2 days)

7. **Create route handlers**
   - `apps/web/src/app/api/achievements/route.ts` (GET)
   - `apps/web/src/app/api/challenges/route.ts` (GET)

8. **Add API schemas** to `packages/api/src/schemas/achievements.ts`
   - `AchievementsResponse`, `ChallengesResponse` with `.meta({ id })`

9. **Run `bun run generate:api`** to generate React Query hooks

### Phase 3: Integration Hooks (1-2 days)

10. **Add checkProgress calls** to existing route handlers (see Section 10.1)
    - Each is a single line: `void achievementEngine.checkProgress(userId, { type: '...' })`
    - No changes to existing response shapes or logic

11. **Extend heartbeat for page-visit tracking** (3 files, blocks ~30% of challenges)
    - `apps/web/src/hooks/useSessionHeartbeat.ts`: Add route-to-activityType mapping, track visited pages in a Set, send as `visitedPages: string[]`
    - `apps/web/src/app/api/activity/heartbeat/route.ts`: Accept `visitedPages`, validate against allowlist, insert `UserActivityLog` rows with `.onConflictDoNothing()` per activity type
    - No schema changes needed (activityType is already `text`, unique constraint already exists)

12. **Add SSE broadcast** for achievement unlocks
    - Add `broadcastAchievementUnlock()` and `broadcastChallengeComplete()` to `event-broadcaster.ts`
    - Channel: `notifications:${userId}` (already subscribed by client via `includeNotifications: true`)

### Phase 4: Frontend UI (2-3 days)

13. **Create UI components** in `apps/web/src/components/achievements/`
    - `AchievementCard`, `AchievementGrid`, `ChallengeCard`, `ChallengePanel`
    - `AchievementUnlockToast`, `AchievementBadge`

14. **Integrate into Rewards page**
    - Add ChallengePanel section
    - Add AchievementGrid section

15. **Profile page integration**
    - Show unlocked achievement badges

16. **SSE listener for real-time toasts**
    - Add `useSSEChannel` listener in app layout for `achievement_unlocked` / `challenge_completed`
    - Show custom Sonner toast + invalidate React Query cache

### Phase 5: Testing & Polish (1-2 days)

17. **Unit tests** in `packages/testing/unit/`
    - `achievement-service.test.ts` - progress resolvers, unlock logic, dedup
    - `challenge-service.test.ts` - rotation determinism, progress tracking
    - `challenge-rotation.test.ts` - verify same date always gives same challenges

18. **Integration tests** in `packages/testing/integration/`
    - `achievements-api.integration.test.ts`
    - `challenges-api.integration.test.ts`

19. **Manual QA**
    - Verify all 15 achievements unlock correctly
    - Verify daily/weekly rotation
    - Verify toast notifications
    - Verify points awarded correctly

---

## 12. Success Metrics

> Source: `ACHIEVEMENTS_AND_CHALLENGES_RESEARCH.md` Section 9

### Achievement Completion Targets
| Tier | Target Completion Rate |
|------|----------------------|
| Bronze | 60-80% of active users |
| Silver | 20-40% of active users |
| Gold | 5-15% of active users |

### Challenge Completion Targets
| Type | Target Completion Rate |
|------|----------------------|
| Daily (individual) | 30-60% of daily active users |
| Daily (all 3 bonus) | 15-30% |
| Weekly (individual) | 15-35% of weekly active users |
| Weekly (both bonus) | 8-18% |

### Key Metrics to Track (PostHog)
- **Reward Farmer conversion**: % of users who previously only claimed daily rewards and now perform play actions (trades, agent interactions, terminal visits)
- **Achievement funnel**: Bronze unlock rate -> Silver -> Gold (drop-off analysis)
- **Challenge engagement**: % of DAU who view challenges, % who complete at least 1
- **Time-to-first-achievement**: median time from signup to first Bronze unlock
- **Feature discovery via achievements**: % of users who visit Terminal/Agents for the first time via an achievement prompt
- **Points velocity**: average points earned per user per day from achievements vs challenges

### Anti-Farming Signals
Monitor for exploitation patterns:
- Users completing page-visit challenges in <2 seconds (bot behavior)
- Users with 100% challenge completion but 0 trading volume
- Spike in low-quality posts/comments timed to challenge resets

---

## 13. Testing Strategy

### Unit Tests

```typescript
// achievement-service.test.ts
describe('AchievementService', () => {
  it('should unlock achievement when threshold reached');
  it('should not double-unlock same achievement');
  it('should award correct points per tier');
  it('should return progress for all achievements');
  it('should handle concurrent unlock attempts');
});

// challenge-service.test.ts
describe('ChallengeService', () => {
  it('should select 3 daily challenges deterministically from date');
  it('should select 2 weekly challenges deterministically from week');
  it('should return same challenges for same date across calls');
  it('should return different challenges for different dates');
  it('should track incremental progress');
  it('should complete challenge when threshold reached');
  it('should not allow progress on expired challenges');
});
```

### Integration Tests

```typescript
// achievements-api.integration.test.ts
describe('GET /api/achievements', () => {
  it('should return all 15 achievements with progress');
  it('should show unlocked achievements');
  it('should require authentication');
});

describe('GET /api/challenges', () => {
  it('should return 3 daily + 2 weekly challenges');
  it('should include progress for authenticated user');
  it('should show reset timestamps');
});
```

### Key Validation Points
- Same date string always produces same 3 daily challenges
- Same week string always produces same 2 weekly challenges
- Achievement can only be unlocked once per user
- Points are awarded exactly once per achievement
- Challenge progress resets correctly at period boundaries
- Fire-and-forget calls don't crash route handlers on failure
- Notifications are created for unlocks

---

## Appendix: File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `packages/db/src/schema/achievements.ts` | DB schema for 4 new tables |
| `packages/api/src/services/achievement-service.ts` | Core achievement logic |
| `packages/api/src/services/challenge-service.ts` | Challenge rotation + progress |
| `packages/api/src/schemas/achievements.ts` | Zod schemas for API |
| `apps/web/src/app/api/achievements/route.ts` | Achievements API endpoint |
| `apps/web/src/app/api/challenges/route.ts` | Challenges API endpoint |
| `apps/web/src/components/achievements/AchievementCard.tsx` | Achievement card component |
| `apps/web/src/components/achievements/AchievementGrid.tsx` | Achievement grid layout |
| `apps/web/src/components/achievements/AchievementBadge.tsx` | Small badge for profile |
| `apps/web/src/components/achievements/AchievementUnlockToast.tsx` | Custom unlock toast |
| `apps/web/src/components/achievements/ChallengeCard.tsx` | Challenge card component |
| `apps/web/src/components/achievements/ChallengePanel.tsx` | Daily/weekly challenges panel |
| `apps/web/src/components/achievements/index.ts` | Barrel export |
| `apps/cli/src/commands/db.ts` | Add `seed-achievements` subcommand (file already exists, add new command) |
| `packages/testing/unit/achievement-service.test.ts` | Unit tests |
| `packages/testing/unit/challenge-service.test.ts` | Unit tests |
| `packages/testing/integration/achievements-api.integration.test.ts` | Integration tests |

### Modified Files
| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Export new achievements schema |
| `packages/shared/src/constants/points.ts` | Add bonus constants + `'achievement_unlock' \| 'challenge_complete'` to `PointsReason` union type |
| `packages/api/src/services/notification-service.ts` | Add `'achievement_unlocked' \| 'challenge_completed'` to `NotificationType` union type |
| `packages/api/src/sse/event-broadcaster.ts` | Add `broadcastAchievementUnlock()` + `broadcastChallengeComplete()` |
| `apps/web/src/app/rewards/page.tsx` | Add Challenges + Achievements sections |
| `apps/web/src/components/profile/ProfilePageClient.tsx` | Show achievement badges |
| `apps/web/src/app/api/activity/heartbeat/route.ts` | Accept `visitedPages[]`, validate, write `UserActivityLog` rows |
| `apps/web/src/hooks/useSessionHeartbeat.ts` | Track page visits, send `visitedPages[]` with heartbeat |
| `apps/web/src/app/layout.tsx` (or app-level provider) | Add `useSSEChannel` listener for achievement/challenge toasts |
| `apps/web/src/app/api/markets/predictions/[id]/buy/route.ts` | `void checkProgress(userId, { type: 'prediction_trade', marketId })` |
| `apps/web/src/app/api/markets/predictions/[id]/sell/route.ts` | `void checkProgress(userId, { type: 'prediction_trade', marketId })` |
| `apps/web/src/app/api/markets/perps/open/route.ts` | `void checkProgress(userId, { type: 'perp_trade', ticker })` |
| `apps/web/src/app/api/posts/route.ts` | `void checkProgress(userId, { type: 'post_created' })` |
| `apps/web/src/app/api/posts/[id]/reply/route.ts` | `void checkProgress(userId, { type: 'comment_created' })` |
| `apps/web/src/app/api/posts/[id]/like/route.ts` | `void checkProgress(userId, { type: 'reaction_created' })` |
| `apps/web/src/app/api/posts/[id]/share/route.ts` | `void checkProgress(userId, { type: 'share_created' })` |
| `apps/web/src/app/api/users/[userId]/follow/route.ts` | `void checkProgress(userId, { type: 'follow_created' })` |
| `apps/web/src/app/api/chats/[id]/message/route.ts` | `void checkProgress(userId, { type: 'group_message_sent' })` (if `chat.isGroup`) |
| `apps/web/src/app/api/agents/route.ts` | `void checkProgress(userId, { type: 'agent_created' })` |
| `apps/web/src/app/api/agents/[agentId]/chat/route.ts` | `void checkProgress(userId, { type: 'agent_message_sent' })` |
| `apps/web/src/app/api/groups/route.ts` | `void checkProgress(userId, { type: 'group_created' })` |
| `apps/web/src/app/api/groups/invites/[inviteId]/accept/route.ts` | `void checkProgress(userId, { type: 'group_joined' })` |
| `apps/web/src/app/api/users/daily-login/route.ts` | `void checkProgress(userId, { type: 'daily_login', streak })` |
| `packages/agents/src/autonomous/AutonomousTradingService.ts` | `void checkProgress(managingUserId, { type: 'agent_trade_executed' })` |
