#!/usr/bin/env bun

/**
 * NFT Collection Seed Script
 *
 * Seeds ProtoMonkeys NFT collection data from GitHub repository.
 * Creates 100 NFT entries with actual images and metadata.
 *
 * Usage:
 *   bun run scripts/seed-nft-collection.ts              # Seed if empty
 *   bun run scripts/seed-nft-collection.ts --force      # Force reseed (clears existing)
 *   bun run scripts/seed-nft-collection.ts --stats      # Show collection stats
 *   bun run scripts/seed-nft-collection.ts --snapshot   # Take a leaderboard snapshot
 */

import { PointsService } from '@babylon/api';
import {
  closeDatabase,
  count,
  db,
  eq,
  nftClaims,
  nftCollection,
  nftOwnership,
  nftSnapshot,
} from '@babylon/db';
import { logger } from '@babylon/shared';
import { nanoid } from 'nanoid';

const TOTAL_NFTS = 100;
const PLACEHOLDER_CONTRACT = '0x0000000000000000000000000000000000000000';
const PLACEHOLDER_CHAIN_ID = 1;

// GitHub repository paths for NFT metadata and images
const GITHUB_REPO = 'BabylonSocial/ProductManagementDocumentation';
const GITHUB_BRANCH = 'main';
const NFT_FOLDER = 'NFT%20Protomonkeys';

// Get GitHub raw URL for NFT image
const getNftImageUrl = (tokenId: number) =>
  `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${NFT_FOLDER}/images/${tokenId}.png`;

// Get GitHub raw URL for NFT metadata JSON
const getNftMetadataUrl = (tokenId: number) =>
  `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${NFT_FOLDER}/${tokenId}.json`;

interface NftMetadata {
  name: string;
  description: string;
  nftName: string; // Extracted from attributes
  attributes: Array<{ trait_type: string; value: string | number }>;
}

// Fetch NFT metadata from GitHub
async function fetchNftMetadata(tokenId: number): Promise<NftMetadata | null> {
  try {
    const url = getNftMetadataUrl(tokenId);
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn(
        `Failed to fetch metadata for NFT #${tokenId}`,
        { status: response.status },
        'SeedNFT'
      );
      return null;
    }

    const data = (await response.json()) as {
      name: string;
      description: string;
      attributes: Array<{ trait_type: string; value: string | number }>;
    };

    // Extract NFT name from attributes
    const nameAttribute = data.attributes.find(
      (attr) => attr.trait_type === 'Name'
    );
    const nftName = nameAttribute?.value as string | undefined;

    return {
      name: data.name,
      description: data.description,
      nftName: nftName ?? `ProtoMonkey #${tokenId}`,
      attributes: data.attributes,
    };
  } catch (error) {
    logger.warn(
      `Error fetching metadata for NFT #${tokenId}`,
      { error: String(error) },
      'SeedNFT'
    );
    return null;
  }
}

interface SeedStats {
  totalNfts: number;
  ownedCount: number;
  claimedCount: number;
  snapshotCount: number;
}

async function getStats(): Promise<SeedStats> {
  const [nftCount] = await db.select({ count: count() }).from(nftCollection);
  const [ownedCount] = await db.select({ count: count() }).from(nftOwnership);
  const [claimedCount] = await db.select({ count: count() }).from(nftClaims);
  const [snapshotCount] = await db.select({ count: count() }).from(nftSnapshot);

  return {
    totalNfts: nftCount?.count ?? 0,
    ownedCount: ownedCount?.count ?? 0,
    claimedCount: claimedCount?.count ?? 0,
    snapshotCount: snapshotCount?.count ?? 0,
  };
}

async function clearCollection(): Promise<void> {
  logger.info('Clearing existing NFT collection data...', undefined, 'SeedNFT');

  await db.delete(nftClaims);
  await db.delete(nftOwnership);
  await db.delete(nftSnapshot);
  await db.delete(nftCollection);

  logger.info('Collection cleared', undefined, 'SeedNFT');
}

async function seedCollection(): Promise<void> {
  logger.info(`Seeding ${TOTAL_NFTS} NFTs...`, undefined, 'SeedNFT');

  const now = new Date();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TOTAL_NFTS; i++) {
    const tokenId = i + 1;

    // Fetch metadata from GitHub
    const metadata = await fetchNftMetadata(tokenId);

    if (!metadata) {
      logger.warn(
        `Using fallback data for NFT #${tokenId}`,
        undefined,
        'SeedNFT'
      );
      failCount++;

      // Fallback to placeholder data
      await db.insert(nftCollection).values({
        id: nanoid(),
        tokenId,
        name: `Babylon #${tokenId}`,
        description:
          'Your onchain identity inside Babylon, the social arena where humans and AI agents compete together in real time prediction markets.',
        imageUrl: getNftImageUrl(tokenId),
        thumbnailUrl: getNftImageUrl(tokenId), // Same URL, browser will resize
        imageCid: null,
        storyTitle: `ProtoMonkey #${tokenId}`,
        storyContent:
          'This NFT marks your entry into a continuous world of fast feedback, shared intelligence, and rapid learning.',
        metadataUri: null,
        attributes: [
          { trait_type: 'Collection', value: 'ProtoMonkeys' },
          { trait_type: 'Token Number', value: tokenId },
          { trait_type: 'Edition', value: 1 },
        ],
        contractAddress: PLACEHOLDER_CONTRACT,
        chainId: PLACEHOLDER_CHAIN_ID,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    // Use actual metadata
    await db.insert(nftCollection).values({
      id: nanoid(),
      tokenId,
      name: metadata.nftName, // Use the actual NFT name from attributes
      description: metadata.description,
      imageUrl: getNftImageUrl(tokenId),
      thumbnailUrl: getNftImageUrl(tokenId), // Same URL, browser will resize
      imageCid: null, // Will be set when uploaded to IPFS
      storyTitle: metadata.nftName,
      storyContent: metadata.description,
      metadataUri: null, // Will be set when metadata is uploaded to IPFS
      attributes: metadata.attributes,
      contractAddress: PLACEHOLDER_CONTRACT,
      chainId: PLACEHOLDER_CHAIN_ID,
      createdAt: now,
      updatedAt: now,
    });

    successCount++;

    if (tokenId % 10 === 0) {
      logger.info(
        `Seeded ${tokenId}/${TOTAL_NFTS} NFTs (${successCount} success, ${failCount} fallback)`,
        undefined,
        'SeedNFT'
      );
    }

    // Small delay to avoid rate limiting
    if (tokenId % 20 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  logger.info(
    `Successfully seeded ${TOTAL_NFTS} NFTs (${successCount} with metadata, ${failCount} fallback)`,
    undefined,
    'SeedNFT'
  );
}

async function takeLeaderboardSnapshot(): Promise<void> {
  logger.info(
    'Taking leaderboard snapshot for NFT eligibility...',
    undefined,
    'SeedNFT'
  );

  const snapshotTime = new Date();

  // Fetch top 100 users
  const leaderboardResult = await PointsService.getLeaderboard(
    1,
    100,
    0,
    'all'
  );
  const topUsers = leaderboardResult.users;

  logger.info(
    `Found ${topUsers.length} users for snapshot`,
    undefined,
    'SeedNFT'
  );

  // Clear existing snapshots (except those who have minted)
  const existingSnapshots = await db
    .select({
      userId: nftSnapshot.userId,
      hasMinted: nftSnapshot.hasMinted,
    })
    .from(nftSnapshot);

  const mintedUserIds = new Set(
    existingSnapshots.filter((s) => s.hasMinted).map((s) => s.userId)
  );

  // Delete non-minted snapshots
  for (const snapshot of existingSnapshots) {
    if (!snapshot.hasMinted) {
      await db
        .delete(nftSnapshot)
        .where(eq(nftSnapshot.userId, snapshot.userId));
    }
  }

  // Insert new snapshots
  for (let i = 0; i < topUsers.length; i++) {
    const user = topUsers[i]!;
    const rank = i + 1;

    // Skip if user has already minted
    if (mintedUserIds.has(user.id)) {
      continue;
    }

    await db.insert(nftSnapshot).values({
      id: nanoid(),
      userId: user.id,
      walletAddress: null, // Will be populated from users table
      rank,
      points: user.allPoints,
      snapshotTakenAt: snapshotTime,
      hasMinted: false,
    });
  }

  logger.info(
    `Snapshot complete: ${topUsers.length} users eligible (${mintedUserIds.size} already minted)`,
    { snapshotTime: snapshotTime.toISOString() },
    'SeedNFT'
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceReseed = args.includes('--force');
  const showStats = args.includes('--stats');
  const takeSnapshot = args.includes('--snapshot');

  logger.info(
    '════════════════════════════════════════════════════════════',
    undefined,
    'SeedNFT'
  );
  logger.info(
    'Babylon NFT Collection Seeder',
    { forceReseed, showStats, takeSnapshot },
    'SeedNFT'
  );
  logger.info(
    '════════════════════════════════════════════════════════════',
    undefined,
    'SeedNFT'
  );

  if (showStats) {
    const stats = await getStats();
    logger.info('NFT Collection Statistics', stats, 'SeedNFT');
    await closeDatabase();
    return;
  }

  if (takeSnapshot) {
    await takeLeaderboardSnapshot();
    await closeDatabase();
    return;
  }

  const stats = await getStats();

  if (stats.totalNfts > 0 && !forceReseed) {
    logger.info(
      `Collection already seeded with ${stats.totalNfts} NFTs. Use --force to reseed.`,
      undefined,
      'SeedNFT'
    );
    await closeDatabase();
    return;
  }

  if (forceReseed && stats.totalNfts > 0) {
    await clearCollection();
  }

  await seedCollection();

  const finalStats = await getStats();
  logger.info('Seeding complete', finalStats, 'SeedNFT');

  await closeDatabase();
}

main().catch((error) => {
  logger.error('Seeding failed', { error: String(error) }, 'SeedNFT');
  process.exit(1);
});
