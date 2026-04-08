/**
 * NPC tiered group SQL for `TieredGroupService`.
 *
 * **Why here:** Group/Chat/GroupMember/ChatParticipant reads and writes stay in
 * `@babylon/db` with **`asSystem`** where appropriate; tier rules and locks stay in engine.
 */

import { and, count, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { asSystem, type Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';

export type NpcTierGroupSliceRow = {
  id: string;
  tier: number | null;
  name: string;
  maxMembers: number | null;
  chatId: string | null;
  memberCount: number;
};

export async function fetchNpcTierGroupSlices(
  npcId: string
): Promise<NpcTierGroupSliceRow[]> {
  return asSystem(
    async (c) =>
      c
        .select({
          id: groups.id,
          tier: groups.tier,
          name: groups.name,
          maxMembers: groups.maxMembers,
          chatId: chats.id,
          memberCount: count(groupMembers.id),
        })
        .from(groups)
        .leftJoin(chats, eq(chats.groupId, groups.id))
        .leftJoin(
          groupMembers,
          and(
            eq(groupMembers.groupId, groups.id),
            eq(groupMembers.isActive, true)
          )
        )
        .where(
          and(
            eq(groups.ownerId, npcId),
            eq(groups.type, 'npc'),
            isNotNull(groups.tier)
          )
        )
        .groupBy(
          groups.id,
          groups.tier,
          groups.name,
          groups.maxMembers,
          chats.id
        ),
    'tiered-group-npc-slices'
  );
}

export async function fillNpcTierGroupsParentIdWhereNull(
  npcId: string,
  parentGroupId: string
): Promise<void> {
  await asSystem(async (c) => {
    await c
      .update(groups)
      .set({ parentGroupId })
      .where(
        and(
          eq(groups.ownerId, npcId),
          eq(groups.type, 'npc'),
          isNotNull(groups.tier),
          isNull(groups.parentGroupId)
        )
      );
  }, 'tiered-group-fill-parent');
}

export type NpcTierBootstrapRows = {
  group: typeof groups.$inferInsert;
  chat: typeof chats.$inferInsert;
  ownerMember: typeof groupMembers.$inferInsert;
  ownerParticipant: typeof chatParticipants.$inferInsert;
};

export async function insertNpcTierBootstrapBundle(
  rows: NpcTierBootstrapRows
): Promise<void> {
  await asSystem(async (c) => {
    await c.insert(groups).values(rows.group);
    await c.insert(chats).values(rows.chat);
    await c.insert(groupMembers).values(rows.ownerMember);
    await c.insert(chatParticipants).values(rows.ownerParticipant);
  }, 'tiered-group-bootstrap');
}

export type ActiveNpcTierMembershipRow = {
  groupId: string;
  tier: number | null;
  joinedAt: Date;
  lastMessageAt: Date | null;
  isGrandfathered: boolean;
  grandfatheredAt: Date | null;
};

export async function fetchActiveNpcTierMembership(
  userId: string,
  npcId: string
): Promise<ActiveNpcTierMembershipRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        groupId: groupMembers.groupId,
        tier: groupMembers.tier,
        joinedAt: groupMembers.joinedAt,
        lastMessageAt: groupMembers.lastMessageAt,
        isGrandfathered: groupMembers.isGrandfathered,
        grandfatheredAt: groupMembers.grandfatheredAt,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true),
          eq(groups.ownerId, npcId),
          eq(groups.type, 'npc'),
          isNotNull(groups.tier)
        )
      )
      .limit(1);
    return row;
  }, 'tiered-group-active-membership');
}

export async function findActiveNpcGroupMembershipId(
  userId: string,
  npcId: string
): Promise<{ id: string } | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true),
          eq(groups.ownerId, npcId),
          eq(groups.type, 'npc')
        )
      )
      .limit(1);
    return row;
  }, 'tiered-group-any-membership');
}

export async function countUserActiveNpcGroupMemberships(
  userId: string
): Promise<number> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true),
          eq(groups.type, 'npc')
        )
      );
    return Number(row?.count ?? 0);
  }, 'tiered-group-user-npc-count');
}

export async function fetchChatIdByGroupId(
  groupId: string
): Promise<string | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.groupId, groupId))
      .limit(1);
    return row?.id;
  }, 'tiered-group-chat-by-group');
}

export async function runTierInviteMemberTransaction(
  tx: Transaction,
  payload: {
    groupMember: typeof groupMembers.$inferInsert;
    chatParticipant?: typeof chatParticipants.$inferInsert;
  }
): Promise<void> {
  await tx.insert(groupMembers).values(payload.groupMember);
  if (payload.chatParticipant) {
    await tx.insert(chatParticipants).values(payload.chatParticipant);
  }
}

export type PromoteNpcTierTxParams = {
  currentGroupId: string;
  userId: string;
  higherTier: number;
  oldChatId: string | null;
  newMemberId: string;
  targetGroupId: string;
  npcId: string;
  currentTier: number;
  targetChatId: string | null;
  newParticipantId: string | null;
};

export async function runPromoteNpcTierTransaction(
  tx: Transaction,
  p: PromoteNpcTierTxParams
): Promise<void> {
  const kickReason = `Promoted to Tier ${p.higherTier}`;

  await tx
    .update(groupMembers)
    .set({
      isActive: false,
      kickReason,
      kickedAt: new Date(),
    })
    .where(
      and(
        eq(groupMembers.groupId, p.currentGroupId),
        eq(groupMembers.userId, p.userId)
      )
    );

  if (p.oldChatId) {
    await tx
      .update(chatParticipants)
      .set({ isActive: false })
      .where(
        and(
          eq(chatParticipants.chatId, p.oldChatId),
          eq(chatParticipants.userId, p.userId)
        )
      );
  }

  await tx.insert(groupMembers).values({
    id: p.newMemberId,
    groupId: p.targetGroupId,
    userId: p.userId,
    role: 'member',
    addedBy: p.npcId,
    tier: p.higherTier,
    previousTier: p.currentTier,
    promotedAt: new Date(),
  });

  if (p.targetChatId && p.newParticipantId) {
    await tx.insert(chatParticipants).values({
      id: p.newParticipantId,
      chatId: p.targetChatId,
      userId: p.userId,
      invitedBy: p.npcId,
    });
  }
}

export type DemoteNpcTierTxParams = {
  currentGroupId: string;
  userId: string;
  kickReason: string;
  oldChatId: string | null;
  lowerTier: number | null;
  fromTier: number;
  targetGroupId: string | null;
  targetChatId: string | null;
  newMemberId: string | null;
  newParticipantId: string | null;
};

export async function runDemoteNpcTierTransaction(
  tx: Transaction,
  p: DemoteNpcTierTxParams
): Promise<void> {
  await tx
    .update(groupMembers)
    .set({
      isActive: false,
      kickReason: p.kickReason,
      kickedAt: new Date(),
    })
    .where(
      and(
        eq(groupMembers.groupId, p.currentGroupId),
        eq(groupMembers.userId, p.userId)
      )
    );

  if (p.oldChatId) {
    await tx
      .update(chatParticipants)
      .set({ isActive: false })
      .where(
        and(
          eq(chatParticipants.chatId, p.oldChatId),
          eq(chatParticipants.userId, p.userId)
        )
      );
  }

  if (p.lowerTier && p.targetGroupId && p.newMemberId) {
    await tx.insert(groupMembers).values({
      id: p.newMemberId,
      groupId: p.targetGroupId,
      userId: p.userId,
      role: 'member',
      tier: p.lowerTier,
      previousTier: p.fromTier,
      demotedAt: new Date(),
    });

    if (p.targetChatId && p.newParticipantId) {
      await tx.insert(chatParticipants).values({
        id: p.newParticipantId,
        chatId: p.targetChatId,
        userId: p.userId,
      });
    }
  }
}

export type PromotableNpcMembershipRow = {
  userId: string;
  tier: number | null;
  npcId: string;
};

export async function listPromotableNpcTierMemberships(
  actorIds: string[]
): Promise<PromotableNpcMembershipRow[]> {
  if (actorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          userId: groupMembers.userId,
          tier: groupMembers.tier,
          npcId: groups.ownerId,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            inArray(groups.ownerId, actorIds),
            eq(groups.type, 'npc'),
            eq(groupMembers.isActive, true),
            isNotNull(groupMembers.tier),
            ne(groupMembers.tier, 1)
          )
        ),
    'tiered-group-promotable-list'
  );
}

export type DemotionNpcMembershipRow = {
  userId: string;
  groupId: string;
  tier: number | null;
  lastMessageAt: Date | null;
  joinedAt: Date;
  npcId: string;
};

export async function listNpcTierMembershipsForDemotionScan(
  actorIds: string[]
): Promise<DemotionNpcMembershipRow[]> {
  if (actorIds.length === 0) return [];
  return asSystem(
    async (c) =>
      c
        .select({
          userId: groupMembers.userId,
          groupId: groupMembers.groupId,
          tier: groupMembers.tier,
          lastMessageAt: groupMembers.lastMessageAt,
          joinedAt: groupMembers.joinedAt,
          npcId: groups.ownerId,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(
          and(
            inArray(groups.ownerId, actorIds),
            eq(groups.type, 'npc'),
            eq(groupMembers.isActive, true),
            isNotNull(groupMembers.tier)
          )
        ),
    'tiered-group-demotion-scan'
  );
}

export type GlobalNpcTierGroupCountRow = {
  groupId: string;
  ownerId: string;
  tier: number | null;
  maxMembers: number | null;
  memberCount: number;
};

export async function fetchGlobalNpcTierGroupCounts(): Promise<
  GlobalNpcTierGroupCountRow[]
> {
  return asSystem(
    async (c) =>
      c
        .select({
          groupId: groups.id,
          ownerId: groups.ownerId,
          tier: groups.tier,
          maxMembers: groups.maxMembers,
          memberCount: count(groupMembers.id),
        })
        .from(groups)
        .leftJoin(
          groupMembers,
          and(
            eq(groupMembers.groupId, groups.id),
            eq(groupMembers.isActive, true)
          )
        )
        .where(and(eq(groups.type, 'npc'), isNotNull(groups.tier)))
        .groupBy(groups.id, groups.ownerId, groups.tier, groups.maxMembers),
    'tiered-group-global-analytics'
  );
}
