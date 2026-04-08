/**
 * DB reads for `nft-indexer-service` (fallback ownership + owner lookup by wallet).
 */

import { eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftOwnership } from './tables/nft-ownership';
import { users } from './tables/user';

type NftIdxDb = DrizzleClient | Transaction;

export async function selectNftOwnershipTokenIdsByUserId(
  db: NftIdxDb,
  dbUserId: string
): Promise<number[]> {
  const rows = await db
    .select({ tokenId: nftOwnership.tokenId })
    .from(nftOwnership)
    .where(eq(nftOwnership.userId, dbUserId));
  return rows.map((r) => r.tokenId);
}

export type NftIndexerOwnerUserRow = {
  id: string;
  walletAddress: string | null;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export async function selectUsersByWalletAddressesForNftIndexer(
  db: NftIdxDb,
  normalizedWalletAddresses: string[]
): Promise<NftIndexerOwnerUserRow[]> {
  if (normalizedWalletAddresses.length === 0) return [];
  return db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(inArray(users.walletAddress, normalizedWalletAddresses));
}
