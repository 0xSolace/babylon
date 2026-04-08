/**
 * SQL for `apps/web` group member adds and invite accept (upserts on GroupMember / ChatParticipant / GroupInvite).
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { groupInvites } from './tables/group-invites';
import { groupMembers } from './tables/group-members';

type GroupMutDb = DrizzleClient | Transaction;

export async function upsertActiveGroupMemberAsMember(
  db: GroupMutDb,
  params: {
    id: string;
    groupId: string;
    userId: string;
    addedBy: string;
    joinedAt: Date;
  }
): Promise<void> {
  await db
    .insert(groupMembers)
    .values({
      id: params.id,
      groupId: params.groupId,
      userId: params.userId,
      role: 'member',
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
        role: 'member',
        addedBy: params.addedBy,
        joinedAt: params.joinedAt,
        kickedAt: sql`NULL`,
        kickReason: sql`NULL`,
      },
    });
}

export async function upsertActiveChatParticipant(
  db: GroupMutDb,
  params: {
    id: string;
    chatId: string;
    userId: string;
    joinedAt: Date;
  }
): Promise<void> {
  await db
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

export async function insertGroupInvitePendingRow(
  db: GroupMutDb,
  params: {
    id: string;
    groupId: string;
    invitedUserId: string;
    invitedBy: string;
    invitedAt: Date;
  }
): Promise<void> {
  await db.insert(groupInvites).values({
    id: params.id,
    groupId: params.groupId,
    invitedUserId: params.invitedUserId,
    invitedBy: params.invitedBy,
    status: 'pending',
    invitedAt: params.invitedAt,
  });
}

export async function reactivateGroupInvitePendingForGroupAndUser(
  db: GroupMutDb,
  params: {
    groupId: string;
    invitedUserId: string;
    invitedBy: string;
    invitedAt: Date;
  }
): Promise<void> {
  await db
    .update(groupInvites)
    .set({
      invitedBy: params.invitedBy,
      status: 'pending',
      invitedAt: params.invitedAt,
      respondedAt: sql`NULL`,
    })
    .where(
      and(
        eq(groupInvites.groupId, params.groupId),
        eq(groupInvites.invitedUserId, params.invitedUserId)
      )
    );
}
