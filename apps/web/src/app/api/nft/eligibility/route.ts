import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { db, eq, nftCollection, nftSnapshot } from '@babylon/db';
import { logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import type { EligibilityResponse } from '@/types/nft';

/** Fetch NFT info by tokenId, returns proxy image URL */
async function getNftInfo(tokenId: number) {
  const [nft] = await db
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      description: nftCollection.description,
    })
    .from(nftCollection)
    .where(eq(nftCollection.tokenId, tokenId))
    .limit(1);

  return nft ? { ...nft, thumbnailUrl: `/api/nft/image/${nft.tokenId}` } : null;
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  // Select only needed fields
  const [snap] = await db
    .select({
      rank: nftSnapshot.rank,
      points: nftSnapshot.points,
      snapshotTakenAt: nftSnapshot.snapshotTakenAt,
      assignedTokenId: nftSnapshot.assignedTokenId,
      hasMinted: nftSnapshot.hasMinted,
      mintedTokenId: nftSnapshot.mintedTokenId,
      mintTxHash: nftSnapshot.mintTxHash,
    })
    .from(nftSnapshot)
    .where(eq(nftSnapshot.userId, userId))
    .limit(1);

  // Not in top 100
  if (!snap) {
    return successResponse({
      eligible: false,
      status: 'not_eligible',
      hasMinted: false,
      reason: 'not_in_top_100',
    } satisfies EligibilityResponse);
  }

  const baseResponse = {
    snapshotRank: snap.rank,
    snapshotPoints: snap.points,
    snapshotTakenAt: snap.snapshotTakenAt.toISOString(),
  };

  // Already claimed
  if (snap.hasMinted && snap.mintedTokenId !== null) {
    const nft = await getNftInfo(snap.mintedTokenId);

    // Log warning if minted NFT not found in collection (data inconsistency)
    if (!nft) {
      logger.warn(
        'Minted NFT not found in collection',
        {
          userId,
          mintedTokenId: snap.mintedTokenId,
          mintTxHash: snap.mintTxHash,
        },
        'GET /api/nft/eligibility'
      );
    }

    return successResponse({
      eligible: true,
      status: 'already_minted',
      hasMinted: true,
      ...baseResponse,
      mintedNft: nft
        ? {
            tokenId: nft.tokenId,
            name: nft.name,
            thumbnailUrl: nft.thumbnailUrl,
            txHash: snap.mintTxHash ?? null,
          }
        : undefined,
    } satisfies EligibilityResponse);
  }

  // Eligible - fetch assigned NFT
  if (snap.assignedTokenId === null) {
    // No NFT assigned yet - treat as not eligible
    return successResponse({
      eligible: false,
      status: 'not_eligible',
      hasMinted: false,
      ...baseResponse,
      reason: 'no_nft_assigned',
    } satisfies EligibilityResponse);
  }

  const assignedNft = await getNftInfo(snap.assignedTokenId);
  if (!assignedNft) {
    // Assigned NFT not found in collection - treat as not eligible
    return successResponse({
      eligible: false,
      status: 'not_eligible',
      hasMinted: false,
      ...baseResponse,
      reason: 'assigned_nft_not_found',
    } satisfies EligibilityResponse);
  }

  return successResponse({
    eligible: true,
    status: 'eligible',
    hasMinted: false,
    ...baseResponse,
    assignedNft: {
      tokenId: assignedNft.tokenId,
      name: assignedNft.name,
      description: assignedNft.description,
      thumbnailUrl: assignedNft.thumbnailUrl,
    },
  } satisfies EligibilityResponse);
});
