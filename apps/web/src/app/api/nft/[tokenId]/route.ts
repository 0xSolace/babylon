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
  NotFoundError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  db,
  eq,
  nftClaims,
  nftCollection,
  nftOwnership,
  users,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import type { NftDetail, NftDetailResponse } from '@/types/nft';

interface RouteParams {
  params: Promise<{ tokenId: string }>;
}

export const GET = withErrorHandling(
  async (_request: NextRequest, context: RouteParams) => {
    const { tokenId: tokenIdParam } = await context.params;
    const tokenId = parseInt(tokenIdParam, 10);

    if (isNaN(tokenId) || tokenId < 0) {
      throw new NotFoundError('Invalid token ID');
    }

    logger.info('Fetching NFT details', { tokenId }, 'GET /api/nft/[tokenId]');

    // Single consolidated query with LEFT JOINs for ownership and claims
    const [result] = await db
      .select({
        // NFT collection fields
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
        // Ownership fields (nullable due to LEFT JOIN)
        ownerAddress: nftOwnership.ownerAddress,
        ownerUserId: nftOwnership.userId,
        acquiredAt: nftOwnership.acquiredAt,
        ownerTxHash: nftOwnership.txHash,
        ownerUsername: users.username,
        ownerDisplayName: users.displayName,
        ownerProfileImageUrl: users.profileImageUrl,
        // Claim fields (nullable due to LEFT JOIN)
        claimedAt: nftClaims.claimedAt,
        claimerAddress: nftClaims.claimerAddress,
        claimerUserId: nftClaims.claimerUserId,
        snapshotRank: nftClaims.snapshotRank,
        snapshotPoints: nftClaims.snapshotPoints,
        claimTxHash: nftClaims.txHash,
      })
      .from(nftCollection)
      .leftJoin(nftOwnership, eq(nftCollection.tokenId, nftOwnership.tokenId))
      .leftJoin(users, eq(nftOwnership.userId, users.id))
      .leftJoin(nftClaims, eq(nftCollection.tokenId, nftClaims.tokenId))
      .where(eq(nftCollection.tokenId, tokenId))
      .limit(1);

    if (!result) {
      throw new NotFoundError(`NFT with token ID ${tokenId} not found`);
    }

    // Destructure for clarity
    const nft = result;
    const ownership = result.ownerAddress
      ? {
          ownerAddress: result.ownerAddress,
          userId: result.ownerUserId,
          acquiredAt: result.acquiredAt!,
          txHash: result.ownerTxHash,
          username: result.ownerUsername,
          displayName: result.ownerDisplayName,
          profileImageUrl: result.ownerProfileImageUrl,
        }
      : null;
    const claim = result.claimedAt
      ? {
          claimedAt: result.claimedAt,
          claimerAddress: result.claimerAddress!,
          claimerUserId: result.claimerUserId,
          snapshotRank: result.snapshotRank,
          snapshotPoints: result.snapshotPoints,
          txHash: result.claimTxHash!,
        }
      : null;

    // Build response - use proxy API URLs for reliable image serving
    const imageUrl = `/api/nft/image/${nft.tokenId}`;
    const nftDetail: NftDetail = {
      tokenId: nft.tokenId,
      name: nft.name,
      description: nft.description,
      imageUrl,
      thumbnailUrl: imageUrl,
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
            user: ownership.userId
              ? {
                  id: ownership.userId,
                  username: ownership.username,
                  displayName: ownership.displayName,
                  profileImageUrl: ownership.profileImageUrl,
                }
              : null,
            acquiredAt: ownership.acquiredAt.toISOString(),
            txHash: ownership.txHash,
          }
        : null,
      originalClaim: claim
        ? {
            claimedAt: claim.claimedAt.toISOString(),
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

    return successResponse(response);
  }
);
