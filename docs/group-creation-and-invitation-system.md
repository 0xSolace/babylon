# Group Creation & Invitation System

## Overview

Groups in Babylon are created through **two main pathways**:
1. **NPC-Initiated Groups** - NPCs form groups based on relationships
2. **User-Created Groups** - Players manually create groups

The invitation system operates through **three services** that work together to manage membership.

---

## Part 1: How Groups Are Created

### A. NPC-Initiated Group Formation

**Service**: `NPCGroupDynamicsService.formNewGroups()`

**Trigger**: Runs every game tick with **5% probability per NPC**

**Formation Criteria**:

```typescript
// 1. NPC doesn't already have a group
// 2. NPC has positive relationships (sentiment ≥ 0.5)
// 3. At least 3 members total (MIN_GROUP_SIZE)
// 4. Max 12 members (MAX_GROUP_SIZE)
// 5. Ideal size is 7 members
```

**Member Selection Algorithm**:

```typescript
// Step 1: Query actorRelationships table
const relationships = await db
  .select()
  .from(actorRelationships)
  .where(
    and(
      or(
        eq(actorRelationships.actor1Id, npc.id),
        eq(actorRelationships.actor2Id, npc.id)
      ),
      gte(actorRelationships.sentiment, 0.5) // Only positive relationships
    )
  )
  .limit(IDEAL_GROUP_SIZE - 1); // 6 members + creator = 7

// Step 2: Add NPC as founder
const memberIds = new Set([npc.id]);

// Step 3: Add related NPCs
for (const rel of relationships) {
  const memberId = rel.actor1Id === npc.id ? rel.actor2Id : rel.actor1Id;
  memberIds.add(memberId);
}

// Step 4: Create group if enough members
if (memberIds.size >= MIN_GROUP_SIZE) {
  const chatName = `${npc.name}'s Circle`;
  // Create chat in database...
}
```

**Group Naming**: `"[NPC Name]'s Circle"` (e.g., "AIlon's Circle")

**Example Flow**:
```
Tick 1234 → AIlon (5% chance) → ✅ Triggered
  → Check: AIlon has no existing group ✅
  → Query relationships: sentiment ≥ 0.5
    → Found: Joff Bezos (0.8), Zark Muckerberg (0.6), Sundar Pichigh (0.7)
  → Members: 4 total (AIlon + 3 friends) ✅
  → Create: "AIlon's Circle"
  → Add all 4 as chatParticipants
```

---

### B. User-Created Groups

**API**: `POST /api/groups`

**Frontend**: `CreateGroupModal.tsx`

**Creation Flow**:
```typescript
// 1. User selects members from their connections
const selectedUsers = ['user-123', 'user-456'];

// 2. User provides group name
const groupName = "Trading Alpha Group";

// 3. Optional: NFT gating (NEW in BAB-63)
const nftGated = true;
const requiredNftContractAddress = "0x1234...";

// 4. API creates chat + participants
await fetch('/api/groups', {
  method: 'POST',
  body: JSON.stringify({
    name: groupName,
    memberIds: selectedUsers,
    nftGated,
    requiredNftContractAddress,
    requiredNftChainId: 84532,
  }),
});
```

**Validation**:
- Group name required
- At least 1 member (creator is automatic)
- If NFT-gated: contract address + chain ID required

---

## Part 2: How Invitations Work

### Three Invitation Services

#### 1. **AlphaGroupInviteService** (Primary System)

**Purpose**: Invite highly engaged users to NPC groups

**Trigger**: Every game tick, processes all NPCs

**Probability**: **0.5% base chance** for top engaged users

**Eligibility Criteria**:

```typescript
// 1. Engagement Score ≥ 40 (out of 100)
// Calculated from:
//   - Replies to NPC posts
//   - Likes on NPC posts
//   - Shares of NPC posts
//   - Quality of interactions

// 2. Not already in a group with this NPC

// 3. User has < 5 active groups (MAX_ACTIVE_USER_GROUPS)

// 4. Not in cooldown (4 hours after last invite)

// 5. Top 20 engaged users per NPC
```

**Engagement Score Calculation**:

```typescript
// From NPCInteractionTracker
const score = {
  replies: replyCount * 10,        // High value
  likes: likeCount * 2,            // Medium value
  shares: shareCount * 5,          // High value
  quality: avgQualityScore * 20,   // Very high value
  recency: recentBonus,            // Recent activity bonus
};

const engagementScore = Math.min(100, 
  score.replies + score.likes + score.shares + score.quality + score.recency
);
```

**Example Flow**:
```
Tick 5678 → AlphaGroupInviteService runs
  → Process NPC: AIlon
    → Get top 20 engaged users
    → User "alice-123": engagement = 67
      → Check: Not in group with AIlon ✅
      → Check: Has 2 active groups (< 5) ✅
      → Check: Last invite was 6h ago (> 4h) ✅
      → Roll: 0.5% chance → ✅ Invite!
      → Create invite to "AIlon's Circle"
      → Send notification to alice-123
```

---

#### 2. **GroupChatService.calculateInviteChance()** (Follow-Based System)

**Purpose**: Invite users who follow NPCs and interact consistently

**Trigger**: Called by `ActorSocialActions` during social action processing

**Requirements** (ALL must be met):

```typescript
// 1. User is followed by the NPC
const followStatus = await db.followStatuses.findFirst({
  where: { userId, npcId, isActive: true }
});

// 2. Followed for 24+ hours
const hoursSinceFollow = (now - followStatus.followedAt) / (1000 * 60 * 60);
if (hoursSinceFollow < 24) return false;

// 3. 5+ quality interactions since follow
const interactions = await db.userInteractions.findMany({
  where: { userId, npcId, timestamp >= followStatus.followedAt }
});
if (interactions.length < 5) return false;

// 4. Average quality score ≥ 75%
const avgQuality = interactions.reduce((sum, i) => sum + i.qualityScore, 0) 
                   / interactions.length;
if (avgQuality < 0.75) return false;

// 5. Not already in a group with this NPC
```

**Probability Calculation**:

```typescript
// Base probability: 10%
// Max probability: 60%

const qualityFactor = avgQuality / 0.75; // How much above threshold
const engagementFactor = Math.min(interactions.length / 5, 1.5); // How many interactions

const baseProbability = 0.1 + (0.6 - 0.1) * (qualityFactor * 0.6 + engagementFactor * 0.4);

// Owned chat (70% weight) vs member chat (30% weight)
const finalProbability = baseProbability * (isOwned ? 0.7 : 0.3);
```

**Example Flow**:
```
User "bob-456" → Followed AIlon 48h ago
  → Has 8 interactions since follow
  → Average quality: 0.82 (82%)
  → Calculate probability:
    → qualityFactor = 0.82 / 0.75 = 1.09
    → engagementFactor = min(8 / 5, 1.5) = 1.5
    → baseProbability = 0.1 + 0.5 * (1.09 * 0.6 + 1.5 * 0.4) = 0.43
    → finalProbability = 0.43 * 0.7 = 0.30 (30% chance)
  → Roll: Random() = 0.25 → ✅ Invite!
```

---

#### 3. **NPCGroupDynamicsService.inviteUsersToGroups()** (Group-Based System)

**Purpose**: Fill existing groups with active users

**Trigger**: Every game tick, processes groups with space

**Probability**: **8% chance per group** (INVITE_USER_CHANCE)

**Selection Criteria**:

```typescript
// 1. Group has < 12 members (MAX_GROUP_SIZE)

// 2. 8% random chance triggers

// 3. Find active users:
//    - Users who have shares (active traders)
//    - Not already in this group
//    - Not NPCs

// 4. Score users based on interactions with NPCs in the group
```

**User Scoring Algorithm**:

```typescript
// For each potential user:
let score = 0;

// Base engagement with group NPCs
for (const npcId of groupNpcIds) {
  const interactions = await getUserInteractionsWithNPC(userId, npcId);
  
  score += interactions.replies * 3;      // Replies worth 3 points
  score += interactions.likes * 1;        // Likes worth 1 point
  score += interactions.shares * 2;       // Shares worth 2 points
  score += interactions.follows * 5;      // Follows worth 5 points
}

// Relationship modifier (friends/enemies of group members)
const { modifier } = await calculateRelationshipModifier(userId, groupNpcIds);
score *= modifier; // Can boost or reduce score

// Recent activity bonus
const recentPosts = await getRecentPosts(userId, 7); // Last 7 days
score += recentPosts.length * 2;

// Sort users by score, invite top scorer
```

**Relationship Modifier**:

```typescript
// Boost if user is friends with group members
const friendships = await db.actorRelationships.findMany({
  where: {
    userId,
    targetId: in(groupNpcIds),
    sentiment: gte(0.7) // Strong positive
  }
});
const friendBoost = friendships.length * 0.2; // +20% per friend

// Penalty if user is enemies with group members
const rivalries = await db.actorRelationships.findMany({
  where: {
    userId,
    targetId: in(groupNpcIds),
    sentiment: lte(-0.5) // Negative
  }
});
const enemyPenalty = rivalries.length * 0.3; // -30% per enemy

const modifier = 1 + friendBoost - enemyPenalty;
```

**Example Flow**:
```
Tick 9012 → Process group "AIlon's Circle"
  → Current members: 5 (< 12) ✅
  → Roll: 8% chance → ✅ Triggered
  → Get NPCs in group: [AIlon, Joff Bezos, Zark]
  → Find active users not in group
  → Score each user:
    
    User "charlie-789":
      → Interactions with AIlon: 10 replies, 5 likes = 35 points
      → Interactions with Joff: 3 replies, 2 likes = 11 points
      → Interactions with Zark: 1 reply, 1 like = 4 points
      → Total: 50 points
      → Friends with AIlon (+20%) → 60 points
      → Recent posts: 5 → +10 points = 70 points
    
    User "diana-012":
      → Interactions with AIlon: 5 replies, 10 likes = 25 points
      → Interactions with Joff: 0
      → Interactions with Zark: 2 replies = 6 points
      → Total: 31 points
      → No relationships → 31 points
      → Recent posts: 2 → +4 points = 35 points
  
  → Top scorer: charlie-789 (70 points)
  → Invite charlie-789 to "AIlon's Circle"
```

---

## Part 3: Do Groups Have Topics by Design?

### Current State: **Implicit Topics, Not Explicit**

Groups do **NOT** have a dedicated `topic` field in the database schema. However, topics emerge **implicitly** through:

#### 1. **Group Composition** (Implicit Topic)

```typescript
// Groups formed by relationship → implicit topic = shared interests
"AIlon's Circle" → Members: AIlon, Joff Bezos, Zark
  → Implicit topic: Tech CEOs, AI, Space, E-commerce
  → All have affiliations in tech sector
  → All have high-tier influence

"Crypto Maxis" → Members: Crypto-focused NPCs
  → Implicit topic: Cryptocurrency, DeFi, Web3
```

#### 2. **Conversation Themes** (Generated per Message Batch)

The LLM prompt includes **`conversationTheme`** for each message batch:

```xml
<!-- From group-messages.ts prompt -->
<response>
  <groups>
    <group>
      <groupId>group-id</groupId>
      <messages>...</messages>
      <conversationTheme>what this conversation is really about</conversationTheme>
      <buildsOnPrevious>what previous conversation this continues or "new thread"</buildsOnPrevious>
    </group>
  </groups>
</response>
```

**Example Themes**:
- "Coordinating short attack on BitcAIn"
- "Sharing insider info about TeslAI Q3 earnings"
- "Gossiping about Zark's failed product launch"
- "Planning market manipulation for FDA announcement"

**However**: These themes are **generated dynamically** per message batch, not stored as persistent group metadata.

#### 3. **Message Context** (Event-Driven Topics)

Messages reference specific events/questions:

```xml
<message>
  <actorId>ailon</actorId>
  <content>Between us, TeslAI's FSD is nowhere near ready. I'm shorting $100k.</content>
  <referencesEvent>TeslAI FSD Beta Release</referencesEvent>
</message>
```

Topics emerge from:
- Current world events
- Active prediction markets
- Recent price movements
- Resolved questions

---

### Proposed: **Explicit Topic System** (From Analysis Doc)

To improve conversation continuity, we could add:

```typescript
// NEW: Conversation threads table
interface ConversationThread {
  id: string;
  chatId: string;
  theme: string; // "TeslAI manipulation", "FDA insider info"
  startedAt: Date;
  lastMessageAt: Date;
  participants: string[];
  keyPoints: string[]; // "Agreed to coordinate short", "Shared Q3 numbers"
  resolved: boolean; // True when outcome happens
}

// NEW: Group metadata
interface GroupMetadata {
  chatId: string;
  primaryTopic: string; // "Tech CEOs", "Crypto", "Healthcare"
  focusAreas: string[]; // ["AI", "Space", "EVs"]
  activeThreads: ConversationThread[];
}
```

**Benefits**:
- NPCs can reference previous conversations
- "Remember when we discussed X?" continuity
- No repetitive topics
- Evolving relationships tracked over time

---

## Part 4: Complete Invitation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         GAME TICK                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │   NPCGroupDynamicsService.processTickDynamics()   │
        └─────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐   ┌─────────────────┐
│ Form Groups  │    │  Invite Users    │   │  Post Messages  │
│ (5% chance)  │    │  (8% chance)     │   │  (25% chance)   │
└──────────────┘    └──────────────────┘   └─────────────────┘
        │                     │
        │                     │
        ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│ Based on     │    │ Score users by:  │
│ Relationships│    │ - Interactions   │
│ (sentiment   │    │ - Relationships  │
│  ≥ 0.5)      │    │ - Recent posts   │
└──────────────┘    └──────────────────┘
        │                     │
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ AlphaGroupInviteService │
        │ (0.5% chance for top  │
        │  engaged users)       │
        └─────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ GroupChatService    │
        │ (Follow-based       │
        │  invites)           │
        └─────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ ActorSocialActions  │
        │ (Random social      │
        │  interactions)      │
        └─────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │   Send Notification │
        │   Add to Group      │
        │   Create Membership │
        └─────────────────────┘
```

---

## Part 5: Key Constraints & Limits

### User Limits
```typescript
MAX_ACTIVE_USER_GROUPS = 5;        // Max groups per user
INVITE_COOLDOWN_HOURS = 4;         // Time between invites
```

### Group Limits
```typescript
MIN_GROUP_SIZE = 3;                // Minimum members to form
MAX_GROUP_SIZE = 12;               // Maximum members
IDEAL_GROUP_SIZE = 7;              // Target size
```

### Probabilities
```typescript
FORM_NEW_GROUP_CHANCE = 0.05;      // 5% per NPC per tick
INVITE_USER_CHANCE = 0.08;         // 8% per group per tick
BASE_INVITE_CHANCE = 0.005;        // 0.5% for alpha invites
POST_MESSAGE_CHANCE = 0.25;        // 25% per group per tick
```

### Engagement Requirements
```typescript
MIN_FOLLOW_DURATION_HOURS = 24;    // Must be followed 24h+
MIN_REPLIES_SINCE_FOLLOW = 5;      // Need 5+ interactions
MIN_QUALITY_SCORE = 0.75;          // 75%+ quality threshold
MIN_ENGAGEMENT_SCORE = 40;         // 40/100 engagement score
```

---

## Part 6: Database Schema

```sql
-- Chats table (groups)
CREATE TABLE "Chat" (
  id TEXT PRIMARY KEY,
  name TEXT,
  isGroup BOOLEAN NOT NULL DEFAULT FALSE,
  createdBy TEXT,
  npcAdminId TEXT,
  gameId TEXT,
  
  -- NFT Gating (NEW)
  nftGated BOOLEAN NOT NULL DEFAULT FALSE,
  requiredNftContractAddress TEXT,
  requiredNftTokenId INTEGER,
  requiredNftChainId INTEGER,
  
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL
);

-- Chat participants (membership)
CREATE TABLE "ChatParticipant" (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  userId TEXT NOT NULL,
  FOREIGN KEY (chatId) REFERENCES "Chat"(id),
  FOREIGN KEY (userId) REFERENCES "User"(id)
);

-- Group chat memberships (extended metadata)
CREATE TABLE "GroupChatMembership" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  chatId TEXT NOT NULL,
  npcAdminId TEXT NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  joinedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  removedAt TIMESTAMP,
  sweepReason TEXT,
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (chatId) REFERENCES "Chat"(id)
);

-- User interactions (for scoring)
CREATE TABLE "UserInteraction" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  npcId TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  qualityScore DECIMAL(3,2) NOT NULL,
  wasInvitedToChat BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (userId) REFERENCES "User"(id)
);

-- Follow statuses (for follow-based invites)
CREATE TABLE "FollowStatus" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  npcId TEXT NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  followedAt TIMESTAMP NOT NULL,
  FOREIGN KEY (userId) REFERENCES "User"(id)
);
```

---

## Summary

### How Groups Are Created:
1. **NPCs form groups** based on positive relationships (sentiment ≥ 0.5)
2. **Users create groups** manually via UI
3. **5% chance per NPC per tick** to form a new group

### How Invitations Work:
1. **AlphaGroupInviteService**: Top engaged users (0.5% chance)
2. **GroupChatService**: Follow-based (24h+ follow, 5+ interactions, 75%+ quality)
3. **NPCGroupDynamicsService**: Fill groups (8% chance, scored by interactions)

### Do Groups Have Topics?
- **No explicit topic field** in database
- **Implicit topics** from member composition and relationships
- **Dynamic themes** generated per message batch by LLM
- **Proposed improvement**: Add conversation threading system

### Next Steps:
- Implement conversation threading (track themes over time)
- Add explicit topic/focus area metadata to groups
- Build "alpha score" system to show which groups have best insider info
- Create group discovery UI (trending groups, alpha leaderboard)

