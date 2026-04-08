import {
  addPublicReadHeaders,
  getOwnerUsersByWalletAddresses,
  NftIndexerUnavailableError,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { getNftTokenOwnersFromIndexer } from '@babylon/api/services/nft-indexer-service';
import {
  countNftCollectionForGallerySearch,
  countNftOwnershipClaimedForGallerySearch,
  selectAllNftCollectionDisplayForGallery,
  selectNftCollectionGalleryDegradedPage,
} from '@babylon/db';
import { logger, toISOOrNull } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';
import type { NftGalleryResponse, NftSummary } from '@/types/nft';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { error, rateLimitInfo, user: viewer } = await publicRateLimit(request);
  if (error) return error;

  return runWithOptionalUserRls(viewer, async (db) => {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
      )
    );
    const sort = (searchParams.get('sort') ?? 'tokenId') as 'tokenId' | 'name';
    const order = (searchParams.get('order') ?? 'asc') as 'asc' | 'desc';
    const claimedFilter = searchParams.get('claimed');
    const searchQuery = searchParams.get('search')?.trim();
    const offset = (page - 1) * limit;

    // Prefer indexer-based ownership (secondary transfers included). Fall back to DB
    // ownership when the indexer is unavailable or not configured (local tests/dev).
    try {
      const allNfts = await selectAllNftCollectionDisplayForGallery(db, {
        searchQuery,
        sort,
        order,
      });

      const allTokenIds = allNfts.map((n) => n.tokenId);
      const ownersByTokenId = await getNftTokenOwnersFromIndexer(allTokenIds);
      const ownerAddresses = Array.from(ownersByTokenId.values()).map(
        (o) => o.ownerAddress
      );
      const ownerUsersByAddress =
        await getOwnerUsersByWalletAddresses(ownerAddresses);

      const totalNfts = allNfts.length;
      const claimedCount = ownersByTokenId.size;
      const unclaimedCount = totalNfts - claimedCount;

      const filtered =
        claimedFilter === 'true'
          ? allNfts.filter((n) => ownersByTokenId.has(n.tokenId))
          : claimedFilter === 'false'
            ? allNfts.filter((n) => !ownersByTokenId.has(n.tokenId))
            : allNfts;

      const paged = filtered.slice(offset, offset + limit);

      const nfts: NftSummary[] = paged.map((nft) => {
        const owner = ownersByTokenId.get(nft.tokenId);
        const user = owner ? ownerUsersByAddress.get(owner.ownerAddress) : null;

        return {
          tokenId: nft.tokenId,
          name: nft.name,
          thumbnailUrl: nft.thumbnailUrl ?? nft.imageUrl ?? '',
          imageUrl: nft.imageUrl ?? '',
          owner: owner
            ? {
                walletAddress: owner.ownerAddress,
                user: user
                  ? {
                      id: user.id,
                      username: user.username,
                      displayName: user.displayName,
                      profileImageUrl: user.profileImageUrl,
                    }
                  : null,
                acquiredAt: owner.acquiredAt,
                txHash: null,
              }
            : null,
        };
      });

      const filteredTotal =
        claimedFilter === 'true'
          ? claimedCount
          : claimedFilter === 'false'
            ? unclaimedCount
            : totalNfts;

      const res = successResponse(
        {
          success: true,
          data: {
            nfts,
            pagination: {
              page,
              limit,
              total: filteredTotal,
              totalPages: Math.ceil(filteredTotal / limit),
            },
            stats: { totalNfts, claimedCount, unclaimedCount },
            filters: { traits: [] },
          },
        } satisfies NftGalleryResponse,
        200,
        {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        }
      );
      if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
      return res;
    } catch (error) {
      if (
        error instanceof NftIndexerUnavailableError ||
        (error instanceof Error && error.name === 'ValidationError')
      ) {
        // Fall back to DB ownership for local/testing/degraded mode.
        logger.warn(
          'NFT indexer unavailable for collection, falling back to DB ownership',
          { error: error instanceof Error ? error.message : error },
          'GET /api/nft/collection'
        );
      } else {
        throw error;
      }
    }

    // Degraded mode: DB-based ownership (mint-only).
    const nftsResult = await selectNftCollectionGalleryDegradedPage(db, {
      searchQuery,
      sort,
      order,
      claimedFilter,
      limit,
      offset,
    });

    const nfts: NftSummary[] = nftsResult.map((nft) => ({
      tokenId: nft.tokenId,
      name: nft.name,
      thumbnailUrl: nft.thumbnailUrl ?? nft.imageUrl ?? '',
      imageUrl: nft.imageUrl ?? '',
      owner: nft.ownerAddress
        ? {
            walletAddress: nft.ownerAddress,
            user: nft.ownerUserId
              ? {
                  id: nft.ownerUserId,
                  username: nft.ownerUsername,
                  displayName: nft.ownerDisplayName,
                  profileImageUrl: nft.ownerProfileImageUrl,
                }
              : null,
            acquiredAt: toISOOrNull(nft.acquiredAt) ?? new Date().toISOString(),
            txHash: nft.txHash,
          }
        : null,
    }));

    // Counts in degraded mode (DB-based ownership).
    const totalNfts = await countNftCollectionForGallerySearch(db, searchQuery);
    const claimedCount = await countNftOwnershipClaimedForGallerySearch(
      db,
      searchQuery
    );
    const unclaimedCount = totalNfts - claimedCount;

    const filteredTotal =
      claimedFilter === 'true'
        ? claimedCount
        : claimedFilter === 'false'
          ? unclaimedCount
          : totalNfts;

    const res = successResponse(
      {
        success: true,
        data: {
          nfts,
          pagination: {
            page,
            limit,
            total: filteredTotal,
            totalPages: Math.ceil(filteredTotal / limit),
          },
          stats: { totalNfts, claimedCount, unclaimedCount },
          filters: { traits: [] },
        },
      } satisfies NftGalleryResponse,
      200,
      {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      }
    );
    if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
    return res;
  });
});
