import {
  authenticate,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NFTVerificationService,
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
import type { MintConfirmRequest, MintConfirmResponse } from '@/types/nft';

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS;
const NFT_CHAIN_ID = parseInt(process.env.NFT_CHAIN_ID ?? '1', 10);

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  const userId = authUser.dbUserId ?? authUser.userId;

  if (
    !NFT_CONTRACT_ADDRESS ||
    !ADDRESS_REGEX.test(NFT_CONTRACT_ADDRESS) ||
    NFT_CONTRACT_ADDRESS.toLowerCase() === ZERO_ADDRESS
  ) {
    throw new BadRequestError('NFT minting is not available yet');
  }

  if (Number.isNaN(NFT_CHAIN_ID) || NFT_CHAIN_ID <= 0) {
    throw new BadRequestError('Invalid NFT chain configuration');
  }

  const body = (await request.json()) as MintConfirmRequest;
  const { txHash, walletAddress } = body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    throw new BadRequestError('Invalid transaction hash');
  }

  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    throw new BadRequestError('Invalid wallet address');
  }

  const normalizedTxHash = txHash.toLowerCase();
  const normalizedWalletAddress = walletAddress.toLowerCase();

  const [user] = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.walletAddress) {
    throw new BadRequestError('No wallet connected');
  }

  if (user.walletAddress.toLowerCase() !== normalizedWalletAddress) {
    throw new ForbiddenError('Wallet mismatch');
  }

  const now = new Date();

  // Confirm on-chain mint before mutating DB.
  const verification = await NFTVerificationService.verifyMintTransaction(
    txHash,
    NFT_CONTRACT_ADDRESS,
    walletAddress,
    NFT_CHAIN_ID
  );

  if (!verification.valid || verification.tokenId === undefined) {
    throw new BadRequestError(
      verification.reason ?? 'Unable to verify mint transaction'
    );
  }

  const mintedTokenId = verification.tokenId;

  const result = await db.transaction(async (tx) => {
    // Check for transaction hash reuse across all users (prevent replay attacks)
    const [existingTxHash] = await tx
      .select({ userId: nftSnapshot.userId })
      .from(nftSnapshot)
      .where(eq(nftSnapshot.mintTxHash, normalizedTxHash))
      .limit(1);

    if (existingTxHash && existingTxHash.userId !== userId) {
      throw new ConflictError('Transaction hash already used by another user');
    }

    const [snapshotEntry] = await tx
      .select({
        id: nftSnapshot.id,
        userId: nftSnapshot.userId,
        rank: nftSnapshot.rank,
        points: nftSnapshot.points,
        hasMinted: nftSnapshot.hasMinted,
        mintedTokenId: nftSnapshot.mintedTokenId,
        mintTxHash: nftSnapshot.mintTxHash,
      })
      .from(nftSnapshot)
      .where(eq(nftSnapshot.userId, userId))
      .limit(1);

    if (!snapshotEntry) {
      throw new ForbiddenError('Not eligible');
    }

    if (snapshotEntry.hasMinted) {
      if (
        snapshotEntry.mintTxHash?.toLowerCase() === normalizedTxHash &&
        snapshotEntry.mintedTokenId !== null
      ) {
        const [existingNft] = await tx
          .select({
            tokenId: nftCollection.tokenId,
            name: nftCollection.name,
            imageUrl: nftCollection.imageUrl,
            thumbnailUrl: nftCollection.thumbnailUrl,
            storyTitle: nftCollection.storyTitle,
          })
          .from(nftCollection)
          .where(eq(nftCollection.tokenId, snapshotEntry.mintedTokenId))
          .limit(1);

        if (!existingNft) {
          throw new ConflictError('Already minted');
        }

        return { mintedNft: existingNft };
      }

      throw new ConflictError('Already minted');
    }

    const [mintedNft] = await tx
      .select({
        tokenId: nftCollection.tokenId,
        name: nftCollection.name,
        imageUrl: nftCollection.imageUrl,
        thumbnailUrl: nftCollection.thumbnailUrl,
        storyTitle: nftCollection.storyTitle,
      })
      .from(nftCollection)
      .where(eq(nftCollection.tokenId, mintedTokenId))
      .limit(1);

    if (!mintedNft) {
      throw new BadRequestError('Minted token is not part of this collection');
    }

    const [updatedSnapshot] = await tx
      .update(nftSnapshot)
      .set({
        hasMinted: true,
        mintedTokenId: mintedTokenId,
        mintedAt: now,
        mintTxHash: normalizedTxHash,
      })
      .where(
        and(eq(nftSnapshot.userId, userId), eq(nftSnapshot.hasMinted, false))
      )
      .returning({ id: nftSnapshot.id });

    if (!updatedSnapshot) {
      throw new ConflictError('Already minted');
    }

    try {
      await tx.insert(nftOwnership).values({
        id: nanoid(),
        tokenId: mintedTokenId,
        ownerAddress: normalizedWalletAddress,
        userId: userId,
        acquiredAt: now,
        txHash: normalizedTxHash,
        updatedAt: now,
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === '23505') {
        throw new ConflictError('NFT already claimed');
      }
      throw error;
    }

    try {
      await tx.insert(nftClaims).values({
        id: nanoid(),
        tokenId: mintedTokenId,
        claimerUserId: userId,
        claimerAddress: normalizedWalletAddress,
        claimedAt: now,
        txHash: normalizedTxHash,
        snapshotRank: snapshotEntry.rank,
        snapshotPoints: snapshotEntry.points,
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === '23505') {
        throw new ConflictError('NFT already claimed');
      }
      throw error;
    }

    return { mintedNft, snapshotEntry };
  });

  const { mintedNft } = result;

  return successResponse({
    success: true,
    tokenId: mintedNft.tokenId,
    nft: {
      tokenId: mintedNft.tokenId,
      name: mintedNft.name,
      imageUrl: mintedNft.imageUrl,
      thumbnailUrl: mintedNft.thumbnailUrl,
      storyTitle: mintedNft.storyTitle,
    },
  } satisfies MintConfirmResponse);
});
