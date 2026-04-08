/**
 * SQL for GET /api/nft/holdings (collection metadata rows for token ids).
 */

import { inArray } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftCollection } from './tables/nft-collection';

type NftHoldingsDb = DrizzleClient | Transaction;

export type NftCollectionDisplayRow = {
  tokenId: number;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
};

export async function selectNftCollectionDisplayRowsByTokenIds(
  db: NftHoldingsDb,
  tokenIds: number[]
): Promise<NftCollectionDisplayRow[]> {
  if (tokenIds.length === 0) {
    return [];
  }
  return db
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      thumbnailUrl: nftCollection.thumbnailUrl,
      imageUrl: nftCollection.imageUrl,
    })
    .from(nftCollection)
    .where(inArray(nftCollection.tokenId, tokenIds));
}
