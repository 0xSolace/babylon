/**
 * SQL for `apps/web` wallet NFT portfolio and transaction history (RLS `db`).
 */

import { desc, eq, inArray, or } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftClaims } from './tables/nft-claims';
import { nftCollection } from './tables/nft-collection';
import { nftOwnership } from './tables/nft-ownership';
import { walletTransferLog } from './tables/wallet-transfer-log';

type WebWalletApiDb = DrizzleClient | Transaction;

export async function selectNftOwnershipTokenIdsByOwnerAddress(
  db: WebWalletApiDb,
  ownerAddress: string
): Promise<{ tokenId: number }[]> {
  return db
    .select({ tokenId: nftOwnership.tokenId })
    .from(nftOwnership)
    .where(eq(nftOwnership.ownerAddress, ownerAddress));
}

export type NftCollectionPortfolioRow = {
  tokenId: number;
  name: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  contractAddress: string;
};

export async function selectNftCollectionPortfolioRowsByTokenIds(
  db: WebWalletApiDb,
  tokenIds: number[]
): Promise<NftCollectionPortfolioRow[]> {
  if (tokenIds.length === 0) return [];
  return db
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      imageUrl: nftCollection.imageUrl,
      thumbnailUrl: nftCollection.thumbnailUrl,
      contractAddress: nftCollection.contractAddress,
    })
    .from(nftCollection)
    .where(inArray(nftCollection.tokenId, tokenIds));
}

export async function selectWalletTransferLogsForAddressOrderCreatedDescLimit(
  db: WebWalletApiDb,
  walletAddress: string,
  limit: number
): Promise<(typeof walletTransferLog.$inferSelect)[]> {
  return db
    .select()
    .from(walletTransferLog)
    .where(
      or(
        eq(walletTransferLog.fromAddress, walletAddress),
        eq(walletTransferLog.toAddress, walletAddress)
      )
    )
    .orderBy(desc(walletTransferLog.createdAt))
    .limit(limit);
}

export type WalletNftMintHistoryRow = {
  tokenId: number;
  claimerAddress: string;
  claimedAt: Date;
  txHash: string;
  nftName: string | null;
  nftImageUrl: string | null;
};

export async function selectNftMintHistoryRowsForClaimerOrderClaimedDescLimit(
  db: WebWalletApiDb,
  claimerAddress: string,
  limit: number
): Promise<WalletNftMintHistoryRow[]> {
  return db
    .select({
      tokenId: nftClaims.tokenId,
      claimerAddress: nftClaims.claimerAddress,
      claimedAt: nftClaims.claimedAt,
      txHash: nftClaims.txHash,
      nftName: nftCollection.name,
      nftImageUrl: nftCollection.imageUrl,
    })
    .from(nftClaims)
    .leftJoin(nftCollection, eq(nftClaims.tokenId, nftCollection.tokenId))
    .where(eq(nftClaims.claimerAddress, claimerAddress))
    .orderBy(desc(nftClaims.claimedAt))
    .limit(limit);
}

export type WalletNftOwnershipHistoryRow = {
  tokenId: number;
  ownerAddress: string;
  acquiredAt: Date;
  txHash: string | null;
  nftName: string | null;
  nftImageUrl: string | null;
};

export async function selectNftOwnershipHistoryRowsForOwnerOrderAcquiredDescLimit(
  db: WebWalletApiDb,
  ownerAddress: string,
  limit: number
): Promise<WalletNftOwnershipHistoryRow[]> {
  return db
    .select({
      tokenId: nftOwnership.tokenId,
      ownerAddress: nftOwnership.ownerAddress,
      acquiredAt: nftOwnership.acquiredAt,
      txHash: nftOwnership.txHash,
      nftName: nftCollection.name,
      nftImageUrl: nftCollection.imageUrl,
    })
    .from(nftOwnership)
    .leftJoin(nftCollection, eq(nftOwnership.tokenId, nftCollection.tokenId))
    .where(eq(nftOwnership.ownerAddress, ownerAddress))
    .orderBy(desc(nftOwnership.acquiredAt))
    .limit(limit);
}
