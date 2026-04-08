/**
 * DB reads and transactional writes for NFT premium chat gating.
 * On-chain access stays in the API; callers pass a Drizzle `tx` from `db.transaction`.
 */

import { generateSnowflakeId } from '@babylon/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import { db, type Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { type Chat, chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { messages } from './tables/messages';
import { users } from './tables/user';

type NftGatedDiscoveryDb = DrizzleClient | Transaction;

export type NftGatedChatDiscoveryRow = {
  id: string;
  name: string | null;
  description: string | null;
  requiredNftContractAddress: string | null;
  requiredNftTokenId: number | null;
  requiredNftChainId: number | null;
  createdAt: Date;
};

export type NftGatedChatsDiscoveryContext = {
  userWalletRow: { walletAddress: string | null } | undefined;
  totalNftGatedChats: number;
  pageChats: NftGatedChatDiscoveryRow[];
  userMemberChatIds: string[];
  activeMemberCountByChatId: Map<string, number>;
};

/**
 * Page of NFT-gated chats plus membership and counts (for GET /api/chats/nft-gated).
 */
export async function selectNftGatedChatsDiscoveryContext(
  dbClient: NftGatedDiscoveryDb,
  params: { userId: string; limit: number; offset: number }
): Promise<NftGatedChatsDiscoveryContext> {
  const { userId, limit, offset } = params;

  const [walletRow] = await dbClient
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [totalCountResult] = await dbClient
    .select({ count: sql<number>`count(*)::int` })
    .from(chats)
    .where(eq(chats.nftGated, true));
  const total = totalCountResult?.count ?? 0;

  const pageChats = await dbClient
    .select({
      id: chats.id,
      name: chats.name,
      description: chats.description,
      requiredNftContractAddress: chats.requiredNftContractAddress,
      requiredNftTokenId: chats.requiredNftTokenId,
      requiredNftChainId: chats.requiredNftChainId,
      createdAt: chats.createdAt,
    })
    .from(chats)
    .where(eq(chats.nftGated, true))
    .orderBy(desc(chats.createdAt), asc(chats.id))
    .limit(limit)
    .offset(offset);

  if (pageChats.length === 0) {
    return {
      userWalletRow: walletRow,
      totalNftGatedChats: total,
      pageChats: [],
      userMemberChatIds: [],
      activeMemberCountByChatId: new Map(),
    };
  }

  const chatIds = pageChats.map((c) => c.id);

  const userMembershipRows = await dbClient
    .select({ chatId: chatParticipants.chatId })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.userId, userId),
        eq(chatParticipants.isActive, true),
        inArray(chatParticipants.chatId, chatIds)
      )
    );

  const memberCountsResult = await dbClient
    .select({
      chatId: chatParticipants.chatId,
      count: sql<number>`count(*)::int`,
    })
    .from(chatParticipants)
    .where(
      and(
        inArray(chatParticipants.chatId, chatIds),
        eq(chatParticipants.isActive, true)
      )
    )
    .groupBy(chatParticipants.chatId);

  const activeMemberCountByChatId = new Map<string, number>();
  for (const row of memberCountsResult) {
    activeMemberCountByChatId.set(row.chatId, row.count);
  }

  return {
    userWalletRow: walletRow,
    totalNftGatedChats: total,
    pageChats,
    userMemberChatIds: userMembershipRows.map((m) => m.chatId),
    activeMemberCountByChatId,
  };
}

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

/** Full chat row for POST /api/chats/[id]/join-nft (RLS client). */
export async function selectChatRowByIdForNftJoin(
  dbClient: NftGatedDiscoveryDb,
  chatId: string
): Promise<Chat | undefined> {
  const [row] = await dbClient
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return row;
}

export async function selectActiveChatParticipantForNftJoin(
  dbClient: NftGatedDiscoveryDb,
  chatId: string,
  userId: string
): Promise<{ id: string } | undefined> {
  const [row] = await dbClient
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
  return row;
}

export async function selectUserWalletAddressRowForNftJoin(
  dbClient: NftGatedDiscoveryDb,
  userId: string
): Promise<{ walletAddress: string | null } | undefined> {
  const [row] = await dbClient
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/**
 * Reactivate inactive participant or insert; sync group member row when `groupId` is set.
 * Used after off-chain NFT verification succeeds.
 */
export async function applyNftGatedChatUserSelfJoin(
  dbClient: NftGatedDiscoveryDb,
  params: {
    chatId: string;
    userId: string;
    groupId: string | null;
    now: Date;
  }
): Promise<void> {
  const { chatId, userId, groupId, now } = params;

  const [inactiveParticipant] = await dbClient
    .select()
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId),
        eq(chatParticipants.isActive, false)
      )
    )
    .limit(1);

  if (inactiveParticipant) {
    await dbClient
      .update(chatParticipants)
      .set({
        isActive: true,
        joinedAt: now,
      })
      .where(eq(chatParticipants.id, inactiveParticipant.id));
  } else {
    const participantId = await generateSnowflakeId();
    await dbClient.insert(chatParticipants).values({
      id: participantId,
      chatId,
      userId,
      joinedAt: now,
      isActive: true,
    });
  }

  if (!groupId) {
    return;
  }

  const [existingMember] = await dbClient
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .limit(1);

  if (existingMember) {
    await dbClient
      .update(groupMembers)
      .set({
        isActive: true,
        joinedAt: now,
        kickedAt: sql`NULL`,
        kickReason: sql`NULL`,
      })
      .where(eq(groupMembers.id, existingMember.id));
  } else {
    const memberId = await generateSnowflakeId();
    await dbClient.insert(groupMembers).values({
      id: memberId,
      groupId,
      userId,
      role: 'member',
      addedBy: userId,
      joinedAt: now,
      isActive: true,
      messageCount: 0,
      qualityScore: 1.0,
    });
  }
}

export async function selectUserJoinAnnouncementSlice(
  dbClient: NftGatedDiscoveryDb,
  userId: string
): Promise<
  { displayName: string | null; username: string | null } | undefined
> {
  const [row] = await dbClient
    .select({
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function insertNftGatedChatSystemJoinMessage(
  dbClient: NftGatedDiscoveryDb,
  params: {
    id: string;
    chatId: string;
    content: string;
    createdAt: Date;
  }
): Promise<void> {
  await dbClient.insert(messages).values({
    id: params.id,
    chatId: params.chatId,
    senderId: 'system',
    type: 'system',
    content: params.content,
    createdAt: params.createdAt,
  });
}

/**
 * NFT send-message check failed: deactivate group member (if linked) and **delete** chat participant row.
 * Matches POST /api/chats/[id]/message (hard remove, not soft participant deactivate).
 */
export async function applyRemoveUserFromNftGatedChatAfterAccessLoss(
  dbClient: NftGatedDiscoveryDb,
  params: {
    chatId: string;
    userId: string;
    groupId: string | null;
    kickReason?: string;
  }
): Promise<void> {
  const { chatId, userId, groupId } = params;
  const reason = params.kickReason ?? 'Lost NFT access';
  const kickedAt = new Date();

  if (groupId) {
    await dbClient
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

  await dbClient
    .delete(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.userId, userId)
      )
    );
}
