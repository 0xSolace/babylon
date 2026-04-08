/**
 * SQL for GET /api/nft/[tokenId] (collection row, DB ownership fallback, claim row).
 */

import { eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftClaims } from './tables/nft-claims';
import { nftCollection } from './tables/nft-collection';
import { nftOwnership } from './tables/nft-ownership';
import { users } from './tables/user';

type NftDetailDb = DrizzleClient | Transaction;

export type NftCollectionDetailRow = {
  tokenId: number;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  imageCid: string | null;
  storyTitle: string | null;
  storyContent: string | null;
  metadataUri: string | null;
  attributes: Array<{ trait_type: string; value: string | number }> | null;
  contractAddress: string;
  chainId: number;
};

export async function selectNftCollectionDetailRowByTokenId(
  db: NftDetailDb,
  tokenId: number
): Promise<NftCollectionDetailRow | undefined> {
  const [row] = await db
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      description: nftCollection.description,
      imageUrl: nftCollection.imageUrl,
      thumbnailUrl: nftCollection.thumbnailUrl,
      imageCid: nftCollection.imageCid,
      storyTitle: nftCollection.storyTitle,
      storyContent: nftCollection.storyContent,
      metadataUri: nftCollection.metadataUri,
      attributes: nftCollection.attributes,
      contractAddress: nftCollection.contractAddress,
      chainId: nftCollection.chainId,
    })
    .from(nftCollection)
    .where(eq(nftCollection.tokenId, tokenId))
    .limit(1);
  return row;
}

export type NftDetailOwnershipDbRow = {
  ownerAddress: string;
  userId: string | null;
  acquiredAt: Date;
  txHash: string | null;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
};

export async function selectNftOwnershipWithUserSliceByTokenId(
  db: NftDetailDb,
  tokenId: number
): Promise<NftDetailOwnershipDbRow | undefined> {
  const [row] = await db
    .select({
      ownerAddress: nftOwnership.ownerAddress,
      userId: nftOwnership.userId,
      acquiredAt: nftOwnership.acquiredAt,
      txHash: nftOwnership.txHash,
      username: users.username,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(nftOwnership)
    .leftJoin(users, eq(nftOwnership.userId, users.id))
    .where(eq(nftOwnership.tokenId, tokenId))
    .limit(1);
  return row;
}

export type NftDetailClaimDbRow = {
  claimedAt: Date;
  claimerAddress: string;
  claimerUserId: string | null;
  snapshotRank: number | null;
  snapshotPoints: number | null;
  txHash: string;
};

export async function selectNftClaimRowByTokenId(
  db: NftDetailDb,
  tokenId: number
): Promise<NftDetailClaimDbRow | undefined> {
  const [row] = await db
    .select({
      claimedAt: nftClaims.claimedAt,
      claimerAddress: nftClaims.claimerAddress,
      claimerUserId: nftClaims.claimerUserId,
      snapshotRank: nftClaims.snapshotRank,
      snapshotPoints: nftClaims.snapshotPoints,
      txHash: nftClaims.txHash,
    })
    .from(nftClaims)
    .where(eq(nftClaims.tokenId, tokenId))
    .limit(1);
  return row;
}
