/**
 * SQL for GET/POST /api/admin/groups/nft-collection (NFT-gated groups).
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { groupMembers } from './tables/group-members';
import { groups } from './tables/groups';

type NftCollectionDb = DrizzleClient | Transaction;

export type AdminNftGatedChatListRow = {
  id: string;
  name: string | null;
  groupId: string | null;
  nftGated: boolean;
  requiredNftContractAddress: string | null;
  requiredNftTokenId: number | null;
  requiredNftChainId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function fetchAdminNftGatedChatsWithMemberCounts(
  db: NftCollectionDb
): Promise<{
  chatsList: AdminNftGatedChatListRow[];
  memberCountByChatId: Record<string, number>;
}> {
  const list = await db
    .select({
      id: chats.id,
      name: chats.name,
      groupId: chats.groupId,
      nftGated: chats.nftGated,
      requiredNftContractAddress: chats.requiredNftContractAddress,
      requiredNftTokenId: chats.requiredNftTokenId,
      requiredNftChainId: chats.requiredNftChainId,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(eq(chats.nftGated, true));

  const chatIds = list.map((c) => c.id);
  const memberCountByChatId: Record<string, number> = {};

  if (chatIds.length > 0) {
    const memberCountsResult = await db
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

    for (const row of memberCountsResult) {
      memberCountByChatId[row.chatId] = row.count;
    }
  }

  return { chatsList: list, memberCountByChatId };
}

export async function runAdminCreateNftCollectionGroup(
  tx: NftCollectionDb,
  params: {
    groupId: string;
    chatId: string;
    memberId: string;
    participantId: string;
    adminUserId: string;
    name: string;
    description: string | null;
    contractAddress: string;
    chainId: number;
    tokenId: number | null;
    now: Date;
  }
): Promise<{ groupId: string; chatId: string }> {
  const {
    groupId,
    chatId,
    memberId,
    participantId,
    adminUserId,
    name,
    description,
    contractAddress,
    chainId,
    tokenId,
    now,
  } = params;

  await tx.insert(groups).values({
    id: groupId,
    name,
    description,
    type: 'user',
    ownerId: adminUserId,
    createdById: adminUserId,
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(chats).values({
    id: chatId,
    name,
    description,
    isGroup: true,
    groupId,
    createdBy: adminUserId,
    nftGated: true,
    requiredNftContractAddress: contractAddress,
    requiredNftTokenId: tokenId,
    requiredNftChainId: chainId,
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    tx.insert(groupMembers).values({
      id: memberId,
      groupId,
      userId: adminUserId,
      role: 'owner',
      addedBy: adminUserId,
      joinedAt: now,
      isActive: true,
    }),
    tx.insert(chatParticipants).values({
      id: participantId,
      chatId,
      userId: adminUserId,
      joinedAt: now,
      isActive: true,
    }),
  ]);

  return { groupId, chatId };
}
