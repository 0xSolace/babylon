# PR: Achievements & Challenges System (V1)

**Title:** feat: add achievements & challenges system with Figma UI, SSE notifications, and daily rewards

---

## Summary

- Adds a full V1 achievements & challenges engine: 15 permanent achievements (8 Bronze, 5 Silver, 2 Gold) and 40 rotating challenges (20 daily pool → 3/day, 20 weekly pool → 2/week) with query-based progress tracking, completion bonuses (+40 daily, +100 weekly), and points integration
- New Figma-matched rewards UI with 3-tab layout (Overview, Achievements, Challenges), daily streak card with claim flow, live countdown timers, tier filtering, progress bars, and SSE-powered real-time UI refresh + toast notifications
- Fire-and-forget `checkProgress()` wired into 16 route handlers covering trades, posts, comments, agents, follows, groups, page visits, daily login, and market resolution

## Type

- [x] Feature

## Context / Links

- Implements the full achievements & challenges system from design specs
- Achievement UI matches Figma designs in `docs/achievement-ui/`

## Scope (keep it focused)

- [x] This PR is focused on a single change/theme (not a catch-all)
- [x] Drive-by refactors are excluded or split into a separate PR
- [x] Non-goals / follow-ups are listed below (with links)

**Areas touched**
- [x] Web UI (`apps/web`)
- [x] Web API routes / SSE / A2A (`apps/web`)
- [x] API infra (`packages/api`)
- [x] DB (`packages/db`)
- [x] Shared types/utils (`packages/shared`)
- [x] Tests (`packages/testing`)
- [x] Domain / game engine (`packages/engine`, `packages/core/*`)

## Changes

### Backend (packages/api, packages/db, packages/shared, packages/engine)
- **Achievement service** (`packages/api/src/services/achievement-service.ts`): ~1600-line engine with `checkProgress()`, `getUserAchievements()`, `getUserChallenges()`, query-based progress resolvers, deterministic SHA-256 challenge rotation, and SSE broadcasts
- **DB schema**: New tables `AchievementDefinition`, `ChallengeDefinition`, `UserAchievement`, `UserChallengeProgress` with indexes and unique constraints (migration 0045)
- **Shared constants**: 15 achievement definitions + 40 challenge definitions in `packages/shared/src/constants/achievements.ts`, plus `POINTS.CHALLENGE_DAILY_ALL_BONUS` and `POINTS.CHALLENGE_WEEKLY_ALL_BONUS`
- **API routes**: `GET /api/achievements`, `GET /api/challenges` with authenticated access
- **checkProgress integration**: Fire-and-forget calls in 16 route handlers: predictions buy/sell, perps open, posts create/reply/like/share, chats message (group), agents create/chat, users follow, groups create/invite-accept, daily-login, heartbeat (page visits), agent trade (packages/agents), and market resolution cron (prediction_win)
- **Seed script**: `scripts/seed-achievements.ts` upserts all definitions with `onConflictDoUpdate`

### Frontend (apps/web)
- **New rewards UI** (`apps/web/src/components/rewards/rewards/`): 12 Figma-matched components
  - `TabNavigation`: 3-tab switcher (Overview, Achievements, Challenges)
  - `OverviewTab`: Daily streak card + daily challenges with live countdown
  - `AchievementsTab`: All 15 achievements with tier filter (All/Bronze/Silver/Gold), unlock stats, progress bars
  - `ChallengesTab`: Daily (3) + weekly (2) challenges, countdown timers, completion bonus dots, achievement preview
  - `DailyRewardsCard`: Streak counter, next reward, best streak, weekly goal progress, claim button with disabled/loading states
  - `AchievementCard`, `ChallengeCard`, `BonusCard`, `ChallengeSection`, `AchievementPreview`, `AchievementsStats`, `ProgressBar`
- **SSE real-time refresh**: All tabs subscribe to `notifications:{userId}` via `useSSEChannel` and auto-refresh on `achievement_unlocked`, `challenge_completed`, `challenge_bonus` events
- **Toast notifications**: `AchievementToastListener` in root layout shows toasts for all achievement/challenge events
- **Daily claim flow**: POST `/api/users/daily-login` with success toast showing points + streak
- **Rewards page cleanup**: Removed ~700 lines of dead code (old desktop/mobile views behind `{false &&}`), unused imports, and the old `AchievementTabs` component

### Tests
- **Achievement engine tests** (`packages/api/src/services/__tests__/achievement-engine.test.ts`): 24 tests covering checkProgress, getUserAchievements, getUserChallenges with mocked DB
- **Achievement definitions tests** (`packages/api/src/services/__tests__/achievement-service.test.ts`): 20 tests for definitions, rotation, challenge windowing
- **Rewards UI logic tests** (`apps/web/src/components/rewards/rewards/__tests__/rewards-tabs.test.ts`): 24 tests covering mapTier, mapStatus, formatCountdown, data mapping, SSE event filtering

## Review guide

**Start here**
- `packages/api/src/services/achievement-service.ts` — core engine
- `apps/web/src/components/rewards/rewards/overview-tab.tsx` — main UI entry point
- `apps/web/src/app/rewards/page.tsx` — cleaned-up page

**Risk**
- [ ] Low
- [x] Medium
- [ ] High

**Notes for reviewers**
- The achievement service uses fire-and-forget (`void checkProgress(...)`) — failures don't affect the triggering operation
- Challenge rotation is deterministic (SHA-256 of date string) — same user sees same challenges on a given day/week
- `successResponse()` returns raw data (no `{ data: ... }` wrapper), so frontend accesses `json.achievements` directly
- The old rewards page components behind `{false && (` blocks have been fully removed

## Test plan

**Commands run**
- [x] `bun run check` (Biome format)
- [x] `bun run typecheck`
- [x] `bun run test` (unit + integration)

**Manual verification**
1. Navigate to `/rewards` — should see 3-tab UI (Overview, Achievements, Challenges)
2. Overview tab: verify daily streak card shows real data, claim button works, daily challenges render with real progress
3. Achievements tab: verify 15 achievements display with correct tier badges, progress bars, and tier filtering
4. Challenges tab: verify 3 daily + 2 weekly challenges with countdown timers, completion bonuses, and achievement preview
5. Complete an action (e.g., create a post) and verify: toast notification appears via SSE, challenge progress updates on tab refresh
6. Claim daily reward: verify toast shows correct points, streak updates, button disables

## Ops / Migration / Deployment

- [ ] No deploy impact
- [x] Requires DB migration (`bun run db:migrate`) / backfill / seed

**DB / data migration**
- Migration: `0045` — creates `AchievementDefinition`, `ChallengeDefinition`, `UserAchievement`, `UserChallengeProgress` tables
- Seed: `bun run tsx scripts/seed-achievements.ts` — upserts 15 achievements + 40 challenges (idempotent, safe to re-run)

**Rollout / rollback plan**
- Rollout: Deploy, run migration, run seed script. Achievement tracking begins immediately via existing route handlers.
- Rollback: Revert deploy. Tables can remain (no data loss). Achievement progress stops tracking but resumes on re-deploy.

## Breaking changes

- [x] None

## Security / privacy

- [x] No security impact

All endpoints require authentication via `authenticateWithDbUser`. Progress is tracked per-user and only visible to the authenticated user.

<details>
<summary>Area-specific notes (expand if relevant)</summary>

### API / contracts between services
- `GET /api/achievements` — returns `{ achievements: AchievementWithProgress[] }` (15 items)
- `GET /api/challenges` — returns `{ daily: { challenges, allCompletedBonus, allCompleted, resetsAt }, weekly: { ... } }`
- SSE events: `achievement_unlocked`, `challenge_completed`, `challenge_bonus` on `notifications:{userId}` channel

### Database
- 4 new tables with proper indexes on userId, category, pool, and unique constraints on (userId, achievementId/challengeId + window)
- All queries in achievement service use existing indexed columns

</details>

## Screenshots / recordings (UI)

### Option A: Visual demo

| Feature | Description |
|---------|-------------|
| Overview Tab | Daily streak card with claim button, streak counter, weekly goal progress bar, daily challenges with countdown timer |
| Achievements Tab | 15 achievements with Bronze/Silver/Gold tier badges, tier filter buttons, unlock stats (X/15), progress bars for multi-step achievements |
| Challenges Tab | 3 daily + 2 weekly challenges with completion checkmarks, countdown timers, dot-based completion bonus indicators, achievement preview grid |
| SSE Toast | Real-time toast notifications when achievements unlock or challenges complete |

*Demo script (for recording):*
1. Open `/rewards` — show Overview tab with streak card and daily challenges
2. Switch to Achievements tab — show tier filtering and progress bars
3. Switch to Challenges tab — show daily/weekly sections with countdowns
4. Click "Claim" on daily reward — show success toast with points
5. Perform an action (create post) — show SSE toast and challenge progress update

## Checklist (author)
- [x] Self-review done (diff + critical paths)
- [x] Base branch is correct (`staging` by default)
- [x] Handlers remain thin and portable (validate → service → map errors)
- [x] Domain logic stays in packages (no Next/React/Elysia coupling in core)
- [x] Tests added/updated for behavior changes (or rationale provided)
- [x] **Screenshots/recordings section filled** (visual demo OR explanation why N/A)
