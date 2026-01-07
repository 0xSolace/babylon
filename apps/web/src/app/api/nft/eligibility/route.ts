import { authenticate, successResponse, withErrorHandling } from '@babylon/api';
import { db, eq, nftCollection, nftSnapshot } from '@babylon/db';
import type { NextRequest } from 'next/server';
import type { EligibilityResponse } from '@/types/nft';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  const [snapshotEntry] = await db
    .select({
      id: nftSnapshot.id,
      userId: nftSnapshot.userId,
      walletAddress: nftSnapshot.walletAddress,
      rank: nftSnapshot.rank,
      points: nftSnapshot.points,
      snapshotTakenAt: nftSnapshot.snapshotTakenAt,
      assignedTokenId: nftSnapshot.assignedTokenId,
      hasMinted: nftSnapshot.hasMinted,
      mintedTokenId: nftSnapshot.mintedTokenId,
      mintedAt: nftSnapshot.mintedAt,
      mintTxHash: nftSnapshot.mintTxHash,
    })
    .from(nftSnapshot)
    .where(eq(nftSnapshot.userId, userId))
    .limit(1);

  if (!snapshotEntry) {
    return successResponse({
      eligible: false,
      status: 'not_eligible',
      hasMinted: false,
      reason: 'not_in_top_100',
    } satisfies EligibilityResponse);
  }

  // User has already claimed their NFT
  if (snapshotEntry.hasMinted && snapshotEntry.mintedTokenId !== null) {
    const [mintedNft] = await db
      .select({
        tokenId: nftCollection.tokenId,
        name: nftCollection.name,
        thumbnailUrl: nftCollection.thumbnailUrl,
      })
      .from(nftCollection)
      .where(eq(nftCollection.tokenId, snapshotEntry.mintedTokenId))
      .limit(1);

    return successResponse({
      eligible: true,
      status: 'already_minted',
      snapshotRank: snapshotEntry.rank,
      snapshotPoints: snapshotEntry.points,
      snapshotTakenAt: snapshotEntry.snapshotTakenAt.toISOString(),
      hasMinted: true,
      mintedNft: mintedNft
        ? {
            tokenId: mintedNft.tokenId,
            name: mintedNft.name,
            thumbnailUrl: `/api/nft/image/${mintedNft.tokenId}`,
            txHash: snapshotEntry.mintTxHash ?? '',
          }
        : undefined,
    } satisfies EligibilityResponse);
  }

  // User is eligible - fetch their pre-assigned NFT info
  let assignedNft: EligibilityResponse['assignedNft'] = undefined;

  if (snapshotEntry.assignedTokenId !== null) {
    const [nft] = await db
      .select({
        tokenId: nftCollection.tokenId,
        name: nftCollection.name,
        description: nftCollection.description,
        thumbnailUrl: nftCollection.thumbnailUrl,
      })
      .from(nftCollection)
      .where(eq(nftCollection.tokenId, snapshotEntry.assignedTokenId))
      .limit(1);

    if (nft) {
      assignedNft = {
        tokenId: nft.tokenId,
        name: nft.name,
        description: nft.description,
        thumbnailUrl: `/api/nft/image/${nft.tokenId}`,
      };
    }
  }

  return successResponse({
    eligible: true,
    status: 'eligible',
    snapshotRank: snapshotEntry.rank,
    snapshotPoints: snapshotEntry.points,
    snapshotTakenAt: snapshotEntry.snapshotTakenAt.toISOString(),
    hasMinted: false,
    assignedNft,
  } satisfies EligibilityResponse);
});
