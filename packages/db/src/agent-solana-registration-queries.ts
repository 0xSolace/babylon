/**
 * User row reads/writes for Solana agent registration (`agent-solana-registration-service`).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { users } from './tables/user';

type SolanaRegDb = DrizzleClient | Transaction;

export const AGENT_SOLANA_REGISTRATION_SELECT = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  profileImageUrl: users.profileImageUrl,
  isAgent: users.isAgent,
  managedBy: users.managedBy,
  privyId: users.privyId,
  privySolanaWalletId: users.privySolanaWalletId,
  solanaWalletAddress: users.solanaWalletAddress,
  solanaOfflineWalletReady: users.solanaOfflineWalletReady,
  solanaRegistered: users.solanaRegistered,
  solanaRegistryAssetId: users.solanaRegistryAssetId,
  solanaMetadataUri: users.solanaMetadataUri,
  solanaRegistrationTxHash: users.solanaRegistrationTxHash,
} as const;

export type AgentSolanaRegistrationRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  isAgent: boolean;
  managedBy: string | null;
  privyId: string | null;
  privySolanaWalletId: string | null;
  solanaWalletAddress: string | null;
  solanaOfflineWalletReady: boolean;
  solanaRegistered: boolean;
  solanaRegistryAssetId: string | null;
  solanaMetadataUri: string | null;
  solanaRegistrationTxHash: string | null;
};

export async function selectAgentSolanaRegistrationRow(
  db: SolanaRegDb,
  agentUserId: string
): Promise<AgentSolanaRegistrationRow | undefined> {
  const [row] = await db
    .select(AGENT_SOLANA_REGISTRATION_SELECT)
    .from(users)
    .where(eq(users.id, agentUserId))
    .limit(1);
  return row;
}

export async function updateAgentSolanaWalletPersisted(
  db: SolanaRegDb,
  agentUserId: string,
  wallet: { privyWalletId: string; walletAddress: string }
): Promise<void> {
  await db
    .update(users)
    .set({
      privySolanaWalletId: wallet.privyWalletId,
      solanaWalletAddress: wallet.walletAddress,
      solanaOfflineWalletReady: true,
      solanaOfflineWalletReadyAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, agentUserId));
}

export async function updateAgentSolanaRegistrationPersisted(
  db: SolanaRegDb,
  agentUserId: string,
  args: {
    assetId: string;
    metadataUri: string | null;
    wallet?: {
      walletAddress: string;
      walletId: string;
    } | null;
    txHash?: string | null;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      ...(args.wallet
        ? {
            privySolanaWalletId: args.wallet.walletId,
            solanaWalletAddress: args.wallet.walletAddress,
            solanaOfflineWalletReady: true,
            solanaOfflineWalletReadyAt: new Date(),
          }
        : {}),
      solanaRegistered: true,
      solanaRegistryAssetId: args.assetId,
      solanaMetadataUri: args.metadataUri ?? null,
      solanaRegistrationTxHash: args.txHash ?? null,
      solanaRegisteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, agentUserId));
}
