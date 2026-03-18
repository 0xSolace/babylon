# BAB-286 Handoff — What's Built & What's Left

> Branch: `ui/win-loss`
> Do NOT merge to `production` until backend (Patrick/Luca) and trigger wiring (Brandon/BAB-285) are complete.

---

## What's Built (Frontend — Jasper)

### Tier 1: Win/Loss Pop-up

**Files:**
- `apps/web/src/components/notifications/OutcomeNotificationPopup.tsx` — win/loss pop-up with canvas confetti, animated counter, auto-dismiss
- `apps/web/src/components/providers/OutcomeNotificationProvider.tsx` — context provider with queue + batch support
- `apps/web/src/components/notifications/StackedSummaryPopup.tsx` — stacked summary ("X markets resolved while you were away")

**How to trigger:**
```ts
// Single notification
const { showOutcome } = useOutcomeNotification();
showOutcome({
  marketId: 'abc',
  marketName: 'Will ETH hit $5k?',
  outcome: 'win', // or 'loss'
  points: 1250,   // negative for loss
  agentName: 'Ares', // optional — omit if user held position directly
  deepLink: '/markets/abc',
});

// Batch (user was away, multiple resolved)
const { showBatchOutcomes } = useOutcomeNotification();
showBatchOutcomes([...notifications]);
// If 1 notification, shows single pop-up. If 2+, shows stacked summary.
```

**Provider location:** Wired into `apps/web/src/components/providers/Providers.tsx` inside `OutcomeNotificationProvider`.

### Tier 3: Feed Signal Cards

**File:** `apps/web/src/components/notifications/FeedSignalCards.tsx`

**Exported components:**
- `MarketClosingSoonCard` — props: `marketId`, `marketName`, `closesAt`, `positionSide`, `currentPrice`, `entryPrice`
- `TopGainerCard` — props: `marketId`, `marketName`, `pointsGained`, `gainPercent`, `agentName?`
- `TopLoserCard` — props: `marketId`, `marketName`, `pointsLost`, `lossPercent`, `agentName?`

Brandon (BAB-285) owns injection and placement into the feed. These are visual-only components ready to be used.

### Tier 2: Settings UI

**File:** `apps/web/src/components/settings/NotificationsTab.tsx`

- Performance digest toggle, frequency selector (hourly/daily/weekly), delivery channel (in-app/email/both)
- Added as "Notifications" tab in `apps/web/src/app/settings/page.tsx`
- Settings icon added to `/notifications` page header linking to `/settings?tab=notifications`
- State is local (`useState`) — needs backend API wiring

### CSS

- `apps/web/src/app/globals.css` — confetti burst keyframes (`confetti-burst-out`, `confetti-fall-gravity`, `confetti-fade`, `confetti-sway`, `confetti-3d-spin`, `confetti-wave-in`)

---

## What's Left

### Backend (Patrick / Luca)

1. **Market resolution event hook** — when a prediction market resolves, emit an event containing: `marketId`, `marketName`, `outcome` (win/loss), `points`, `agentName` (if agent held position), `deepLink`
2. **Digest scheduler** — hourly/daily/weekly digest generation with content: net points change, top performing agent, markets won/lost, brief narrative summary
3. **Notification settings API** — CRUD for user notification preferences (digest enabled, frequency, delivery channel)
4. **Queued notifications** — store undelivered notifications for users who were offline, deliver on next app open

### Frontend Trigger Wiring (Brandon / BAB-285)

1. **Wire market resolution events** to `showOutcome()` or `showBatchOutcomes()` — listen for SSE/websocket events and call the provider
2. **Feed signal card injection** — place `MarketClosingSoonCard`, `TopGainerCard`, `TopLoserCard` into the feed at appropriate positions
3. **Capping/dedup logic** — one gainer and one loser card per day, never repeat same market twice
4. **Queued notification delivery** — on app open, fetch queued notifications and call `showBatchOutcomes()` if multiple, or `showOutcome()` if single

### Settings Backend Wiring

1. Wire `NotificationsTab` state to backend API (save/load user preferences)
2. Default for new users: digest enabled, frequency = daily, channel = both

---

## Dev-Only Code to Remove Before Merging

These are test buttons and card previews used during development. Remove them before merging:

### 1. Test buttons file
- **Delete:** `apps/web/src/components/notifications/NotificationTestButtons.tsx`

### 2. Usage in FeedClient
- **File:** `apps/web/src/app/feed/FeedClient.tsx`
- **Remove import (line 10):**
  ```ts
  import { FeedSignalCardPreviews, NotificationTestButtons } from '@/components/notifications/NotificationTestButtons';
  ```
- **Remove these blocks:**
  ```tsx
  {/* DEV: Notification test buttons — remove before merging */}
  <NotificationTestButtons />

  {/* DEV: Feed signal card previews — remove before merging */}
  <FeedSignalCardPreviews />
  ```

---

## Other Changes in This Branch

- Removed `Wallet` icon from "Open Positions" title in `PositionsPreviewPanel.tsx`
- Matched "View Positions" button style to "View Full Portfolio" button in `PositionsPreviewPanel.tsx`
- Removed header titles/descriptions from Security, Privacy, API Keys, and Notifications settings tabs
- Removed block-level icons from Security, Privacy, and API Keys settings tabs
- Removed Active Session block from Security settings
- Removed Account Privacy & Deletion block from Security settings
- Added settings gear icon to `/notifications` page header
