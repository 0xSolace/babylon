/**
 * NFT Claim API (Simulated)
 *
 * Claims the pre-assigned NFT for an eligible user. Uses a simulated
 * transaction hash until real blockchain minting is implemented.
 */

import {
  authenticate,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import {
  and,
  db,
  eq,
  nftClaims,
  nftCollection,
  nftOwnership,
  nftSnapshot,
  users,
} from '@babylon/db';
import { nanoid } from 'nanoid';
import type { NextRequest } from 'next/server';

/** Build NFT response object with proxy image URLs */
function buildNftResponse(nft: {
  tokenId: number;
  name: string;
  description: string | null;
}) {
  const imageUrl = `/api/nft/image/${nft.tokenId}`;
  return { ...nft, imageUrl, thumbnailUrl: imageUrl };
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  // Get user's wallet
  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.walletAddress) {
    throw new BadRequestError('You must connect a wallet to claim your NFT');
  }

  const wallet = user.walletAddress.toLowerCase();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    // Get snapshot with assigned NFT
    const [snap] = await tx
      .select({
        rank: nftSnapshot.rank,
        points: nftSnapshot.points,
        assignedTokenId: nftSnapshot.assignedTokenId,
        hasMinted: nftSnapshot.hasMinted,
        mintedTokenId: nftSnapshot.mintedTokenId,
        mintTxHash: nftSnapshot.mintTxHash,
      })
      .from(nftSnapshot)
      .where(eq(nftSnapshot.userId, userId))
      .limit(1);

    if (!snap) throw new ForbiddenError('You are not eligible to claim an NFT');

    // Already claimed - return existing NFT info
    if (snap.hasMinted && snap.mintedTokenId !== null) {
      const [nft] = await tx
        .select({
          tokenId: nftCollection.tokenId,
          name: nftCollection.name,
          description: nftCollection.description,
        })
        .from(nftCollection)
        .where(eq(nftCollection.tokenId, snap.mintedTokenId))
        .limit(1);

      if (!nft) throw new ConflictError('You have already claimed your NFT');
      return {
        alreadyClaimed: true,
        nft: buildNftResponse(nft),
        txHash: snap.mintTxHash ?? null,
      };
    }

    if (snap.assignedTokenId === null) {
      throw new BadRequestError('No NFT has been assigned to you');
    }

    // Get assigned NFT
    const tokenId = snap.assignedTokenId;
    const [nft] = await tx
      .select({
        tokenId: nftCollection.tokenId,
        name: nftCollection.name,
        description: nftCollection.description,
      })
      .from(nftCollection)
      .where(eq(nftCollection.tokenId, tokenId))
      .limit(1);

    if (!nft) throw new BadRequestError('Assigned NFT not found');

    // Simulated tx hash
    const txHash = `simulated-${Date.now()}-${nanoid(8)}`;

    // Atomic update with optimistic lock
    const [updated] = await tx
      .update(nftSnapshot)
      .set({
        hasMinted: true,
        mintedTokenId: tokenId,
        mintedAt: now,
        mintTxHash: txHash,
      })
      .where(
        and(eq(nftSnapshot.userId, userId), eq(nftSnapshot.hasMinted, false))
      )
      .returning({ id: nftSnapshot.id });

    if (!updated) throw new ConflictError('Claim failed - please try again');

    // Create ownership + claim records
    await tx.insert(nftOwnership).values({
      id: nanoid(),
      tokenId,
      ownerAddress: wallet,
      userId,
      acquiredAt: now,
      txHash,
      updatedAt: now,
    });

    await tx.insert(nftClaims).values({
      id: nanoid(),
      tokenId,
      claimerUserId: userId,
      claimerAddress: wallet,
      claimedAt: now,
      txHash,
      snapshotRank: snap.rank,
      snapshotPoints: snap.points,
    });

    return { alreadyClaimed: false, nft: buildNftResponse(nft), txHash };
  });

  return successResponse({
    success: true,
    tokenId: result.nft.tokenId,
    nft: result.nft,
    txHash: result.txHash,
    message: result.alreadyClaimed
      ? 'You have already claimed this NFT'
      : 'NFT claimed successfully!',
  });
});
