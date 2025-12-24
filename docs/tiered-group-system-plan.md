# Plan & Research: Tiered Group System

## 1. Goal Clarification

### What Exactly Needs to Be Built

A **tiered group system** that allows NPCs to manage multiple groups with different membership capacities, enabling scalable access to the ASYMMETRIC INFORMATION mechanic.

### Why This Is Needed

**Current Problem**:
- ~140 NPCs × 1 group each × 12 max members = **1,540 user slots**
- With 300,000 users, only **0.5%** can access NPC groups
- NPC groups contain the core game value (insider trading info)
- 99.5% of users miss the primary game mechanic

**Solution**:
- Each NPC can have **3 tiers** of groups with different sizes
- Tier 1 (Inner Circle): 12 members (exclusive, top engaged)
- Tier 2 (Community): 50 members (medium engaged)
- Tier 3 (Followers): 500 members (low barrier)
- **Total capacity**: 140 NPCs × 562 slots = **78,680 users (26%)**

### Success Criteria

1. **Capacity**: Support 78,680 users in NPC groups (52x improvement)
2. **Exclusivity**: Maintain value of Tier 1 groups (hardest to enter)
3. **Quality**: Tier 1 has best alpha, Tier 3 has general content
4. **Performance**: No degradation in tick processing time
5. **Migration**: Existing groups become Tier 1 without disruption

---

## 2. Constraints, Dependencies, and Edge Cases

### Constraints

#### Technical Constraints
- **Database**: Must use PostgreSQL with Drizzle ORM (current stack)
- **Tick Budget**: Game tick must complete in <180 seconds
- **Memory**: Node.js heap limit (~4GB in production)
- **LLM Calls**: Rate limited; can't generate 3x messages per tick

#### Business Constraints
- **User Limits**: Keep `MAX_ACTIVE_USER_GROUPS = 5` per user
- **Backward Compatibility**: Existing groups/memberships must work
- **No Data Loss**: All existing data must be preserved
- **Rollback**: Must be able to revert if issues arise

#### Design Constraints
- **Tier Quality Difference**: Each tier must have distinct value
- **Promotion Path**: Users should be able to "level up" between tiers
- **NPC Autonomy**: NPCs should still feel like they "own" their groups

### Dependencies

#### Existing Code Dependencies
```
packages/db/src/schema/messaging.ts
  └── chats, chatParticipants, groupChatMemberships tables

packages/engine/src/services/
  ├── npc-group-dynamics-service.ts (group formation, invites, messages)
  ├── alpha-group-invite-service.ts (engagement-based invites)
  ├── group-chat-service.ts (membership lifecycle)
  ├── npc-interaction-tracker.ts (engagement scoring)
  └── static-data-registry.ts (NPC data)

packages/api/src/services/
  └── nft-verification-service.ts (if NFT gating per tier)

apps/web/src/app/api/
  ├── chats/route.ts
  ├── chats/[id]/route.ts
  ├── chats/[id]/participants/route.ts
  └── groups/route.ts
```

#### External Dependencies
- **LLM Providers**: Groq, Claude, OpenAI for message generation
- **Redis**: For caching engagement scores
- **Database**: PostgreSQL (Neon in production)

### Edge Cases

#### 1. User Already in Higher Tier
```
User is in Tier 1 of "AIlon's Circle"
System tries to invite to Tier 2 of "AIlon's Community"
→ REJECT: User is already in a higher tier with this NPC
```

#### 2. User at Group Limit
```
User is in 5 groups (MAX_ACTIVE_USER_GROUPS)
System tries to invite to Tier 3
→ REJECT: User at group limit
→ ALTERNATIVE: Offer to demote from another group?
```

#### 3. Tier Demotion for Inactivity
```
User is in Tier 1 but hasn't engaged in 30 days
→ Demote to Tier 2 (keep access, lower privilege)
→ Tier 2 after 60 days → Demote to Tier 3
→ Tier 3 after 90 days → Remove entirely
```

#### 4. NPC Creates New Tier After Users Joined
```
AIlon only has Tier 1
User is in Tier 1
AIlon creates Tier 2 later
→ Existing Tier 1 members stay in Tier 1
→ New invites go to appropriate tier
```

#### 5. Concurrent Promotions
```
Two users qualify for promotion at same time
Tier 1 has 1 slot available
→ Use engagement score as tiebreaker
→ Higher score gets promoted
→ Other user waits for next slot
```

#### 6. Migration of Existing Groups
```
Existing group: "AIlon's Circle" (8 members)
→ Becomes Tier 1: "AIlon's Inner Circle"
→ All existing members stay
→ New Tier 2 and Tier 3 created empty
```

#### 7. NPC with No Relationships
```
NPC has no positive relationships
→ Cannot form Tier 1 group (needs 3+ NPCs)
→ Can still have Tier 2/3 for users
→ Tier 1 formation deferred until relationships exist
```

#### 8. Message Quality per Tier
```
Tier 1: Full insider info, specific positions, alpha
Tier 2: General trends, market sentiment, some alpha
Tier 3: Public-facing content, news, no insider info
→ LLM prompts must differentiate by tier
```

---

## 3. Research: Existing Patterns and APIs

### Current Engagement Scoring

From `NPCInteractionTracker.calculateEngagementScore()`:

```typescript
// Weights
REPLY_WEIGHT = 3.0;  // Replies most valuable
SHARE_WEIGHT = 2.0;  // Shares second
LIKE_WEIGHT = 1.0;   // Likes least

// Score calculation (0-100)
engagementScore = (
  (replyCount * REPLY_WEIGHT) +
  (likeCount * LIKE_WEIGHT) +
  (shareCount * SHARE_WEIGHT)
) * avgQualityScore * 10;
```

**Tier Thresholds (Proposed)**:
```typescript
TIER_1_THRESHOLD = 80;  // Top 5% engaged users
TIER_2_THRESHOLD = 50;  // Top 25% engaged users
TIER_3_THRESHOLD = 20;  // Top 60% engaged users
```

### Current Group Formation

From `NPCGroupDynamicsService.formNewGroups()`:

```typescript
// Current naming
const chatName = `${npc.name}'s Circle`;

// Current membership check (prevents duplicate groups)
const alreadyHasGroup = groups.some(g => g.name?.includes(npc.name));
```

**Change Required**: Check for tier-specific groups instead of name-based check.

### Current Invitation Services

**AlphaGroupInviteService**:
- 0.5% base chance for top 20 engaged users per NPC
- Creates groups named `${npcName}'s Alpha Group`
- One invite per NPC per tick

**GroupChatService.calculateInviteChance()**:
- Requires 24h+ follow duration
- Requires 5+ quality interactions
- Requires 75%+ average quality score
- Probability: 10-60%

**NPCGroupDynamicsService.inviteUsersToGroups()**:
- 8% chance per group with space
- Scores users by interactions + relationships
- Fills groups to MAX_GROUP_SIZE

### Database Schema Analysis

**Current `chats` Table**:
```typescript
{
  id: text,
  name: text,
  description: text,
  isGroup: boolean,
  createdBy: text,
  npcAdminId: text,  // ← Key field for NPC ownership
  gameId: text,
  // ... timestamps
}
```

**Missing**: `tier` field to identify group level.

**Current `groupChatMemberships` Table**:
```typescript
{
  id: text,
  userId: text,
  chatId: text,
  npcAdminId: text,
  joinedAt: timestamp,
  lastMessageAt: timestamp,
  messageCount: integer,
  qualityScore: doublePrecision,
  isActive: boolean,
  sweepReason: text,
  removedAt: timestamp,
}
```

**Missing**: No field for tier or promotion/demotion tracking.

### LLM Prompt Differentiation

From `packages/engine/src/prompts/game/group-message.ts`:

```typescript
// Current prompt (same for all groups)
template: `
This is PRIVATE - share STRATEGIC insider information:

WHAT TO SHARE (pick what's relevant):
✅ "Our Q3 numbers are terrible - not public yet"
✅ "Just went long $50k on [ticker] before news drops"
...
`
```

**Change Required**: Tier-specific prompts with different information levels.

---

## 4. Architecture and Data Flow

### 4.1 Database Schema Changes

#### Option A: Add `tier` to `chats` Table (Recommended)

```typescript
// packages/db/src/schema/messaging.ts

export const chats = pgTable(
  'Chat',
  {
    // ... existing fields
    
    // NEW: Tier information
    tier: integer('tier'),  // 1, 2, or 3 (null for user groups)
    tierName: text('tierName'),  // "Inner Circle", "Community", "Followers"
    maxMembers: integer('maxMembers'),  // Tier-specific limit
    parentGroupId: text('parentGroupId'),  // Links tiers to same NPC
  },
  (table) => [
    // ... existing indexes
    index('Chat_tier_idx').on(table.tier),
    index('Chat_npcAdminId_tier_idx').on(table.npcAdminId, table.tier),
    index('Chat_parentGroupId_idx').on(table.parentGroupId),
  ]
);
```

**Pros**: Simple, single source of truth, easy queries
**Cons**: Requires migration of existing groups

#### Option B: Separate `npcGroupTiers` Table

```typescript
export const npcGroupTiers = pgTable(
  'NPCGroupTier',
  {
    id: text('id').primaryKey(),
    npcId: text('npcId').notNull(),
    tier: integer('tier').notNull(),  // 1, 2, 3
    chatId: text('chatId').notNull(),  // Links to chats table
    tierName: text('tierName').notNull(),
    maxMembers: integer('maxMembers').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    unique('NPCGroupTier_npcId_tier_key').on(table.npcId, table.tier),
    index('NPCGroupTier_npcId_idx').on(table.npcId),
    index('NPCGroupTier_chatId_idx').on(table.chatId),
  ]
);
```

**Pros**: Cleaner separation, no migration of existing table
**Cons**: Extra join required, more complex queries

**Recommendation**: Option A (add to `chats` table) for simplicity.

### 4.2 Tier Configuration

```typescript
// packages/engine/src/services/tier-config.ts

export const TIER_CONFIG = {
  1: {
    name: 'Inner Circle',
    suffix: "'s Inner Circle",
    maxMembers: 12,
    minEngagementScore: 80,
    messageFrequency: 0.25,  // Same as current
    alphaLevel: 'full',  // Full insider info
    inviteProbability: 0.005,  // 0.5% per tick
    promotionWaitDays: 30,  // Days in Tier 2 before eligible
  },
  2: {
    name: 'Community',
    suffix: "'s Community",
    maxMembers: 50,
    minEngagementScore: 50,
    messageFrequency: 0.15,  // Less frequent
    alphaLevel: 'partial',  // Some insider info
    inviteProbability: 0.02,  // 2% per tick
    promotionWaitDays: 14,  // Days in Tier 3 before eligible
  },
  3: {
    name: 'Followers',
    suffix: "'s Followers",
    maxMembers: 500,
    minEngagementScore: 20,
    messageFrequency: 0.05,  // Least frequent
    alphaLevel: 'public',  // Public-facing only
    inviteProbability: 0.10,  // 10% per tick
    promotionWaitDays: 0,  // Immediate entry
  },
} as const;

export type TierLevel = keyof typeof TIER_CONFIG;
```

### 4.3 Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            GAME TICK                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TieredGroupService (NEW)                             │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Tier Formation  │  │ Tier Invitations│  │ Tier Messages   │          │
│  │                 │  │                 │  │                 │          │
│  │ • Create T1/T2/T3│  │ • Score users  │  │ • T1: Full alpha│          │
│  │ • Migrate exist │  │ • Route to tier │  │ • T2: Partial   │          │
│  │ • Balance NPCs  │  │ • Handle limits │  │ • T3: Public    │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Tier Promotion  │  │ Tier Demotion   │  │ Tier Analytics  │          │
│  │                 │  │                 │  │                 │          │
│  │ • T3 → T2       │  │ • Inactivity    │  │ • Capacity      │          │
│  │ • T2 → T1       │  │ • T1 → T2 → T3  │  │ • Engagement    │          │
│  │ • Slot mgmt     │  │ • Grace periods │  │ • Churn         │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           ┌────────────┐  ┌────────────┐  ┌────────────┐
           │ Existing   │  │ Existing   │  │ Existing   │
           │ GroupChat  │  │ AlphaGroup │  │ NPCGroup   │
           │ Service    │  │ InviteSvc  │  │ Dynamics   │
           └────────────┘  └────────────┘  └────────────┘
```

### 4.4 Data Flow: User Invitation to Tier

```
1. User engages with NPC posts (likes, replies, shares)
                    │
                    ▼
2. NPCInteractionTracker calculates engagement score (0-100)
                    │
                    ▼
3. TieredGroupService.processTickInvitations() runs
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
4a. Score ≥ 80    4b. Score 50-79  4c. Score 20-49
   Tier 1 queue      Tier 2 queue      Tier 3 queue
    │               │               │
    ▼               ▼               ▼
5. Check tier capacity
    │               │               │
    ├── Full ──────►│               │
    │               ├── Full ──────►│
    │               │               │
    ▼               ▼               ▼
6. Invite to appropriate tier
                    │
                    ▼
7. Create GroupChatMembership with tier metadata
                    │
                    ▼
8. Send notification: "AIlon invited you to their [Tier Name]"
```

### 4.5 Data Flow: Tier Promotion

```
1. User is in Tier 3 for 14+ days
                    │
                    ▼
2. TieredGroupService.processPromotions() runs daily
                    │
                    ▼
3. Recalculate engagement score
                    │
                    ▼
4. Score meets Tier 2 threshold (≥50)?
    │
    ├── No ────────► Stay in Tier 3
    │
    ▼
5. Tier 2 has available slot?
    │
    ├── No ────────► Add to promotion queue
    │
    ▼
6. Promote user:
   - Remove from Tier 3 chatParticipants
   - Add to Tier 2 chatParticipants
   - Update groupChatMemberships
   - Send notification: "You've been promoted to AIlon's Community!"
```

### 4.6 Data Flow: Message Generation by Tier

```
1. NPCGroupDynamicsService.postGroupMessages() runs
                    │
                    ▼
2. Get all NPC groups with tier info
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
3a. Tier 1        3b. Tier 2      3c. Tier 3
   25% chance        15% chance      5% chance
    │               │               │
    ▼               ▼               ▼
4. Select LLM prompt by tier:
   T1: group-message-tier1.ts (full alpha)
   T2: group-message-tier2.ts (partial alpha)
   T3: group-message-tier3.ts (public info)
    │               │               │
    ▼               ▼               ▼
5. Generate message with tier-appropriate content
    │               │               │
    ▼               ▼               ▼
6. Post to respective chat
```

---

## 5. Unknowns and Risks

### 5.1 Technical Risks

#### Risk: LLM Rate Limiting
**Description**: 3x more groups = potentially 3x more LLM calls per tick
**Probability**: High
**Impact**: Medium (tick timeout, reduced content)
**Mitigation**:
- Tier 3 groups post much less frequently (5% vs 25%)
- Tier 2 moderate (15%)
- Net increase: ~40% more LLM calls (not 3x)
- Batch tier messages in single LLM call where possible

#### Risk: Database Performance
**Description**: More groups = more rows, slower queries
**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Add indexes on tier, npcAdminId, tier combination
- Use connection pooling
- Cache engagement scores in Redis
- Archive old messages after 90 days

#### Risk: Migration Complexity
**Description**: Migrating existing groups to Tier 1 may cause issues
**Probability**: Medium
**Impact**: High (data loss or corruption)
**Mitigation**:
- Write migration that runs in transaction
- Backup before migration
- Test on staging first
- Rollback migration script ready

### 5.2 Product Risks

#### Risk: Tier 3 Feels Worthless
**Description**: Users in Tier 3 may not see value if content is too generic
**Probability**: Medium
**Impact**: High (user churn)
**Mitigation**:
- Tier 3 still gets some exclusive content (just not alpha)
- Clear promotion path shown in UI
- Gamification: "You're 15% away from Community tier!"
- Tier 3 members see blurred previews of higher tier messages

#### Risk: Tier 1 Exclusivity Diluted
**Description**: If Tier 1 is too easy to enter, loses value
**Probability**: Low
**Impact**: High (core mechanic compromised)
**Mitigation**:
- Keep Tier 1 at 12 members (same as current MAX_GROUP_SIZE)
- Strict engagement requirements (80+ score)
- Active sweep for inactive members
- Tier 1 messages are the "real" insider info

#### Risk: Promotion Spam
**Description**: Too many "You've been promoted!" notifications
**Probability**: Medium
**Impact**: Low (annoyance)
**Mitigation**:
- Batch promotions weekly
- "You've earned promotion to 3 new groups!" single notification
- User can mute promotion notifications

### 5.3 Operational Risks

#### Risk: Rollback Difficulty
**Description**: If system fails, reverting to single-tier is complex
**Probability**: Low
**Impact**: High
**Mitigation**:
- Keep `tier` field nullable (null = legacy behavior)
- Feature flag to disable tiered logic
- Original services remain as fallback
- Clear rollback migration script

#### Risk: Monitoring Gaps
**Description**: New metrics not captured, issues go unnoticed
**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Add tier-specific metrics to game tick results
- Dashboard for tier fill rates
- Alert if Tier 1 churn exceeds threshold
- Track promotion/demotion rates

---

## 6. Implementation Phases

### Phase 1: Schema and Infrastructure (Day 1-2)

#### Tasks:
1. Add `tier`, `tierName`, `maxMembers` to `chats` table
2. Add `tier`, `promotedAt`, `demotedAt` to `groupChatMemberships` table
3. Create migration script for existing groups (→ Tier 1)
4. Create rollback migration script
5. Add TIER_CONFIG constants
6. Add indexes for new fields

#### Deliverables:
- Migration files: `0008_add_tier_to_chats.sql`
- Rollback: `0009_rollback_tier_from_chats.sql`
- Config: `packages/engine/src/services/tier-config.ts`

### Phase 2: Core Service (Day 3-5)

#### Tasks:
1. Create `TieredGroupService` class
2. Implement `ensureAllTiersExist(npcId)` - creates missing tiers
3. Implement `getAvailableTierForUser(userId, npcId)` - finds best tier
4. Implement `inviteToTier(userId, npcId, tier)` - tier-aware invitation
5. Modify existing invitation services to use tiered logic
6. Update `NPCGroupDynamicsService.formNewGroups()` to create all tiers

#### Deliverables:
- `packages/engine/src/services/tiered-group-service.ts`
- Modified `npc-group-dynamics-service.ts`
- Modified `alpha-group-invite-service.ts`

### Phase 3: Promotion/Demotion (Day 6-7)

#### Tasks:
1. Implement `processPromotions()` - T3→T2→T1 based on engagement
2. Implement `processDemotions()` - inactivity-based downgrade
3. Add promotion wait period logic (14 days T3→T2, 30 days T2→T1)
4. Add demotion grace period logic (30 days inactive → demote)
5. Create notification templates for tier changes

#### Deliverables:
- Promotion/demotion logic in `TieredGroupService`
- Notification templates in `packages/shared`

### Phase 4: Message Differentiation (Day 8-9)

#### Tasks:
1. Create `group-message-tier1.ts` prompt (full alpha)
2. Create `group-message-tier2.ts` prompt (partial alpha)
3. Create `group-message-tier3.ts` prompt (public info)
4. Modify `postGroupMessages()` to select prompt by tier
5. Adjust message frequency per tier (25%, 15%, 5%)

#### Deliverables:
- Three new prompt files
- Modified message generation logic

### Phase 5: API and Frontend (Day 10-12)

#### Tasks:
1. Update `/api/chats` to return tier info
2. Update `/api/chats/[id]` to include tier badge
3. Add tier indicator in chat list UI
4. Add promotion progress bar in chat view
5. Add "upgrade path" explainer for lower tiers
6. Update group creation flow (admin can set tier if NPC)

#### Deliverables:
- API route changes
- Frontend components for tier display
- Promotion progress UI

### Phase 6: Testing and Monitoring (Day 13-14)

#### Tasks:
1. Unit tests for TieredGroupService
2. Integration tests for invitation flow
3. Integration tests for promotion/demotion
4. Add tier metrics to game tick results
5. Create monitoring dashboard
6. Load test with simulated 10K users

#### Deliverables:
- Test files in `packages/testing`
- Monitoring dashboard config
- Load test scripts

---

## 7. Clarifying Questions

Before proceeding, please confirm or clarify:

### 1. Tier Naming Convention
**Current proposal**:
- Tier 1: "[NPC Name]'s Inner Circle"
- Tier 2: "[NPC Name]'s Community"
- Tier 3: "[NPC Name]'s Followers"

**Question**: Are these names acceptable, or should we use different terminology?

### 2. Promotion Frequency
**Current proposal**: Check promotions once per day (not every tick)

**Question**: Is daily promotion checking acceptable, or should it be more/less frequent?

### 3. Demotion Policy
**Current proposal**:
- 30 days inactive in Tier 1 → Demote to Tier 2
- 60 days inactive in Tier 2 → Demote to Tier 3
- 90 days inactive in Tier 3 → Remove from group

**Question**: Are these timeframes appropriate? Should we notify before demotion?

### 4. Tier 3 Content Quality
**Current proposal**: Tier 3 gets public-facing content only (no alpha)

**Question**: Should Tier 3 get occasional "teasers" of alpha to encourage promotion?

### 5. Cross-NPC Tier Limits
**Current proposal**: User can be in 5 groups total (any tier, any NPC)

**Question**: Should we allow unlimited Tier 3 memberships to encourage exploration?

### 6. Migration Timing
**Current proposal**: Migrate all existing groups to Tier 1 at deploy time

**Question**: Should we do this gradually (e.g., 10% of groups per day)?

---

## 8. Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Schema & Infrastructure | 2 days | None |
| 2. Core Service | 3 days | Phase 1 |
| 3. Promotion/Demotion | 2 days | Phase 2 |
| 4. Message Differentiation | 2 days | Phase 2 |
| 5. API & Frontend | 3 days | Phases 2-4 |
| 6. Testing & Monitoring | 2 days | Phases 1-5 |

**Total: 14 days (2 weeks)**

Phases 3 and 4 can run in parallel after Phase 2 completion.

---

## 9. Decision Summary

### Recommended Decisions

1. **Schema**: Add `tier` column to `chats` table (Option A)
2. **Tier Sizes**: 12 / 50 / 500 members
3. **Engagement Thresholds**: 80 / 50 / 20 scores
4. **Message Frequency**: 25% / 15% / 5% per tick
5. **Promotion Wait**: 14 / 30 days
6. **Migration**: All existing groups → Tier 1

### Deferred Decisions (Need Clarification)

1. Exact tier names
2. Demotion warning notifications
3. Tier 3 alpha teasers
4. Cross-NPC tier limits
5. Gradual vs immediate migration

---

## 10. Appendix: Database Migration Scripts

### Migration: Add Tier Support

```sql
-- 0008_add_tier_to_chats.sql

-- Add tier columns to Chat table
ALTER TABLE "Chat" ADD COLUMN "tier" integer;
ALTER TABLE "Chat" ADD COLUMN "tierName" text;
ALTER TABLE "Chat" ADD COLUMN "maxMembers" integer;
ALTER TABLE "Chat" ADD COLUMN "parentGroupId" text;

-- Add tier columns to GroupChatMembership table
ALTER TABLE "GroupChatMembership" ADD COLUMN "tier" integer;
ALTER TABLE "GroupChatMembership" ADD COLUMN "promotedAt" timestamp;
ALTER TABLE "GroupChatMembership" ADD COLUMN "demotedAt" timestamp;
ALTER TABLE "GroupChatMembership" ADD COLUMN "previousTier" integer;

-- Add indexes
CREATE INDEX "Chat_tier_idx" ON "Chat" ("tier");
CREATE INDEX "Chat_npcAdminId_tier_idx" ON "Chat" ("npcAdminId", "tier");
CREATE INDEX "Chat_parentGroupId_idx" ON "Chat" ("parentGroupId");
CREATE INDEX "GroupChatMembership_tier_idx" ON "GroupChatMembership" ("tier");

-- Migrate existing NPC groups to Tier 1
UPDATE "Chat"
SET 
  "tier" = 1,
  "tierName" = 'Inner Circle',
  "maxMembers" = 12
WHERE "isGroup" = true 
  AND "npcAdminId" IS NOT NULL
  AND "tier" IS NULL;

-- Update existing memberships to Tier 1
UPDATE "GroupChatMembership"
SET "tier" = 1
WHERE "tier" IS NULL;
```

### Rollback: Remove Tier Support

```sql
-- 0009_rollback_tier_from_chats.sql

-- Drop indexes first
DROP INDEX IF EXISTS "GroupChatMembership_tier_idx";
DROP INDEX IF EXISTS "Chat_parentGroupId_idx";
DROP INDEX IF EXISTS "Chat_npcAdminId_tier_idx";
DROP INDEX IF EXISTS "Chat_tier_idx";

-- Remove tier columns from GroupChatMembership
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "previousTier";
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "demotedAt";
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "promotedAt";
ALTER TABLE "GroupChatMembership" DROP COLUMN IF EXISTS "tier";

-- Remove tier columns from Chat
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "parentGroupId";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "maxMembers";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "tierName";
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "tier";
```

---

**Ready for review. Please answer the clarifying questions in Section 7, and we can begin implementation.**

