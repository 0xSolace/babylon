/**
 * SQL for `packages/agents` TeamChatService (team `Group`, `Chat`, membership, messages).
 */

import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import type { Chat, Group, User } from './model-types';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';
import { messages } from './tables/messages';
import { users } from './tables/user';

type TeamChatDb = DrizzleClient | Transaction;

export type TeamChatBootstrapRow = {
  id: string;
  groupId: string;
  chatId: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function selectTeamGroupRowByOwnerId(
  db: TeamChatDb,
  ownerUserId: string
): Promise<Group | undefined> {
  const [row] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.type, 'team'), eq(groups.ownerId, ownerUserId)))
    .limit(1);
  return row;
}

export async function insertTeamChatBootstrapBundle(
  tx: TeamChatDb,
  params: {
    groupId: string;
    chatId: string;
    memberId: string;
    participantId: string;
    userId: string;
    now: Date;
    groupName: string;
    groupDescription: string;
  }
): Promise<TeamChatBootstrapRow> {
  const {
    groupId,
    chatId,
    memberId,
    participantId,
    userId,
    now,
    groupName,
    groupDescription,
  } = params;

  await tx.insert(groups).values({
    id: groupId,
    name: groupName,
    description: groupDescription,
    type: 'team',
    ownerId: userId,
    createdById: userId,
    activeChatId: chatId,
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(chats).values({
    id: chatId,
    name: null,
    description: null,
    isGroup: true,
    groupId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(groupMembers).values({
    id: memberId,
    groupId,
    userId,
    role: 'owner',
    addedBy: userId,
    joinedAt: now,
    isActive: true,
    messageCount: 0,
    qualityScore: 1.0,
  });

  await tx.insert(chatParticipants).values({
    id: participantId,
    chatId,
    userId,
    joinedAt: now,
    isActive: true,
  });

  return {
    id: groupId,
    groupId,
    chatId,
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function selectActiveChatParticipantId(
  db: TeamChatDb,
  chatId: string,
  userId: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: chatParticipants.id })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId),
        eq(chatParticipants.isActive, true)
      )
    )
    .limit(1);
  return row?.id;
}

export async function selectActiveGroupMemberId(
  db: TeamChatDb,
  groupId: string,
  userId: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.isActive, true)
      )
    )
    .limit(1);
  return row?.id;
}

export async function upsertTeamGroupOwnerMember(
  tx: TeamChatDb,
  params: {
    id: string;
    groupId: string;
    userId: string;
    joinedAt: Date;
    addedBy: string;
  }
): Promise<void> {
  await tx
    .insert(groupMembers)
    .values({
      id: params.id,
      groupId: params.groupId,
      userId: params.userId,
      role: 'owner',
      addedBy: params.addedBy,
      joinedAt: params.joinedAt,
      isActive: true,
      messageCount: 0,
      qualityScore: 1.0,
    })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: {
        isActive: true,
        role: 'owner',
        joinedAt: params.joinedAt,
      },
    });
}

export async function selectChatGroupIdByChatId(
  db: TeamChatDb,
  chatId: string
): Promise<string | null | undefined> {
  const [row] = await db
    .select({ groupId: chats.groupId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row?.groupId;
}

export async function selectChatIsGroupRowByChatId(
  db: TeamChatDb,
  chatId: string
): Promise<{ isGroup: boolean } | undefined> {
  const [row] = await db
    .select({ isGroup: chats.isGroup })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row;
}

export async function selectTeamChatAgentUsersForOwner(
  db: TeamChatDb,
  groupId: string,
  ownerUserId: string
): Promise<User[]> {
  const memberRows = await db
    .select({ user: users })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.isActive, true),
        eq(users.isAgent, true),
        eq(users.managedBy, ownerUserId)
      )
    )
    .orderBy(users.createdAt);

  return memberRows.map((r) => r.user);
}

export async function selectAgentUserIdsManagedBy(
  db: TeamChatDb,
  managerUserId: string
): Promise<{ id: string }[]> {
  return db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.managedBy, managerUserId), eq(users.isAgent, true)));
}

export async function selectActiveGroupMemberUserIds(
  db: TeamChatDb,
  groupId: string
): Promise<{ userId: string }[]> {
  return db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.isActive, true))
    );
}

export async function upsertGroupMemberAsTeamAgent(
  tx: TeamChatDb,
  params: {
    id: string;
    groupId: string;
    agentUserId: string;
    ownerUserId: string;
    joinedAt: Date;
  }
): Promise<void> {
  await tx
    .insert(groupMembers)
    .values({
      id: params.id,
      groupId: params.groupId,
      userId: params.agentUserId,
      role: 'member',
      addedBy: params.ownerUserId,
      joinedAt: params.joinedAt,
      isActive: true,
      messageCount: 0,
      qualityScore: 1.0,
    })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: {
        isActive: true,
        joinedAt: params.joinedAt,
        addedBy: params.ownerUserId,
        role: 'member',
        kickedAt: null,
        kickReason: null,
      },
    });
}

export async function upsertChatParticipantActive(
  tx: TeamChatDb,
  params: {
    id: string;
    chatId: string;
    userId: string;
    joinedAt: Date;
  }
): Promise<void> {
  await tx
    .insert(chatParticipants)
    .values({
      id: params.id,
      chatId: params.chatId,
      userId: params.userId,
      joinedAt: params.joinedAt,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [chatParticipants.chatId, chatParticipants.userId],
      set: {
        isActive: true,
        joinedAt: params.joinedAt,
      },
    });
}

export async function updateGroupUpdatedAt(
  tx: TeamChatDb,
  groupId: string,
  at: Date
): Promise<void> {
  await tx.update(groups).set({ updatedAt: at }).where(eq(groups.id, groupId));
}

export async function deactivateGroupMemberInTeam(
  tx: TeamChatDb,
  params: {
    groupId: string;
    userId: string;
    kickedAt: Date;
    kickReason: string;
  }
): Promise<void> {
  await tx
    .update(groupMembers)
    .set({
      isActive: false,
      kickedAt: params.kickedAt,
      kickReason: params.kickReason,
    })
    .where(
      and(
        eq(groupMembers.groupId, params.groupId),
        eq(groupMembers.userId, params.userId)
      )
    );
}

export async function deactivateChatParticipantInChat(
  tx: TeamChatDb,
  chatId: string,
  userId: string
): Promise<void> {
  await tx
    .update(chatParticipants)
    .set({ isActive: false })
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      )
    );
}

export async function insertTeamChatSystemMessage(
  tx: TeamChatDb,
  params: {
    id: string;
    chatId: string;
    content: string;
    createdAt: Date;
  }
): Promise<void> {
  await tx.insert(messages).values({
    id: params.id,
    chatId: params.chatId,
    senderId: 'system',
    type: 'system',
    content: params.content,
    createdAt: params.createdAt,
  });
}

export async function batchUpsertGroupMembersAsTeamAgents(
  tx: TeamChatDb,
  params: {
    ownerUserId: string;
    joinedAt: Date;
    rows: Array<{ id: string; groupId: string; userId: string }>;
  }
): Promise<void> {
  const { ownerUserId, joinedAt, rows } = params;
  if (rows.length === 0) return;
  const memberValues = rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    userId: r.userId,
    role: 'member' as const,
    addedBy: ownerUserId,
    joinedAt,
    isActive: true,
    messageCount: 0,
    qualityScore: 1.0,
  }));
  await tx
    .insert(groupMembers)
    .values(memberValues)
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: {
        isActive: true,
        joinedAt,
        addedBy: ownerUserId,
        role: 'member',
        kickedAt: null,
        kickReason: null,
      },
    });
}

export async function batchUpsertChatParticipantsActive(
  tx: TeamChatDb,
  params: {
    joinedAt: Date;
    rows: Array<{ id: string; chatId: string; userId: string }>;
  }
): Promise<void> {
  const { joinedAt, rows } = params;
  if (rows.length === 0) return;
  const participantValues = rows.map((r) => ({
    id: r.id,
    chatId: r.chatId,
    userId: r.userId,
    joinedAt,
    isActive: true,
  }));
  await tx
    .insert(chatParticipants)
    .values(participantValues)
    .onConflictDoUpdate({
      target: [chatParticipants.chatId, chatParticipants.userId],
      set: {
        isActive: true,
        joinedAt,
      },
    });
}

export async function selectChatsForGroupOrderByUpdatedDesc(
  db: TeamChatDb,
  groupId: string
): Promise<Chat[]> {
  return db
    .select()
    .from(chats)
    .where(eq(chats.groupId, groupId))
    .orderBy(desc(chats.updatedAt));
}

export async function insertChatReturningRow(
  tx: TeamChatDb,
  values: {
    id: string;
    name: string | null;
    description: null;
    isGroup: boolean;
    groupId: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }
): Promise<Chat> {
  const [row] = await tx.insert(chats).values(values).returning();
  if (!row) {
    throw new Error('insertChatReturningRow: no row returned');
  }
  return row;
}

export async function insertChatParticipantRow(
  tx: TeamChatDb,
  row: {
    id: string;
    chatId: string;
    userId: string;
    joinedAt: Date;
    isActive: boolean;
  }
): Promise<void> {
  await tx.insert(chatParticipants).values(row);
}

export async function insertChatParticipantsOnConflictDoNothing(
  tx: TeamChatDb,
  rows: Array<{
    id: string;
    chatId: string;
    userId: string;
    joinedAt: Date;
    isActive: boolean;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(chatParticipants).values(rows).onConflictDoNothing();
}

export async function updateGroupActiveChatId(
  db: TeamChatDb,
  groupId: string,
  chatId: string,
  at: Date
): Promise<void> {
  await db
    .update(groups)
    .set({ activeChatId: chatId, updatedAt: at })
    .where(eq(groups.id, groupId));
}

export async function selectChatRowByIdAndGroupId(
  db: TeamChatDb,
  chatId: string,
  groupId: string
): Promise<Chat | undefined> {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.groupId, groupId)))
    .limit(1);
  return row;
}

export async function updateChatNameById(
  db: TeamChatDb,
  chatId: string,
  name: string,
  updatedAt: Date
): Promise<void> {
  await db.update(chats).set({ name, updatedAt }).where(eq(chats.id, chatId));
}

export async function selectChatNameByIdAndGroupId(
  db: TeamChatDb,
  chatId: string,
  groupId: string
): Promise<{ name: string | null } | undefined> {
  const [row] = await db
    .select({ name: chats.name })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.groupId, groupId)))
    .limit(1);
  return row;
}

export async function updateChatNameIfNullForGroupReturningIds(
  db: TeamChatDb,
  params: {
    chatId: string;
    groupId: string;
    name: string;
    updatedAt: Date;
  }
): Promise<{ id: string }[]> {
  return db
    .update(chats)
    .set({ name: params.name, updatedAt: params.updatedAt })
    .where(
      and(
        eq(chats.id, params.chatId),
        isNull(chats.name),
        eq(chats.groupId, params.groupId)
      )
    )
    .returning({ id: chats.id });
}

export async function countUserMessagesInChat(
  db: TeamChatDb,
  chatId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<string>`count(*)` })
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.type, 'user')));

  const countValue = result[0]?.count;
  return typeof countValue === 'string'
    ? Number.parseInt(countValue, 10)
    : (countValue ?? 0);
}

export async function deleteMessagesByChatId(
  tx: TeamChatDb,
  chatId: string
): Promise<void> {
  await tx.delete(messages).where(eq(messages.chatId, chatId));
}

export async function deleteChatParticipantsByChatId(
  tx: TeamChatDb,
  chatId: string
): Promise<void> {
  await tx.delete(chatParticipants).where(eq(chatParticipants.chatId, chatId));
}

export async function deleteChatById(
  tx: TeamChatDb,
  chatId: string
): Promise<void> {
  await tx.delete(chats).where(eq(chats.id, chatId));
}

export async function selectNewestChatIdInGroupExcluding(
  tx: TeamChatDb,
  groupId: string,
  excludeChatId: string
): Promise<string | undefined> {
  const [row] = await tx
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.groupId, groupId), ne(chats.id, excludeChatId)))
    .orderBy(desc(chats.createdAt))
    .limit(1);
  return row?.id;
}
