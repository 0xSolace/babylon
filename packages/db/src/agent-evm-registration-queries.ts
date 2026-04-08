/**
 * User row reads/writes for EVM agent registration (`agent-evm-registration-service`).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type EvmDb = DrizzleClient | Transaction;

export const AGENT_EVM_REGISTRATION_SELECT = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  profileImageUrl: users.profileImageUrl,
  coverImageUrl: users.coverImageUrl,
  isAgent: users.isAgent,
  managedBy: users.managedBy,
  privyId: users.privyId,
  privyWalletId: users.privyWalletId,
  walletAddress: users.walletAddress,
  offlineWalletReady: users.offlineWalletReady,
  onChainRegistered: users.onChainRegistered,
  agent0TokenId: users.agent0TokenId,
  agent0MetadataCID: users.agent0MetadataCID,
  registrationTxHash: users.registrationTxHash,
} as const;

export type AgentEvmRegistrationRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  isAgent: boolean;
  managedBy: string | null;
  privyId: string | null;
  privyWalletId: string | null;
  walletAddress: string | null;
  offlineWalletReady: boolean;
  onChainRegistered: boolean;
  agent0TokenId: number | null;
  agent0MetadataCID: string | null;
  registrationTxHash: string | null;
};

export async function selectAgentEvmRegistrationRow(
  db: EvmDb,
  agentUserId: string
): Promise<AgentEvmRegistrationRow | undefined> {
  const [row] = await db
    .select(AGENT_EVM_REGISTRATION_SELECT)
    .from(users)
    .where(eq(users.id, agentUserId))
    .limit(1);
  return row;
}

export async function updateAgentEvmWalletPersisted(
  db: EvmDb,
  agentUserId: string,
  wallet: {
    privyId: string;
    privyWalletId: string;
    walletAddress: string;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      privyId: wallet.privyId,
      privyWalletId: wallet.privyWalletId,
      walletAddress: wallet.walletAddress.toLowerCase(),
      offlineWalletReady: true,
      offlineWalletReadyAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, agentUserId));
}
