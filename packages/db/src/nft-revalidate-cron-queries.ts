/**
 * SQL for POST /api/cron/nft-revalidate (NFT-gated chat membership checks).
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { asSystem } from './db';
import { chatParticipants } from './tables/chat-participants';
import { chats } from './tables/chats';
import { users } from './tables/user';

type NftRevalidateDb = DrizzleClient | Transaction;

export type NftRevalidateParticipantWalletRow = {
  userId: string;
  walletAddress: string | null;
};

export async function selectChatByIdForNftRevalidate(
  db: NftRevalidateDb,
  chatId: string
) {
  return db.query.chats.findFirst({
    where: eq(chats.id, chatId),
  });
}

/**
 * All active participants’ wallets for a chat (admin revalidate has no batch cap).
 */
export async function selectActiveChatParticipantWalletsByChatId(
  db: NftRevalidateDb,
  chatId: string
): Promise<NftRevalidateParticipantWalletRow[]> {
  const participantList = await db
    .select({
      userId: chatParticipants.userId,
    })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, chatId),
        eq(chatParticipants.isActive, true)
      )
    );

  if (participantList.length === 0) {
    return [];
  }

  const userIds = participantList.map((p) => p.userId);
  const usersList = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(inArray(users.id, userIds));

  const usersMap = new Map(usersList.map((u) => [u.id, u]));

  return participantList.map((p) => ({
    userId: p.userId,
    walletAddress: usersMap.get(p.userId)?.walletAddress ?? null,
  }));
}

export type NftGatedChatRevalidateRow = {
  id: string;
  groupId: string | null;
  requiredNftContractAddress: string | null;
  requiredNftTokenId: number | null;
  requiredNftChainId: number | null;
};

export async function selectNftGatedChatsForRevalidateCron(
  limit: number
): Promise<NftGatedChatRevalidateRow[]> {
  return asSystem(
    async (tx) =>
      tx
        .select({
          id: chats.id,
          groupId: chats.groupId,
          requiredNftContractAddress: chats.requiredNftContractAddress,
          requiredNftTokenId: chats.requiredNftTokenId,
          requiredNftChainId: chats.requiredNftChainId,
        })
        .from(chats)
        .where(eq(chats.nftGated, true))
        .orderBy(
          sql`${chats.lastNftRevalidatedAt} ASC NULLS FIRST`,
          asc(chats.createdAt)
        )
        .limit(limit),
    'nft-revalidate-list-chats'
  );
}

export async function updateChatNftRevalidateTimestamps(
  chatId: string,
  at: Date
): Promise<void> {
  await asSystem(
    async (tx) =>
      tx
        .update(chats)
        .set({ lastNftRevalidatedAt: at, updatedAt: at })
        .where(eq(chats.id, chatId)),
    'nft-revalidate-touch-chat'
  );
}

export async function selectActiveChatParticipantsWithWalletForNftRevalidate(
  chatId: string,
  maxUsers: number
): Promise<NftRevalidateParticipantWalletRow[]> {
  return asSystem(async (database) => {
    const participantList = await database
      .select({
        participantId: chatParticipants.id,
        userId: chatParticipants.userId,
      })
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.chatId, chatId),
          eq(chatParticipants.isActive, true)
        )
      )
      .limit(maxUsers);

    if (participantList.length === 0) {
      return [];
    }

    const userIds = participantList.map((p) => p.userId);
    const usersList = await database
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    return participantList.map((p) => ({
      userId: p.userId,
      walletAddress: usersMap.get(p.userId)?.walletAddress ?? null,
    }));
  }, 'nft-revalidate-cron');
}
