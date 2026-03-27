/**
 * DB reads and transactional writes for NFT premium chat gating.
 * On-chain access stays in the API; callers pass a Drizzle `tx` from `db.transaction`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db, type Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { users } from './tables/user';

/**
 * Upsert group membership + chat participant rows for the NFT-gated premium chat.
 */
export async function applyEnsureNftGatedChatMembership(
  tx: Transaction,
  params: {
    userId: string;
    chatId: string;
    groupId: string;
    now: Date;
  }
): Promise<void> {
  const { userId, chatId, groupId, now } = params;

  const memberId = await generateSnowflakeId();
  await tx
    .insert(groupMembers)
    .values({
      id: memberId,
      groupId,
      userId,
      role: 'member',
      addedBy: 'system',
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
        addedBy: 'system',
        joinedAt: now,
        kickedAt: sql`NULL`,
        kickReason: sql`NULL`,
      },
    });

  const participantId = await generateSnowflakeId();
  await tx
    .insert(chatParticipants)
    .values({
      id: participantId,
      chatId,
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
}

/**
 * Deactivate participant (and group member when `groupId` is set) for NFT revocation.
 */
export async function applyRevokeNftGatedChatMembership(
  tx: Transaction,
  params: {
    userId: string;
    chatId: string;
    groupId: string | null;
    reason: string;
  }
): Promise<void> {
  const { userId, chatId, groupId, reason } = params;
  const kickedAt = new Date();

  await tx
    .update(chatParticipants)
    .set({ isActive: false })
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId),
        eq(chatParticipants.isActive, true)
      )
    );

  if (groupId) {
    await tx
      .update(groupMembers)
      .set({
        isActive: false,
        kickedAt,
        kickReason: reason,
      })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.isActive, true)
        )
      );
  }
}

export async function fetchUserWalletAddressForNftGate(
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.walletAddress ?? null;
}

export interface NftGateChatRow {
  id: string;
  isGroup: boolean;
  groupId: string | null;
}

export async function fetchNftGateChatRow(
  chatId: string
): Promise<NftGateChatRow | null> {
  const [row] = await db
    .select({
      id: chats.id,
      isGroup: chats.isGroup,
      groupId: chats.groupId,
    })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  return row ?? null;
}

export async function fetchNftGateChatGroupId(
  chatId: string
): Promise<string | null> {
  const [row] = await db
    .select({ groupId: chats.groupId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  return row?.groupId ?? null;
}

export async function fetchActiveNftGateParticipantId(
  chatId: string,
  userId: string
): Promise<string | null> {
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

  return row?.id ?? null;
}

export async function fetchActiveNftGateGroupMemberId(
  groupId: string,
  userId: string
): Promise<string | null> {
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

  return row?.id ?? null;
}
