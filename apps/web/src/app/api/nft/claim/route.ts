/**
 * NFT Claim API (Simulated)
 *
 * @route POST /api/nft/claim
 * @access Authenticated users only
 *
 * @description
 * Claims the pre-assigned NFT for an eligible user. In this simulated version,
 * no real blockchain transaction is required - the claim is recorded directly
 * in the database with a placeholder transaction hash.
 *
 * When real minting is implemented, this endpoint will:
 * 1. Prepare the mint transaction data
 * 2. Wait for user to sign and submit
 * 3. Verify the on-chain transaction
 * 4. Record the claim
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

interface ClaimResponse {
  success: boolean;
  tokenId: number;
  nft: {
    tokenId: number;
    name: string;
    description: string | null;
    imageUrl: string;
    thumbnailUrl: string;
  };
  txHash: string;
  message: string;
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  // Get user's wallet address
  const [user] = await db
    .select({ id: users.id, walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.walletAddress) {
    throw new BadRequestError('You must connect a wallet to claim your NFT');
  }

  const normalizedWalletAddress = user.walletAddress.toLowerCase();
  const now = new Date();

  // Perform claim in a transaction
  const result = await db.transaction(async (tx) => {
    // Get snapshot entry with assigned NFT
    const [snapshotEntry] = await tx
      .select({
        id: nftSnapshot.id,
        userId: nftSnapshot.userId,
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

    if (!snapshotEntry) {
      throw new ForbiddenError('You are not eligible to claim an NFT');
    }

    // Check if already claimed
    if (snapshotEntry.hasMinted) {
      if (snapshotEntry.mintedTokenId !== null) {
        // Return existing claim info
        const [existingNft] = await tx
          .select({
            tokenId: nftCollection.tokenId,
            name: nftCollection.name,
            description: nftCollection.description,
            imageUrl: nftCollection.imageUrl,
          })
          .from(nftCollection)
          .where(eq(nftCollection.tokenId, snapshotEntry.mintedTokenId))
          .limit(1);

        if (existingNft) {
          return {
            alreadyClaimed: true,
            nft: {
              tokenId: existingNft.tokenId,
              name: existingNft.name,
              description: existingNft.description,
              imageUrl: `/api/nft/image/${existingNft.tokenId}`,
              thumbnailUrl: `/api/nft/image/${existingNft.tokenId}`,
            },
            txHash: snapshotEntry.mintTxHash ?? 'simulated-0x0',
          };
        }
      }
      throw new ConflictError('You have already claimed your NFT');
    }

    // Check if user has an assigned NFT
    if (snapshotEntry.assignedTokenId === null) {
      throw new BadRequestError('No NFT has been assigned to you');
    }

    const assignedTokenId = snapshotEntry.assignedTokenId;

    // Get the assigned NFT details
    const [assignedNft] = await tx
      .select({
        tokenId: nftCollection.tokenId,
        name: nftCollection.name,
        description: nftCollection.description,
        imageUrl: nftCollection.imageUrl,
      })
      .from(nftCollection)
      .where(eq(nftCollection.tokenId, assignedTokenId))
      .limit(1);

    if (!assignedNft) {
      throw new BadRequestError('Assigned NFT not found in collection');
    }

    // Generate simulated transaction hash
    // Format: simulated-{timestamp}-{random}
    const simulatedTxHash = `simulated-${Date.now()}-${nanoid(8)}`;

    // Update snapshot to mark as minted
    const [updatedSnapshot] = await tx
      .update(nftSnapshot)
      .set({
        hasMinted: true,
        mintedTokenId: assignedTokenId,
        mintedAt: now,
        mintTxHash: simulatedTxHash,
      })
      .where(
        and(eq(nftSnapshot.userId, userId), eq(nftSnapshot.hasMinted, false))
      )
      .returning({ id: nftSnapshot.id });

    if (!updatedSnapshot) {
      throw new ConflictError('Claim failed - please try again');
    }

    // Create ownership record
    await tx.insert(nftOwnership).values({
      id: nanoid(),
      tokenId: assignedTokenId,
      ownerAddress: normalizedWalletAddress,
      userId: userId,
      acquiredAt: now,
      txHash: simulatedTxHash,
      updatedAt: now,
    });

    // Create claim record (provenance)
    await tx.insert(nftClaims).values({
      id: nanoid(),
      tokenId: assignedTokenId,
      claimerUserId: userId,
      claimerAddress: normalizedWalletAddress,
      claimedAt: now,
      txHash: simulatedTxHash,
      snapshotRank: snapshotEntry.rank,
      snapshotPoints: snapshotEntry.points,
    });

    return {
      alreadyClaimed: false,
      nft: {
        tokenId: assignedNft.tokenId,
        name: assignedNft.name,
        description: assignedNft.description,
        imageUrl: `/api/nft/image/${assignedNft.tokenId}`,
        thumbnailUrl: `/api/nft/image/${assignedNft.tokenId}`,
      },
      txHash: simulatedTxHash,
    };
  });

  const response: ClaimResponse = {
    success: true,
    tokenId: result.nft.tokenId,
    nft: result.nft,
    txHash: result.txHash,
    message: result.alreadyClaimed
      ? 'You have already claimed this NFT'
      : 'NFT claimed successfully! (Simulated - real minting coming soon)',
  };

  return successResponse(response);
});
