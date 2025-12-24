# Group Creation at Scale: 300,000 Users Analysis

## Current System Parameters

### NPCs (Actors)
- **Total NPCs**: ~145 actors (based on actors array in `packages/engine/src/data/actors/index.ts`)
- **Active NPCs**: Excludes test actors (~140 active)

### Group Formation Probabilities
```typescript
FORM_NEW_GROUP_CHANCE = 0.05;  // 5% per NPC per tick
MIN_GROUP_SIZE = 3;
MAX_GROUP_SIZE = 12;
IDEAL_GROUP_SIZE = 7;
```

### Game Tick Frequency
- **Production**: 1 tick per minute (60 ticks/hour, 1,440 ticks/day)
- **Simulation**: Variable (can run faster for testing)

---

## Group Creation Rate Calculations

### Maximum Possible Groups (NPC-Created)

**Theoretical Maximum**:
- Each NPC can create **1 group** (named "[NPC Name]'s Circle")
- Maximum NPC-created groups: **~140 groups**

**Why Limited?**:
```typescript
// From formNewGroups() logic:
const alreadyHasGroup = groups.some(g => g.name?.includes(npc.name));
if (alreadyHasGroup) {
  continue; // Already has a group
}
```

Each NPC can only create ONE group with their name. Once created, they won't create another.

---

### Group Formation Timeline

**Expected Formation Rate**:

```
Per Tick:
  - 140 NPCs × 5% chance = 7 NPCs attempt to form groups
  - Of those, ~3-4 will meet criteria (relationships, size requirements)
  - Expected: 3-4 new groups per tick

Per Hour (60 ticks):
  - 3.5 groups/tick × 60 ticks = 210 group attempts
  - Actual: ~50-70 groups formed (accounting for failures)

Per Day (1,440 ticks):
  - Theoretical: 5,040 attempts
  - Actual: Saturates at ~140 groups (max capacity)
  - **Time to saturation: ~2-3 days**
```

**Formation Curve**:
```
Day 1: ~80 groups formed (57% of max)
Day 2: ~120 groups formed (86% of max)
Day 3: ~135 groups formed (96% of max)
Day 4+: ~140 groups (100% - fully saturated)
```

---

## User-Created Groups

**No Hard Limit**: Users can create unlimited groups via UI

**Realistic Estimates** (300,000 users):

### Scenario 1: Low Engagement (5% create groups)
```
300,000 × 5% = 15,000 user-created groups
Total groups: 140 (NPC) + 15,000 (user) = 15,140 groups
```

### Scenario 2: Medium Engagement (15% create groups)
```
300,000 × 15% = 45,000 user-created groups
Total groups: 140 (NPC) + 45,000 (user) = 45,140 groups
```

### Scenario 3: High Engagement (30% create groups)
```
300,000 × 30% = 90,000 user-created groups
Total groups: 140 (NPC) + 90,000 (user) = 90,140 groups
```

---

## Group Membership Distribution

### NPC Groups (140 groups)

**Average Members per Group**:
- Ideal: 7 members (NPCs + invited users)
- Max: 12 members
- Typical: 8-10 members (7 NPCs + 1-3 users)

**User Invitation Rate**:

```typescript
// Three invitation systems running per tick:

1. AlphaGroupInviteService:
   - 0.5% chance for top 20 engaged users per NPC
   - ~140 NPCs × 20 users × 0.5% = ~14 invites/tick
   - Per day: ~20,000 invites

2. GroupChatService (Follow-based):
   - Depends on follow relationships
   - Estimate: ~5-10 invites/tick
   - Per day: ~7,000-14,000 invites

3. NPCGroupDynamicsService (Fill groups):
   - 8% chance per group with space
   - ~140 groups × 8% = ~11 groups attempt/tick
   - Per day: ~15,000 invites

Total invitation rate: ~42,000-49,000 invites/day
```

**User Constraints**:
```typescript
MAX_ACTIVE_USER_GROUPS = 5;  // Users can be in max 5 groups
INVITE_COOLDOWN_HOURS = 4;   // 4 hours between invites
```

**Saturation Point**:
```
With 300,000 users and max 5 groups each:
  - Max user-group memberships: 1,500,000
  - NPC groups (140) with max 12 members each: 1,680 slots
  - Available for users: 1,680 - 140 (NPCs) = 1,540 user slots
  - Percentage of users in NPC groups: 1,540 / 300,000 = 0.5%
```

**Realistic Distribution**:
- Top 10% engaged users (30,000): ~80% will get invited to NPC groups
- Middle 40% (120,000): ~10% will get invited
- Bottom 50% (150,000): <1% will get invited

**NPC Group Membership**:
- ~24,000 users in NPC groups (8% of total)
- Average: 171 users per NPC group (24,000 / 140)
- But constrained by MAX_GROUP_SIZE = 12
- Actual: ~1,400 users in NPC groups (10 users × 140 groups)

---

## Database Impact

### Storage Requirements

**Chats Table**:
```sql
-- NPC groups: 140 rows
-- User groups (medium engagement): 45,000 rows
-- Total: ~45,140 rows
-- Size: ~45,140 × 1KB = ~45 MB
```

**ChatParticipants Table**:
```sql
-- NPC groups: 140 groups × 10 members = 1,400 rows
-- User groups: 45,000 groups × 5 members avg = 225,000 rows
-- Total: ~226,400 rows
-- Size: ~226,400 × 0.5KB = ~113 MB
```

**GroupChatMemberships Table**:
```sql
-- Tracks user memberships with metadata
-- Same as ChatParticipants: ~226,400 rows
-- Size: ~226,400 × 1KB = ~226 MB
```

**Messages Table** (most significant):
```sql
-- Assume 10 messages/day per active group
-- Active groups: ~10,000 (22% of total)
-- Messages/day: 10,000 × 10 = 100,000 messages/day
-- Messages/year: 36,500,000 messages
-- Size: ~36.5M × 2KB = ~73 GB/year
```

**Total Storage** (first year):
```
Chats: 45 MB
ChatParticipants: 113 MB
GroupChatMemberships: 226 MB
Messages: 73 GB
Total: ~73.4 GB
```

---

## Performance Considerations

### Tick Processing Time

**Current Operations per Tick**:
```
1. Form new groups: O(N) where N = # NPCs = 140
   - Time: ~50-100ms

2. Invite users: O(N × M) where N = groups, M = users
   - NPC groups: 140 groups × 20 users = 2,800 checks
   - Time: ~200-500ms

3. Post messages: O(N) where N = active groups
   - Active: ~140 NPC groups × 25% = 35 messages/tick
   - Time: ~500-1000ms (LLM calls)

Total tick time: ~750-1600ms (well under 60s budget)
```

**At Scale (45,000 total groups)**:
```
1. Form new groups: Same (only NPCs form)
   - Time: ~50-100ms

2. Invite users: Only processes NPC groups
   - Time: ~200-500ms (unchanged)

3. Post messages: Only NPC groups post via tick
   - Time: ~500-1000ms (unchanged)

User groups post via API (not tick):
   - Handled by real-time API endpoints
   - No impact on tick performance

Total tick time: ~750-1600ms (unchanged)
```

**Conclusion**: User-created groups don't impact tick performance because:
- Only NPC groups participate in tick-based dynamics
- User groups are passive (no automatic message generation)
- User messages go through API routes, not game tick

---

## Scalability Issues & Solutions

### Issue 1: NPC Group Invitation Saturation

**Problem**: Only 1,400 users can be in NPC groups (140 groups × 10 users)

**Solutions**:

#### Option A: Increase MAX_GROUP_SIZE
```typescript
MAX_GROUP_SIZE = 50;  // Up from 12

Result:
  - 140 groups × 50 = 7,000 user slots
  - 2.3% of 300k users can join
  - Still limited but 5x improvement
```

**Pros**: Simple change
**Cons**: Large groups may feel less exclusive, harder to moderate

#### Option B: Dynamic Group Creation
```typescript
// Allow NPCs to create multiple groups based on demand
MAX_GROUPS_PER_NPC = 5;  // Up from 1

Result:
  - 140 NPCs × 5 groups × 12 members = 8,400 user slots
  - Groups: "AIlon's Circle", "AIlon's Inner Circle", "AIlon's Alpha Group", etc.
```

**Pros**: More groups, maintains exclusivity
**Cons**: Requires naming logic, more complex

#### Option C: Tiered Group System
```typescript
// Create hierarchy of groups
TIER_1: "AIlon's Circle" (12 members, top engaged)
TIER_2: "AIlon's Community" (50 members, medium engaged)
TIER_3: "AIlon's Followers" (500 members, low engaged)

Result:
  - 140 NPCs × 562 total slots = 78,680 user slots
  - 26% of 300k users can join
```

**Pros**: Scales well, maintains exclusivity for top tier
**Cons**: More complex, requires tier management

---

### Issue 2: Message Volume

**Problem**: 100,000 messages/day = 73 GB/year storage

**Solutions**:

#### Option A: Message Archival
```typescript
// Archive messages older than 90 days
ARCHIVE_AFTER_DAYS = 90;

Result:
  - Active messages: ~9M (90 days)
  - Archived: Cold storage (S3/Glacier)
  - Active DB size: ~18 GB (vs 73 GB)
```

#### Option B: Message Pruning
```typescript
// Keep only last N messages per chat
MAX_MESSAGES_PER_CHAT = 1000;

Result:
  - 45,000 groups × 1,000 messages = 45M messages
  - Size: ~90 GB total (stable)
```

#### Option C: Compression
```typescript
// Compress old messages (>30 days)
COMPRESS_AFTER_DAYS = 30;

Result:
  - 70% compression ratio
  - Size: ~22 GB (vs 73 GB)
```

---

### Issue 3: Invitation Spam

**Problem**: 42,000-49,000 invites/day may overwhelm users

**Solutions**:

#### Option A: Reduce Invitation Rate
```typescript
// Lower probabilities
ALPHA_INVITE_CHANCE = 0.001;  // Down from 0.005 (0.5%)
INVITE_USER_CHANCE = 0.04;    // Down from 0.08 (8%)

Result:
  - ~10,000-15,000 invites/day (70% reduction)
```

#### Option B: Smart Throttling
```typescript
// Only invite users who are active
REQUIRE_RECENT_ACTIVITY = true;  // Active in last 7 days
ACTIVITY_THRESHOLD = 5;          // Min 5 actions/week

Result:
  - Only ~10% of users eligible (30,000)
  - Invites: ~4,000-5,000/day
```

#### Option C: Invitation Quotas
```typescript
// Limit invites per user per week
MAX_INVITES_PER_USER_PER_WEEK = 2;

Result:
  - Users can only receive 2 invites/week
  - Natural rate limiting
```

---

## Recommended Configuration for 300K Users

### Phase 1: Launch (0-10K users)
```typescript
// Keep current settings
MAX_GROUP_SIZE = 12;
MAX_GROUPS_PER_NPC = 1;
ALPHA_INVITE_CHANCE = 0.005;
INVITE_USER_CHANCE = 0.08;
```

**Expected**:
- 140 NPC groups
- 1,400 users in NPC groups
- ~500-1,000 user-created groups
- Manageable scale

---

### Phase 2: Growth (10K-100K users)
```typescript
// Increase capacity
MAX_GROUP_SIZE = 25;              // 2x capacity
MAX_GROUPS_PER_NPC = 2;           // 2x groups
ALPHA_INVITE_CHANCE = 0.003;      // Reduce spam
INVITE_USER_CHANCE = 0.05;        // Reduce spam
REQUIRE_RECENT_ACTIVITY = true;   // Quality filter
```

**Expected**:
- 280 NPC groups (140 NPCs × 2)
- 7,000 users in NPC groups (280 × 25)
- ~5,000-10,000 user-created groups
- Moderate scale

---

### Phase 3: Scale (100K-300K users)
```typescript
// Tiered system
TIER_1_SIZE = 12;                 // Exclusive
TIER_2_SIZE = 50;                 // Community
TIER_3_SIZE = 500;                // Followers
MAX_GROUPS_PER_NPC = 3;           // One per tier
ALPHA_INVITE_CHANCE = 0.001;      // Highly selective
INVITE_USER_CHANCE = 0.02;        // Highly selective
MAX_INVITES_PER_USER_PER_WEEK = 2; // Rate limit
```

**Expected**:
- 420 NPC groups (140 NPCs × 3 tiers)
- 78,680 users in NPC groups (26% of 300k)
- ~30,000-50,000 user-created groups
- Full scale

---

## Summary

### Current System (300K users)
- **NPC Groups**: ~140 (saturates in 2-3 days)
- **User Groups**: 15,000-90,000 (depends on engagement)
- **Total Groups**: 15,140-90,140
- **Users in NPC Groups**: ~1,400 (0.5% of total) ⚠️ **BOTTLENECK**
- **Storage**: ~73 GB/year
- **Tick Performance**: ✅ Unaffected by user groups

### Key Bottleneck
**Only 0.5% of users can join NPC groups** due to:
- MAX_GROUP_SIZE = 12
- MAX_GROUPS_PER_NPC = 1
- Limited NPC count (140)

### Recommended Solutions (Priority Order)
1. **Implement tiered group system** (26% coverage)
2. **Add message archival** (75% storage savings)
3. **Smart invitation throttling** (reduce spam by 70%)
4. **Dynamic group creation** (5x capacity)

### Action Items
1. Monitor group creation rate in production
2. Implement tiered system before hitting 10K users
3. Add message archival at 100K messages
4. Adjust invitation probabilities based on user feedback

