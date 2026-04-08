/**
 * Reads and writes for `NPCGroupDynamicsService` (group discovery, reply-guy scoring,
 * invite/kick/post flows). All SQL runs under **`asSystem`** (one transaction per call).
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { asSystem } from './db';
import { actorRelationships } from './tables/actor-relationships';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { follows } from './tables/follows';
import { groupInvites } from './tables/group-invites';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { poolPositions } from './tables/pool-positions';
import { posts } from './tables/posts';
import { reactions } from './tables/reactions';
import { shares } from './tables/shares';
import { users } from './tables/user';
import { userInteractions } from './tables/user-interactions';

export type NpcDynamicsChatRow = typeof chats.$inferSelect;
export type NpcDynamicsChatParticipantRow =
  typeof chatParticipants.$inferSelect;
export type NpcDynamicsMessageRow = typeof messages.$inferSelect;
export type NpcDynamicsActorRelationshipRow =
  typeof actorRelationships.$inferSelect;

export type NpcDynamicsGroupChatWithTier = {
  id: string;
  name: string | null;
  groupId: string | null;
  tier: number | null;
};

export type NpcDynamicsKickGroupRow = {
  id: string;
  name: string | null;
  groupId: string | null;
};

export async function listAllGroupChatsWhereIsGroupTrueAsSystem() {
  return asSystem(
    async (c) => c.select().from(chats).where(eq(chats.isGroup, true)),
    'npc-dyn-list-group-chats'
  );
}

export async function countGroupChatsWhereIsGroupTrueAsSystem() {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(chats)
      .where(eq(chats.isGroup, true));
    return row?.count ?? 0;
  }, 'npc-dyn-count-group-chats');
}

export async function countChatParticipantsForChatIdAsSystem(chatId: string) {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(chatParticipants)
      .where(eq(chatParticipants.chatId, chatId));
    return row?.count ?? 0;
  }, 'npc-dyn-count-chat-participants');
}

export async function listChatParticipantUserIdsByChatIdAsSystem(
  chatId: string
) {
  return asSystem(
    async (c) =>
      c
        .select({ userId: chatParticipants.userId })
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, chatId)),
    'npc-dyn-chat-participant-user-ids'
  );
}

export async function listActiveChatParticipantUserIdsByChatIdAsSystem(
  chatId: string
) {
  return asSystem(
    async (c) =>
      c
        .select({ userId: chatParticipants.userId })
        .from(chatParticipants)
        .where(
          and(
            eq(chatParticipants.chatId, chatId),
            eq(chatParticipants.isActive, true)
          )
        ),
    'npc-dyn-active-chat-participant-ids'
  );
}

export async function listChatParticipantsByChatIdAsSystem(chatId: string) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(chatParticipants)
        .where(eq(chatParticipants.chatId, chatId)),
    'npc-dyn-chat-participants'
  );
}

export async function fetchChatParticipantIdActiveByChatAndUserAsSystem(
  chatId: string,
  userId: string
) {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: chatParticipants.id,
        isActive: chatParticipants.isActive,
      })
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.chatId, chatId),
          eq(chatParticipants.userId, userId)
        )
      )
      .limit(1);
    return row;
  }, 'npc-dyn-chat-participant-by-chat-user');
}

export async function listGroupChatsWithTierJoinLimitedAsSystem(limit: number) {
  return asSystem(
    async (c) =>
      c
        .select({
          id: chats.id,
          name: chats.name,
          groupId: chats.groupId,
          tier: groups.tier,
        })
        .from(chats)
        .leftJoin(groups, eq(groups.id, chats.groupId))
        .where(eq(chats.isGroup, true))
        .limit(limit),
    'npc-dyn-group-chats-tier'
  );
}

export async function listRecentMessagesByChatOrderDescLimitAsSystem(
  chatId: string,
  limit: number
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(desc(messages.createdAt))
        .limit(limit),
    'npc-dyn-recent-messages'
  );
}

export async function listMessageSendersForChatSinceAsSystem(
  chatId: string,
  since: Date
) {
  return asSystem(
    async (c) =>
      c
        .select({ senderId: messages.senderId })
        .from(messages)
        .where(
          and(eq(messages.chatId, chatId), gte(messages.createdAt, since))
        ),
    'npc-dyn-msg-senders-since'
  );
}

export async function listUserDisplayNamesByIdsAsSystem(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({
          id: users.id,
          displayName: users.displayName,
        })
        .from(users)
        .where(inArray(users.id, userIds)),
    'npc-dyn-user-display-names'
  );
}

export async function listNonActorUsersByIdsForKickAsSystem(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({
          id: users.id,
          displayName: users.displayName,
          isActor: users.isActor,
          isAgent: users.isAgent,
        })
        .from(users)
        .where(and(inArray(users.id, userIds), eq(users.isActor, false))),
    'npc-dyn-non-actor-users'
  );
}

export async function listPoolPositionsByPoolIdLimitAsSystem(
  poolId: string,
  limit: number
) {
  return asSystem(
    async (c) =>
      c
        .select()
        .from(poolPositions)
        .where(eq(poolPositions.poolId, poolId))
        .limit(limit),
    'npc-dyn-pool-positions'
  );
}

export async function countFollowsFromUserToNpcIdsAsSystem(
  userId: string,
  npcIds: string[]
) {
  if (npcIds.length === 0) {
    return 0;
  }
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, userId),
          inArray(follows.followingId, npcIds)
        )
      );
    return row?.count ?? 0;
  }, 'npc-dyn-follow-count');
}

export async function listPostIdsByAuthorIdsAsSystem(authorIds: string[]) {
  if (authorIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select({ id: posts.id })
        .from(posts)
        .where(inArray(posts.authorId, authorIds)),
    'npc-dyn-npc-post-ids'
  );
}

export async function countUserCommentsOnParentPostsSinceAsSystem(
  userId: string,
  parentPostIds: string[],
  since: Date
) {
  if (parentPostIds.length === 0) {
    return 0;
  }
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(posts)
      .where(
        and(
          eq(posts.authorId, userId),
          inArray(posts.commentOnPostId, parentPostIds),
          gte(posts.createdAt, since)
        )
      );
    return row?.count ?? 0;
  }, 'npc-dyn-comment-count');
}

export async function countLikesOnPostsSinceAsSystem(
  userId: string,
  postIds: string[],
  since: Date
) {
  if (postIds.length === 0) {
    return 0;
  }
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(reactions)
      .where(
        and(
          eq(reactions.userId, userId),
          eq(reactions.type, 'like'),
          inArray(reactions.postId, postIds),
          gte(reactions.createdAt, since)
        )
      );
    return row?.count ?? 0;
  }, 'npc-dyn-like-count');
}

export async function countSharesOnPostsSinceAsSystem(
  userId: string,
  postIds: string[],
  since: Date
) {
  if (postIds.length === 0) {
    return 0;
  }
  return asSystem(async (c) => {
    const [row] = await c
      .select({ count: count() })
      .from(shares)
      .where(
        and(
          eq(shares.userId, userId),
          inArray(shares.postId, postIds),
          gte(shares.createdAt, since)
        )
      );
    return row?.count ?? 0;
  }, 'npc-dyn-share-count');
}

export async function listDistinctNpcIdsFromUserInteractionsSinceAsSystem(
  userId: string,
  since: Date
) {
  return asSystem(async (c) => {
    const rows = await c
      .select({ npcId: userInteractions.npcId })
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, userId),
          gte(userInteractions.timestamp, since)
        )
      );
    return [...new Set(rows.map((r) => r.npcId))];
  }, 'npc-dyn-user-interaction-npcs');
}

export async function listActorRelationshipsTargetVsEngagedNpcsAsSystem(
  targetNpcId: string,
  engagedNpcIds: string[]
) {
  if (engagedNpcIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          or(
            and(
              eq(actorRelationships.actor1Id, targetNpcId),
              inArray(actorRelationships.actor2Id, engagedNpcIds)
            ),
            and(
              eq(actorRelationships.actor2Id, targetNpcId),
              inArray(actorRelationships.actor1Id, engagedNpcIds)
            )
          )
        ),
    'npc-dyn-rel-target-engaged'
  );
}

export async function listPositiveActorRelationshipsForCandidateInGroupAsSystem(
  candidateId: string,
  memberIds: string[],
  minSentiment: number
) {
  if (memberIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          and(
            or(
              and(
                eq(actorRelationships.actor1Id, candidateId),
                inArray(actorRelationships.actor2Id, memberIds)
              ),
              and(
                eq(actorRelationships.actor2Id, candidateId),
                inArray(actorRelationships.actor1Id, memberIds)
              )
            ),
            gte(actorRelationships.sentiment, minSentiment)
          )
        ),
    'npc-dyn-rel-join-positive'
  );
}

export async function listNegativeActorRelationshipsForMemberVsOthersAsSystem(
  memberUserId: string,
  otherMemberIds: string[],
  maxSentiment: number
) {
  if (otherMemberIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(actorRelationships)
        .where(
          and(
            or(
              and(
                eq(actorRelationships.actor1Id, memberUserId),
                inArray(actorRelationships.actor2Id, otherMemberIds)
              ),
              and(
                eq(actorRelationships.actor2Id, memberUserId),
                inArray(actorRelationships.actor1Id, otherMemberIds)
              )
            ),
            lt(actorRelationships.sentiment, maxSentiment)
          )
        ),
    'npc-dyn-rel-leave-negative'
  );
}

export async function listNpcManagedGroupChatsForKickAsSystem() {
  return asSystem(
    async (c) =>
      c
        .select({
          id: chats.id,
          name: chats.name,
          groupId: chats.groupId,
        })
        .from(chats)
        .innerJoin(groups, eq(chats.groupId, groups.id))
        .where(and(eq(chats.isGroup, true), eq(groups.type, 'npc'))),
    'npc-dyn-kick-group-list'
  );
}

export async function countActiveNpcGroupMembershipsForUserAsSystem(
  userId: string
) {
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
    return row?.count ?? 0;
  }, 'npc-dyn-npc-group-count');
}

export async function fetchLatestNpcActiveGroupMembershipJoinedAtAsSystem(
  userId: string
) {
  return asSystem(async (c) => {
    const [row] = await c
      .select({ joinedAt: groupMembers.joinedAt })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true),
          eq(groups.type, 'npc')
        )
      )
      .orderBy(desc(groupMembers.joinedAt))
      .limit(1);
    return row?.joinedAt ?? null;
  }, 'npc-dyn-latest-membership');
}

export async function listDistinctShareUserIdsAsSystem() {
  return asSystem(async (c) => {
    const rows = await c.select({ userId: shares.userId }).from(shares);
    return [...new Set(rows.map((r) => r.userId))];
  }, 'npc-dyn-share-user-ids');
}

export type NpcDynamicsPotentialInviteUserRow = typeof users.$inferSelect;

export async function listPotentialInviteUsersAsSystem(params: {
  excludeMemberIds: string[];
  candidateUserIds: string[];
  limit: number;
}) {
  const { excludeMemberIds, candidateUserIds, limit } = params;
  if (candidateUserIds.length === 0) {
    return [];
  }
  return asSystem(
    async (c) =>
      c
        .select()
        .from(users)
        .where(
          and(
            eq(users.isActor, false),
            notInArray(
              users.id,
              excludeMemberIds.length > 0 ? excludeMemberIds : ['']
            ),
            inArray(users.id, candidateUserIds)
          )
        )
        .limit(limit),
    'npc-dyn-potential-invites'
  );
}

// --- Writes (single asSystem transaction each) ---

export async function applyNpcJoinGroupDynamicsWritesAsSystem(params: {
  chatId: string;
  candidateUserId: string;
  chatLegacyGroupId: string | null;
  existingParticipant?: { id: string; isActive: boolean } | null;
  newChatParticipantId?: string;
  newGroupMemberId?: string;
}): Promise<void> {
  const {
    chatId,
    candidateUserId,
    chatLegacyGroupId,
    existingParticipant,
    newChatParticipantId,
    newGroupMemberId,
  } = params;

  return asSystem(async (c) => {
    if (existingParticipant) {
      if (!existingParticipant.isActive) {
        await c
          .update(chatParticipants)
          .set({
            isActive: true,
            joinedAt: new Date(),
          })
          .where(eq(chatParticipants.id, existingParticipant.id));
      }
    } else {
      if (!newChatParticipantId) {
        throw new Error(
          'applyNpcJoinGroupDynamicsWritesAsSystem: newChatParticipantId required'
        );
      }
      await c.insert(chatParticipants).values({
        id: newChatParticipantId,
        chatId,
        userId: candidateUserId,
      });
    }

    if (!chatLegacyGroupId) {
      return;
    }

    const [existingMember] = await c
      .select({
        id: groupMembers.id,
        isActive: groupMembers.isActive,
      })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, chatLegacyGroupId),
          eq(groupMembers.userId, candidateUserId)
        )
      )
      .limit(1);

    if (existingMember) {
      if (!existingMember.isActive) {
        await c
          .update(groupMembers)
          .set({
            isActive: true,
            joinedAt: new Date(),
            kickedAt: sql`NULL`,
            kickReason: sql`NULL`,
          })
          .where(eq(groupMembers.id, existingMember.id));
      }
      return;
    }

    if (!newGroupMemberId) {
      throw new Error(
        'applyNpcJoinGroupDynamicsWritesAsSystem: newGroupMemberId required'
      );
    }

    await c.insert(groupMembers).values({
      id: newGroupMemberId,
      groupId: chatLegacyGroupId,
      userId: candidateUserId,
      role: 'member',
      isActive: true,
      addedBy: null,
    });
  }, 'npc-dyn-join-writes');
}

export async function applyNpcLeaveGroupWritesAsSystem(params: {
  chatParticipantRowId: string;
  chatGroupId: string | null;
  userId: string;
  negativeRelationshipCount: number;
}): Promise<void> {
  const {
    chatParticipantRowId,
    chatGroupId,
    userId,
    negativeRelationshipCount,
  } = params;

  return asSystem(async (c) => {
    await c
      .delete(chatParticipants)
      .where(eq(chatParticipants.id, chatParticipantRowId));

    if (!chatGroupId) {
      return;
    }

    await c
      .update(groupMembers)
      .set({
        isActive: false,
        kickedAt: new Date(),
        kickReason: `Left - ${negativeRelationshipCount} negative relationships`,
      })
      .where(
        and(
          eq(groupMembers.groupId, chatGroupId),
          eq(groupMembers.userId, userId)
        )
      );
  }, 'npc-dyn-leave-writes');
}

export async function insertNpcGroupDynamicMessageAsSystem(params: {
  messageId: string;
  content: string;
  chatId: string;
  senderId: string;
  createdAt: Date;
}): Promise<void> {
  const { messageId, content, chatId, senderId, createdAt } = params;

  return asSystem(async (c) => {
    await c.insert(messages).values({
      id: messageId,
      content,
      chatId,
      senderId,
      createdAt,
    });
    await c
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));
  }, 'npc-dyn-insert-group-message');
}

export async function bootstrapLegacyNpcGroupForChatAsSystem(params: {
  newGroupId: string;
  chatId: string;
  groupDisplayName: string;
  invitingNpcId: string;
  backfillMembers: Array<{
    userId: string;
    rowId: string;
    role: 'owner' | 'member';
  }>;
}): Promise<void> {
  const {
    newGroupId,
    chatId,
    groupDisplayName,
    invitingNpcId,
    backfillMembers,
  } = params;

  return asSystem(async (c) => {
    await c.insert(groups).values({
      id: newGroupId,
      name: groupDisplayName,
      type: 'npc',
      ownerId: invitingNpcId,
      createdById: invitingNpcId,
      updatedAt: new Date(),
    });

    await c
      .update(chats)
      .set({ groupId: newGroupId })
      .where(eq(chats.id, chatId));

    for (const m of backfillMembers) {
      const [existing] = await c
        .select({ id: groupMembers.id })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, newGroupId),
            eq(groupMembers.userId, m.userId)
          )
        )
        .limit(1);

      if (!existing) {
        await c.insert(groupMembers).values({
          id: m.rowId,
          groupId: newGroupId,
          userId: m.userId,
          role: m.role,
          addedBy: invitingNpcId,
        });
      }
    }
  }, 'npc-dyn-bootstrap-legacy-group');
}

export async function fetchGroupInviteIdStatusByGroupAndUserAsSystem(
  groupId: string,
  invitedUserId: string
) {
  return asSystem(async (c) => {
    const [row] = await c
      .select({
        id: groupInvites.id,
        status: groupInvites.status,
      })
      .from(groupInvites)
      .where(
        and(
          eq(groupInvites.groupId, groupId),
          eq(groupInvites.invitedUserId, invitedUserId)
        )
      )
      .limit(1);
    return row;
  }, 'npc-dyn-fetch-group-invite');
}

export async function updateGroupInviteDeclinedToPendingAsSystem(params: {
  inviteId: string;
  invitingNpcId: string;
  message: string;
}): Promise<void> {
  const { inviteId, invitingNpcId, message } = params;

  return asSystem(async (c) => {
    await c
      .update(groupInvites)
      .set({
        status: 'pending',
        invitedBy: invitingNpcId,
        invitedAt: new Date(),
        respondedAt: null,
        message,
      })
      .where(eq(groupInvites.id, inviteId));
  }, 'npc-dyn-invite-reopen');
}

export async function insertPendingGroupInviteAsSystem(params: {
  id: string;
  groupId: string;
  invitedUserId: string;
  invitedBy: string;
  message: string;
}): Promise<void> {
  const { id, groupId, invitedUserId, invitedBy, message } = params;

  return asSystem(async (c) => {
    await c.insert(groupInvites).values({
      id,
      groupId,
      invitedUserId,
      invitedBy,
      status: 'pending',
      message,
    });
  }, 'npc-dyn-invite-insert');
}

export async function applyNpcKickUserFromGroupChatAsSystem(params: {
  chatId: string;
  userId: string;
  groupId: string | null;
  kickReason: string;
}): Promise<void> {
  const { chatId, userId, groupId, kickReason } = params;

  return asSystem(async (c) => {
    await c
      .delete(chatParticipants)
      .where(
        and(
          eq(chatParticipants.chatId, chatId),
          eq(chatParticipants.userId, userId)
        )
      );

    if (!groupId) {
      return;
    }

    await c
      .update(groupMembers)
      .set({
        isActive: false,
        kickedAt: new Date(),
        kickReason,
      })
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
      );
  }, 'npc-dyn-kick-user');
}
