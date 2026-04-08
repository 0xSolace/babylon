/**
 * Transaction steps for POST /api/admin/group-invite (NPC group + chat upsert).
 */

import { sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';

type GroupInviteDb = DrizzleClient | Transaction;

export async function runAdminNpcGroupInviteUpsert(
  tx: GroupInviteDb,
  params: {
    deterministicGrpId: string;
    finalChatId: string;
    finalChatName: string;
    npcId: string;
    userId: string;
    now: Date;
    participantRowId: string;
    memberRowId: string;
  }
): Promise<string> {
  const {
    deterministicGrpId,
    finalChatId,
    finalChatName,
    npcId,
    userId,
    now,
    participantRowId,
    memberRowId,
  } = params;

  await tx
    .insert(groups)
    .values({
      id: deterministicGrpId,
      name: finalChatName,
      type: 'npc',
      ownerId: npcId,
      createdById: npcId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: groups.id });

  await tx
    .insert(chats)
    .values({
      id: finalChatId,
      name: finalChatName,
      isGroup: true,
      gameId: 'realtime',
      groupId: deterministicGrpId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        groupId: deterministicGrpId,
        updatedAt: now,
      },
    });

  await tx
    .insert(chatParticipants)
    .values({
      id: participantRowId,
      chatId: finalChatId,
      userId,
      joinedAt: now,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [chatParticipants.chatId, chatParticipants.userId],
      set: {
        isActive: true,
        joinedAt: now,
      },
    });

  await tx
    .insert(groupMembers)
    .values({
      id: memberRowId,
      groupId: deterministicGrpId,
      userId,
      role: 'member',
      addedBy: npcId,
      joinedAt: now,
      isActive: true,
      messageCount: 0,
      qualityScore: 1.0,
    })
    .onConflictDoUpdate({
      target: [groupMembers.groupId, groupMembers.userId],
      set: {
        isActive: true,
        role: 'member',
        addedBy: npcId,
        joinedAt: now,
        kickedAt: sql`NULL`,
        kickReason: sql`NULL`,
      },
    });

  return deterministicGrpId;
}
