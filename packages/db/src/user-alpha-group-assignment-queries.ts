/**
 * Reads and transactional writes for `UserAlphaGroupAssignmentService`.
 *
 * **Why here:** signup-time alpha group SQL uses **`asSystem`** / **`Transaction`**;
 * prioritization, static registry, and tier bootstrap stay in engine.
 */

import { and, count, eq, isNotNull } from 'drizzle-orm';
import { asSystem, type Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { follows } from './tables/follows';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { users } from './tables/user';

export type AlphaAssignmentUserEligibilityRow = {
  id: string;
  isActor: boolean | null;
  isAgent: boolean | null;
  isBanned: boolean | null;
};

export async function fetchUserEligibilityForAlphaAssignment(
  userId: string
): Promise<AlphaAssignmentUserEligibilityRow | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: users.id,
        isActor: users.isActor,
        isAgent: users.isAgent,
        isBanned: users.isBanned,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row;
  }, 'alpha-assign-user-eligibility');
}

export async function listFollowedActorIdsForUser(
  userId: string,
  limit: number
): Promise<string[]> {
  return asSystem(async (c) => {
    const rows = await c
      .select({ followingId: follows.followingId })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(and(eq(follows.followerId, userId), eq(users.isActor, true)))
      .limit(limit);
    return rows.map((r) => r.followingId);
  }, 'alpha-assign-followed-actors');
}

export async function listNpcOwnerIdsForUserActiveGroups(
  userId: string
): Promise<string[]> {
  return asSystem(async (c) => {
    const rows = await c
      .select({ ownerId: groups.ownerId })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true),
          eq(groups.type, 'npc')
        )
      );
    return rows.map((r) => r.ownerId);
  }, 'alpha-assign-existing-npc-owners');
}

export type Tier3GroupAssignmentSliceRow = {
  groupId: string;
  npcId: string;
  maxMembers: number | null;
  chatId: string | null;
  memberCount: number;
};

export async function listTier3NpcGroupsWithChatAndMemberCounts(): Promise<
  Tier3GroupAssignmentSliceRow[]
> {
  return asSystem(
    async (c) =>
      c
        .select({
          groupId: groups.id,
          npcId: groups.ownerId,
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
          and(eq(groups.type, 'npc'), eq(groups.tier, 3), isNotNull(chats.id))
        )
        .groupBy(groups.id, groups.ownerId, groups.maxMembers, chats.id),
    'alpha-assign-tier3-slices'
  );
}

export async function findGroupMemberRowForUserInGroup(
  groupId: string,
  userId: string
): Promise<{ id: string; isActive: boolean } | undefined> {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ id: groupMembers.id, isActive: groupMembers.isActive })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
      )
      .limit(1);
    return row;
  }, 'alpha-assign-member-lookup');
}

export async function countActiveMembersInGroupTx(
  tx: Transaction,
  groupId: string
): Promise<number> {
  const [row] = await tx
    .select({ count: count() })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.isActive, true))
    );
  return Number(row?.count ?? 0);
}

export async function reactivateTier3MemberAndUpsertChatParticipantTx(
  tx: Transaction,
  params: {
    memberRowId: string;
    participantId: string;
    chatId: string;
    userId: string;
    npcId: string;
    joinedAt: Date;
  }
): Promise<void> {
  await tx
    .update(groupMembers)
    .set({
      isActive: true,
      joinedAt: params.joinedAt,
      kickedAt: null,
      kickReason: null,
      tier: 3,
    })
    .where(eq(groupMembers.id, params.memberRowId));

  await tx
    .insert(chatParticipants)
    .values({
      id: params.participantId,
      chatId: params.chatId,
      userId: params.userId,
      invitedBy: params.npcId,
      isActive: true,
      joinedAt: params.joinedAt,
    })
    .onConflictDoUpdate({
      target: [chatParticipants.chatId, chatParticipants.userId],
      set: {
        isActive: true,
        joinedAt: params.joinedAt,
      },
    });
}

export async function insertTier3MemberAndParticipantIfCapacityTx(
  tx: Transaction,
  params: {
    groupId: string;
    maxMembers: number;
    memberId: string;
    userId: string;
    npcId: string;
    participantId: string;
    chatId: string;
    joinedAt: Date;
  }
): Promise<void> {
  const memberCount = await countActiveMembersInGroupTx(tx, params.groupId);
  if (memberCount >= params.maxMembers) {
    throw new Error('GROUP_FULL');
  }

  await tx.insert(groupMembers).values({
    id: params.memberId,
    groupId: params.groupId,
    userId: params.userId,
    role: 'member',
    addedBy: params.npcId,
    tier: 3,
    isActive: true,
    joinedAt: params.joinedAt,
    messageCount: 0,
    qualityScore: 1.0,
  });

  await tx.insert(chatParticipants).values({
    id: params.participantId,
    chatId: params.chatId,
    userId: params.userId,
    invitedBy: params.npcId,
    isActive: true,
    joinedAt: params.joinedAt,
  });
}

export type Tier3CapacityStatRow = {
  groupId: string;
  maxMembers: number | null;
  memberCount: number;
};

export async function listTier3GroupCapacityStats(): Promise<
  Tier3CapacityStatRow[]
> {
  return asSystem(
    async (c) =>
      c
        .select({
          groupId: groups.id,
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
        .where(and(eq(groups.type, 'npc'), eq(groups.tier, 3)))
        .groupBy(groups.id, groups.maxMembers),
    'alpha-assign-capacity-stats'
  );
}
