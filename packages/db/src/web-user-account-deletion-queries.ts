/**
 * SQL for `POST /api/users/delete-account` (system transaction).
 */

import { eq, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { feedbacks } from './tables/feedbacks';
import { followStatuses } from './tables/follow-statuses';
import { groupInvites } from './tables/group-invites';
import { groupMembers } from './tables/group-members';
import { poolDeposits } from './tables/pool-deposits';
import { referrals } from './tables/referrals';
import { shareActions } from './tables/share-actions';
import { tradingFees } from './tables/trading-fees';
import { users } from './tables/user';
import { userActorFollows } from './tables/user-actor-follows';
import { userInteractions } from './tables/user-interactions';

type AccountDeletionDb = DrizzleClient | Transaction;

export type UserDeleteAccountSlice = {
  id: string;
  username: string | null;
  walletAddress: string | null;
  onChainRegistered: boolean;
  nftTokenId: number | null;
};

export async function deleteUserAccountById(
  db: AccountDeletionDb,
  userId: string
): Promise<{ ok: true; user: UserDeleteAccountSlice } | { ok: false }> {
  const [userRow] = await db
    .select({
      id: users.id,
      username: users.username,
      walletAddress: users.walletAddress,
      onChainRegistered: users.onChainRegistered,
      nftTokenId: users.nftTokenId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return { ok: false };
  }

  await db
    .update(referrals)
    .set({ referredUserId: null })
    .where(eq(referrals.referredUserId, userId));

  await db
    .update(tradingFees)
    .set({ referrerId: null })
    .where(eq(tradingFees.referrerId, userId));

  await db
    .update(feedbacks)
    .set({ fromUserId: null })
    .where(eq(feedbacks.fromUserId, userId));

  await db
    .update(feedbacks)
    .set({ toUserId: null })
    .where(eq(feedbacks.toUserId, userId));

  await db.delete(userActorFollows).where(eq(userActorFollows.userId, userId));

  await db.delete(userInteractions).where(eq(userInteractions.userId, userId));

  await db.delete(groupMembers).where(eq(groupMembers.userId, userId));

  await db
    .delete(groupInvites)
    .where(
      or(
        eq(groupInvites.invitedUserId, userId),
        eq(groupInvites.invitedBy, userId)
      )
    );

  await db.delete(followStatuses).where(eq(followStatuses.userId, userId));

  await db.delete(shareActions).where(eq(shareActions.userId, userId));

  await db.delete(poolDeposits).where(eq(poolDeposits.userId, userId));

  await db.delete(users).where(eq(users.id, userId));

  return { ok: true, user: userRow };
}
