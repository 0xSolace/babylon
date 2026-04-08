/**
 * SQL for agents package identity / Privy wallet provisioning (User + Agent0 fields).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type IdWalletDb = DrizzleClient | Transaction;

export async function updateUserAgent0RegistrationAfterAgent0(
  db: IdWalletDb,
  userId: string,
  params: {
    agent0TokenId: number;
    agent0MetadataCID: string | null;
    registrationTxHash: string | null;
    onChainRegistered: boolean;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      agent0TokenId: params.agent0TokenId,
      agent0MetadataCID: params.agent0MetadataCID,
      registrationTxHash: params.registrationTxHash,
      onChainRegistered: params.onChainRegistered,
    })
    .where(eq(users.id, userId));
}

export type AgentWalletStateSliceRow = {
  id: string;
  isAgent: boolean | null;
  walletAddress: string | null;
  privyId: string | null;
  privyWalletId: string | null;
  offlineWalletReady: boolean | null;
};

export async function selectAgentWalletStateSliceById(
  db: IdWalletDb,
  userId: string
): Promise<AgentWalletStateSliceRow | undefined> {
  const [row] = await db
    .select({
      id: users.id,
      isAgent: users.isAgent,
      walletAddress: users.walletAddress,
      privyId: users.privyId,
      privyWalletId: users.privyWalletId,
      offlineWalletReady: users.offlineWalletReady,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function updateUserPrivyWalletProvisioned(
  db: IdWalletDb,
  userId: string,
  params: {
    walletAddress: string;
    privyId: string;
    privyWalletId: string;
    offlineWalletReadyAt: Date;
    updatedAt: Date;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      walletAddress: params.walletAddress,
      privyId: params.privyId,
      privyWalletId: params.privyWalletId,
      offlineWalletReady: true,
      offlineWalletReadyAt: params.offlineWalletReadyAt,
      updatedAt: params.updatedAt,
    })
    .where(eq(users.id, userId));
}
