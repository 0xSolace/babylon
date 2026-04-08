/**
 * SQL for GET /api/nft/collection (gallery list, indexer + degraded DB paths).
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftCollection } from './tables/nft-collection';
import { nftOwnership } from './tables/nft-ownership';
import { users } from './tables/user';

type NftCollectionGalleryDb = DrizzleClient | Transaction;

export type NftCollectionGallerySort = 'tokenId' | 'name';
export type NftCollectionGalleryOrder = 'asc' | 'desc';

function nftCollectionSearchWhere(
  searchQuery: string | undefined
): SQL | undefined {
  const q = searchQuery?.trim();
  if (!q) return undefined;
  const tokenIdSearch = Number.parseInt(q, 10);
  if (!Number.isNaN(tokenIdSearch)) {
    return or(
      ilike(nftCollection.name, `%${q}%`),
      eq(nftCollection.tokenId, tokenIdSearch)
    )!;
  }
  return ilike(nftCollection.name, `%${q}%`);
}

function nftCollectionOrderBy(
  sort: NftCollectionGallerySort,
  order: NftCollectionGalleryOrder
) {
  const fn = order === 'desc' ? desc : asc;
  return sort === 'name' ? fn(nftCollection.name) : fn(nftCollection.tokenId);
}

/** All collection rows for in-memory filter/pagination (indexer path). */
export async function selectAllNftCollectionDisplayForGallery(
  db: NftCollectionGalleryDb,
  params: {
    searchQuery?: string;
    sort: NftCollectionGallerySort;
    order: NftCollectionGalleryOrder;
  }
) {
  const where = nftCollectionSearchWhere(params.searchQuery);
  const orderBy = nftCollectionOrderBy(params.sort, params.order);
  return db
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      thumbnailUrl: nftCollection.thumbnailUrl,
      imageUrl: nftCollection.imageUrl,
    })
    .from(nftCollection)
    .where(where)
    .orderBy(orderBy);
}

export type NftCollectionGalleryDegradedRow = {
  tokenId: number;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  ownerAddress: string | null;
  ownerUserId: string | null;
  ownerUsername: string | null;
  ownerDisplayName: string | null;
  ownerProfileImageUrl: string | null;
  acquiredAt: Date | null;
  txHash: string | null;
};

const degradedBaseSelect = {
  tokenId: nftCollection.tokenId,
  name: nftCollection.name,
  thumbnailUrl: nftCollection.thumbnailUrl,
  imageUrl: nftCollection.imageUrl,
  ownerAddress: nftOwnership.ownerAddress,
  ownerUserId: nftOwnership.userId,
  ownerUsername: users.username,
  ownerDisplayName: users.displayName,
  ownerProfileImageUrl: users.profileImageUrl,
  acquiredAt: nftOwnership.acquiredAt,
  txHash: nftOwnership.txHash,
};

/** Degraded mode: DB ownership with optional claimed filter and pagination. */
export async function selectNftCollectionGalleryDegradedPage(
  db: NftCollectionGalleryDb,
  params: {
    searchQuery?: string;
    sort: NftCollectionGallerySort;
    order: NftCollectionGalleryOrder;
    claimedFilter: string | null;
    limit: number;
    offset: number;
  }
): Promise<NftCollectionGalleryDegradedRow[]> {
  const collectionWhere = nftCollectionSearchWhere(params.searchQuery);
  const orderBy = nftCollectionOrderBy(params.sort, params.order);
  const { claimedFilter, limit, offset } = params;

  if (claimedFilter === 'true') {
    return db
      .select(degradedBaseSelect)
      .from(nftCollection)
      .innerJoin(nftOwnership, eq(nftCollection.tokenId, nftOwnership.tokenId))
      .leftJoin(users, eq(nftOwnership.userId, users.id))
      .where(collectionWhere)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
  }

  if (claimedFilter === 'false') {
    const unclaimedParts: SQL[] = [isNull(nftOwnership.tokenId)];
    if (collectionWhere) unclaimedParts.push(collectionWhere);
    return db
      .select(degradedBaseSelect)
      .from(nftCollection)
      .leftJoin(nftOwnership, eq(nftCollection.tokenId, nftOwnership.tokenId))
      .leftJoin(users, eq(nftOwnership.userId, users.id))
      .where(and(...unclaimedParts))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
  }

  return db
    .select(degradedBaseSelect)
    .from(nftCollection)
    .leftJoin(nftOwnership, eq(nftCollection.tokenId, nftOwnership.tokenId))
    .leftJoin(users, eq(nftOwnership.userId, users.id))
    .where(collectionWhere)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
}

export async function countNftCollectionForGallerySearch(
  db: NftCollectionGalleryDb,
  searchQuery: string | undefined
): Promise<number> {
  const where = nftCollectionSearchWhere(searchQuery);
  const [row] = await db
    .select({ c: count() })
    .from(nftCollection)
    .where(where);
  return Number(row?.c ?? 0);
}

export async function countNftOwnershipClaimedForGallerySearch(
  db: NftCollectionGalleryDb,
  searchQuery: string | undefined
): Promise<number> {
  const where = nftCollectionSearchWhere(searchQuery);
  const [row] = await db
    .select({ c: count() })
    .from(nftOwnership)
    .innerJoin(nftCollection, eq(nftCollection.tokenId, nftOwnership.tokenId))
    .where(where);
  return Number(row?.c ?? 0);
}
