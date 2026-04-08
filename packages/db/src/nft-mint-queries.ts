/**
 * DB access for `nft-mint-service` (ProtoMonkeys snapshot / ownership / claims / collection).
 */

import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from './client';
import type { Transaction } from './db';
import { nftClaims } from './tables/nft-claims';
import { nftCollection } from './tables/nft-collection';
import { nftOwnership } from './tables/nft-ownership';
import { nftSnapshot } from './tables/nft-snapshot';
import { users } from './tables/user';

type MintDb = DrizzleClient | Transaction;

export async function selectUserPrivyIdsForMint(
  db: MintDb,
  dbUserId: string
): Promise<
  { privyId: string | null; privyWalletId: string | null } | undefined
> {
  const [user] = await db
    .select({
      privyId: users.privyId,
      privyWalletId: users.privyWalletId,
    })
    .from(users)
    .where(eq(users.id, dbUserId))
    .limit(1);
  return user;
}

export type NftSnapshotEligibilityRow = {
  id: string;
  userId: string;
  walletAddress: string | null;
  rank: number;
  points: number;
  snapshotTakenAt: Date;
  hasMinted: boolean;
  mintedTokenId: number | null;
  mintTxHash: string | null;
};

export async function selectNftSnapshotForEligibility(
  db: MintDb,
  userId: string
): Promise<NftSnapshotEligibilityRow | undefined> {
  const [row] = await db
    .select({
      id: nftSnapshot.id,
      userId: nftSnapshot.userId,
      walletAddress: nftSnapshot.walletAddress,
      rank: nftSnapshot.rank,
      points: nftSnapshot.points,
      snapshotTakenAt: nftSnapshot.snapshotTakenAt,
      hasMinted: nftSnapshot.hasMinted,
      mintedTokenId: nftSnapshot.mintedTokenId,
      mintTxHash: nftSnapshot.mintTxHash,
    })
    .from(nftSnapshot)
    .where(eq(nftSnapshot.userId, userId))
    .limit(1);
  return row;
}

export type NftCollectionPreviewRow = {
  tokenId: number;
  name: string;
  thumbnailUrl: string | null;
  imageUrl: string;
};

export async function selectNftCollectionPreviewByTokenId(
  db: MintDb,
  tokenId: number
): Promise<NftCollectionPreviewRow | undefined> {
  const [row] = await db
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      thumbnailUrl: nftCollection.thumbnailUrl,
      imageUrl: nftCollection.imageUrl,
    })
    .from(nftCollection)
    .where(eq(nftCollection.tokenId, tokenId))
    .limit(1);
  return row;
}

export async function selectUserPrivyWalletIdOnly(
  db: MintDb,
  userId: string
): Promise<{ privyWalletId: string | null } | undefined> {
  const [row] = await db
    .select({ privyWalletId: users.privyWalletId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

export async function selectNftSnapshotMintFields(
  db: MintDb,
  userId: string
): Promise<
  { mintedTokenId: number | null; mintTxHash: string | null } | undefined
> {
  const [row] = await db
    .select({
      mintedTokenId: nftSnapshot.mintedTokenId,
      mintTxHash: nftSnapshot.mintTxHash,
    })
    .from(nftSnapshot)
    .where(eq(nftSnapshot.userId, userId))
    .limit(1);
  return row;
}

/**
 * Reconcile on-chain mint into snapshot / ownership / claims (single DB transaction).
 */
export async function reconcileProtoMonkeysMintInTx(
  tx: Transaction,
  args: {
    userId: string;
    normalizedWallet: string;
    mintedTokenId: number;
    txHash: string;
    blockNumber: bigint;
    now: Date;
    newOwnershipId: string;
    newClaimId: string;
  }
): Promise<void> {
  await tx
    .update(nftSnapshot)
    .set({
      hasMinted: true,
      mintedTokenId: args.mintedTokenId,
      mintedAt: args.now,
      mintTxHash: args.txHash,
    })
    .where(
      and(eq(nftSnapshot.userId, args.userId), eq(nftSnapshot.hasMinted, false))
    );

  const [existingOwnership] = await tx
    .select({ id: nftOwnership.id })
    .from(nftOwnership)
    .where(eq(nftOwnership.tokenId, args.mintedTokenId))
    .limit(1);

  if (existingOwnership) {
    await tx
      .update(nftOwnership)
      .set({
        ownerAddress: args.normalizedWallet,
        userId: args.userId,
        acquiredAt: args.now,
        txHash: args.txHash,
        blockNumber: args.blockNumber,
        updatedAt: args.now,
      })
      .where(eq(nftOwnership.tokenId, args.mintedTokenId));
  } else {
    await tx.insert(nftOwnership).values({
      id: args.newOwnershipId,
      tokenId: args.mintedTokenId,
      ownerAddress: args.normalizedWallet,
      userId: args.userId,
      acquiredAt: args.now,
      txHash: args.txHash,
      blockNumber: args.blockNumber,
      updatedAt: args.now,
    });
  }

  const [snapshotEntry] = await tx
    .select({ rank: nftSnapshot.rank, points: nftSnapshot.points })
    .from(nftSnapshot)
    .where(eq(nftSnapshot.userId, args.userId))
    .limit(1);

  const [existingClaim] = await tx
    .select({ id: nftClaims.id })
    .from(nftClaims)
    .where(eq(nftClaims.tokenId, args.mintedTokenId))
    .limit(1);

  if (existingClaim) {
    await tx
      .update(nftClaims)
      .set({
        claimerUserId: args.userId,
        claimerAddress: args.normalizedWallet,
        claimedAt: args.now,
        txHash: args.txHash,
        snapshotRank: snapshotEntry?.rank ?? null,
        snapshotPoints: snapshotEntry?.points ?? null,
      })
      .where(eq(nftClaims.tokenId, args.mintedTokenId));
  } else {
    await tx.insert(nftClaims).values({
      id: args.newClaimId,
      tokenId: args.mintedTokenId,
      claimerUserId: args.userId,
      claimerAddress: args.normalizedWallet,
      claimedAt: args.now,
      txHash: args.txHash,
      snapshotRank: snapshotEntry?.rank ?? null,
      snapshotPoints: snapshotEntry?.points ?? null,
    });
  }
}

export type NftSnapshotConfirmRow = {
  id: string;
  rank: number;
  points: number;
  hasMinted: boolean;
};

export async function selectNftSnapshotForConfirm(
  tx: Transaction,
  userId: string
): Promise<NftSnapshotConfirmRow | undefined> {
  const [row] = await tx
    .select({
      id: nftSnapshot.id,
      rank: nftSnapshot.rank,
      points: nftSnapshot.points,
      hasMinted: nftSnapshot.hasMinted,
    })
    .from(nftSnapshot)
    .where(eq(nftSnapshot.userId, userId))
    .limit(1);
  return row;
}

export async function selectNftOwnershipIdByToken(
  tx: Transaction,
  tokenId: number
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .select({ id: nftOwnership.id })
    .from(nftOwnership)
    .where(eq(nftOwnership.tokenId, tokenId))
    .limit(1);
  return row;
}

export async function updateNftOwnershipForMint(
  tx: Transaction,
  args: {
    tokenId: number;
    normalizedWallet: string;
    userId: string;
    now: Date;
    txHash: string;
    blockNumber: bigint;
  }
): Promise<void> {
  await tx
    .update(nftOwnership)
    .set({
      ownerAddress: args.normalizedWallet,
      userId: args.userId,
      acquiredAt: args.now,
      txHash: args.txHash,
      blockNumber: args.blockNumber,
      updatedAt: args.now,
    })
    .where(eq(nftOwnership.tokenId, args.tokenId));
}

export async function insertNftOwnershipForMint(
  tx: Transaction,
  args: {
    id: string;
    tokenId: number;
    normalizedWallet: string;
    userId: string;
    now: Date;
    txHash: string;
    blockNumber: bigint;
  }
): Promise<void> {
  await tx.insert(nftOwnership).values({
    id: args.id,
    tokenId: args.tokenId,
    ownerAddress: args.normalizedWallet,
    userId: args.userId,
    acquiredAt: args.now,
    txHash: args.txHash,
    blockNumber: args.blockNumber,
    updatedAt: args.now,
  });
}

export async function insertNftClaimForMint(
  tx: Transaction,
  args: {
    id: string;
    tokenId: number;
    userId: string;
    normalizedWallet: string;
    now: Date;
    txHash: string;
    rank: number;
    points: number;
  }
): Promise<void> {
  await tx.insert(nftClaims).values({
    id: args.id,
    tokenId: args.tokenId,
    claimerUserId: args.userId,
    claimerAddress: args.normalizedWallet,
    claimedAt: args.now,
    txHash: args.txHash,
    snapshotRank: args.rank,
    snapshotPoints: args.points,
  });
}

export async function markNftSnapshotMintedForUser(
  tx: Transaction,
  args: {
    userId: string;
    mintedTokenId: number;
    now: Date;
    txHash: string;
  }
): Promise<void> {
  await tx
    .update(nftSnapshot)
    .set({
      hasMinted: true,
      mintedTokenId: args.mintedTokenId,
      mintedAt: args.now,
      mintTxHash: args.txHash,
    })
    .where(eq(nftSnapshot.userId, args.userId));
}

export type NftCollectionConfirmRow = {
  tokenId: number;
  name: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  storyTitle: string | null;
};

export async function selectNftCollectionConfirmRow(
  tx: Transaction,
  tokenId: number
): Promise<NftCollectionConfirmRow | undefined> {
  const [row] = await tx
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      imageUrl: nftCollection.imageUrl,
      thumbnailUrl: nftCollection.thumbnailUrl,
      storyTitle: nftCollection.storyTitle,
    })
    .from(nftCollection)
    .where(eq(nftCollection.tokenId, tokenId))
    .limit(1);
  return row;
}

export type NftMetadataRow = {
  tokenId: number;
  name: string;
  description: string | null;
  imageUrl: string;
  attributes: Array<{ trait_type: string; value: string | number }> | null;
  storyTitle: string | null;
  storyContent: string | null;
};

export async function selectNftMetadataByTokenId(
  client: MintDb,
  tokenId: number
): Promise<NftMetadataRow | undefined> {
  const [nft] = await client
    .select({
      tokenId: nftCollection.tokenId,
      name: nftCollection.name,
      description: nftCollection.description,
      imageUrl: nftCollection.imageUrl,
      attributes: nftCollection.attributes,
      storyTitle: nftCollection.storyTitle,
      storyContent: nftCollection.storyContent,
    })
    .from(nftCollection)
    .where(eq(nftCollection.tokenId, tokenId))
    .limit(1);
  return nft;
}
