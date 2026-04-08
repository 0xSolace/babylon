/**
 * Single NFT Detail API
 *
 * @route GET /api/nft/[tokenId]
 * @access Public
 *
 * @description
 * Returns complete details for a single NFT including metadata, story,
 * attributes, current owner, and original claim information.
 * This endpoint is public - no authentication required.
 */

import {
  addPublicReadHeaders,
  getNftTokenOwnersFromIndexer,
  getOwnerUsersByWalletAddresses,
  NftIndexerUnavailableError,
  NotFoundError,
  publicRateLimit,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  selectNftClaimRowByTokenId,
  selectNftCollectionDetailRowByTokenId,
  selectNftOwnershipWithUserSliceByTokenId,
} from '@babylon/db';
import { logger, toISO } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { runWithOptionalUserRls } from '@/lib/db/run-with-optional-user-rls';
import type { NftDetail, NftDetailResponse } from '@/types/nft';

interface RouteParams {
  params: Promise<{ tokenId: string }>;
}

export const GET = withErrorHandling(
  async (request: NextRequest, context: RouteParams) => {
    const {
      error,
      rateLimitInfo,
      user: viewer,
    } = await publicRateLimit(request);
    if (error) return error;

    const { tokenId: tokenIdParam } = await context.params;
    const tokenId = parseInt(tokenIdParam, 10);

    if (isNaN(tokenId) || tokenId < 0) {
      throw new NotFoundError('Invalid token ID');
    }

    return runWithOptionalUserRls(viewer, async (db) => {
      logger.info(
        'Fetching NFT details',
        { tokenId },
        'GET /api/nft/[tokenId]'
      );

      const nft = await selectNftCollectionDetailRowByTokenId(db, tokenId);

      if (!nft) {
        throw new NotFoundError(`NFT with token ID ${tokenId} not found`);
      }

      // Get current ownership (prefer indexer, fallback to DB ownership)
      let ownership: {
        ownerAddress: string;
        user: {
          id: string;
          username: string | null;
          displayName: string | null;
          profileImageUrl: string | null;
        } | null;
        acquiredAt: string;
        txHash: string | null;
      } | null = null;

      try {
        const owners = await getNftTokenOwnersFromIndexer([tokenId]);
        const owner = owners.get(tokenId) ?? null;
        if (owner) {
          const ownerUsers = await getOwnerUsersByWalletAddresses([
            owner.ownerAddress,
          ]);
          const user = ownerUsers.get(owner.ownerAddress) ?? null;
          ownership = {
            ownerAddress: owner.ownerAddress,
            user,
            acquiredAt: owner.acquiredAt,
            txHash: null,
          };
        }
      } catch (error) {
        if (
          !(error instanceof NftIndexerUnavailableError) &&
          !(error instanceof Error && error.name === 'ValidationError')
        ) {
          throw error;
        }

        const dbOwnership = await selectNftOwnershipWithUserSliceByTokenId(
          db,
          tokenId
        );

        ownership = dbOwnership
          ? {
              ownerAddress: dbOwnership.ownerAddress,
              user: dbOwnership.userId
                ? {
                    id: dbOwnership.userId,
                    username: dbOwnership.username,
                    displayName: dbOwnership.displayName,
                    profileImageUrl: dbOwnership.profileImageUrl,
                  }
                : null,
              acquiredAt: toISO(dbOwnership.acquiredAt),
              txHash: dbOwnership.txHash,
            }
          : null;
      }

      const claim = await selectNftClaimRowByTokenId(db, tokenId);

      // Build response
      const nftDetail: NftDetail = {
        tokenId: nft.tokenId,
        name: nft.name,
        description: nft.description,
        imageUrl: nft.imageUrl,
        thumbnailUrl: nft.thumbnailUrl,
        imageCid: nft.imageCid,
        imageResolution: '4096x4096',
        metadataUri: nft.metadataUri,
        story: {
          title: nft.storyTitle,
          content: nft.storyContent,
        },
        attributes:
          (nft.attributes as Array<{
            trait_type: string;
            value: string | number;
          }>) ?? [],
        contractAddress: nft.contractAddress,
        chainId: nft.chainId,
        currentOwner: ownership
          ? {
              walletAddress: ownership.ownerAddress,
              user: ownership.user,
              acquiredAt: ownership.acquiredAt,
              txHash: ownership.txHash,
            }
          : null,
        originalClaim: claim
          ? {
              claimedAt: toISO(claim.claimedAt),
              claimerAddress: claim.claimerAddress,
              claimerUserId: claim.claimerUserId,
              snapshotRank: claim.snapshotRank,
              snapshotPoints: claim.snapshotPoints,
              txHash: claim.txHash,
            }
          : null,
      };

      const response: NftDetailResponse = {
        success: true,
        data: nftDetail,
      };

      logger.info(
        'NFT details fetched',
        {
          tokenId,
          hasOwner: !!ownership,
          hasClaim: !!claim,
        },
        'GET /api/nft/[tokenId]'
      );

      const res = successResponse(response);
      if (rateLimitInfo) addPublicReadHeaders(res, rateLimitInfo);
      return res;
    });
  }
);
