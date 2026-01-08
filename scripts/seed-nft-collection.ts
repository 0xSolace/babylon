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
import { execSync } from 'child_process';
import { nanoid } from 'nanoid';

const TOTAL_NFTS = 100;
const PLACEHOLDER_CONTRACT = '0x0000000000000000000000000000000000000000';
const PLACEHOLDER_CHAIN_ID = 1;

// GitHub repository for NFT metadata
const GITHUB_REPO = 'BabylonSocial/ProductManagementDocumentation';

// Get static NFT image URL (served from public folder)
function getNftImagePath(tokenId: number): string {
  return `/nft/images/${tokenId}.png`;
}

interface NftMetadata {
  name: string;
  description: string;
  nftName: string; // Extracted from attributes
  attributes: Array<{ trait_type: string; value: string | number }>;
}

/**
 * Generate a unique description for an NFT based on its name, traits, and Babylon narrative
 */
function generateNftDescription(
  nftName: string,
  tokenId: number,
  attributes: Array<{ trait_type: string; value: string | number }>
): string {
  // Extract key traits
  const background = attributes.find((a) => a.trait_type === 'BackgroundColors')
    ?.value as string | undefined;
  const face = attributes.find((a) => a.trait_type === 'Face')?.value as
    | string
    | undefined;
  const eyes = attributes.find((a) => a.trait_type === 'Eyes')?.value as
    | string
    | undefined;
  const body = attributes.find((a) => a.trait_type === 'Body')?.value as
    | string
    | undefined;
  const mouth = attributes.find((a) => a.trait_type === 'Mouth')?.value as
    | string
    | undefined;
  const glasses = attributes.find((a) => a.trait_type === 'Glasses')?.value as
    | string
    | undefined;
  const head = attributes.find((a) => a.trait_type === 'Head')?.value as
    | string
    | undefined;

  // Build trait description
  const traitParts: string[] = [];
  if (background) traitParts.push(background.toLowerCase());
  if (face && face !== 'Base') traitParts.push(face.toLowerCase());
  if (body && body !== 'Base') traitParts.push(body.toLowerCase());
  if (eyes && eyes !== 'Base') traitParts.push(eyes.toLowerCase());
  if (mouth && mouth !== 'Base') traitParts.push(mouth.toLowerCase());
  if (glasses) traitParts.push(`wearing ${glasses.toLowerCase()}`);
  if (head) traitParts.push(`with ${head.toLowerCase()}`);

  const traitDescription =
    traitParts.length > 0 ? ` ${traitParts.slice(0, 3).join(', ')}` : '';

  // Generate description based on NFT name patterns
  let personality = '';
  const nameLower = nftName.toLowerCase();

  if (nameLower.includes('wire')) {
    personality =
      'A digital native who thrives in the fast-paced world of prediction markets';
  } else if (nameLower.includes('copy')) {
    personality =
      'Master of pattern recognition, copying successful strategies across markets';
  } else if (nameLower.includes('drowsy') || nameLower.includes('sleep')) {
    personality =
      'A patient strategist who waits for the perfect moment to strike';
  } else if (nameLower.includes('america')) {
    personality =
      'A bold trader who brings confidence and determination to every market';
  } else if (nameLower.includes('matte')) {
    personality =
      'A sleek operator who moves through markets with precision and style';
  } else if (nameLower.includes('chrome')) {
    personality =
      'A polished professional reflecting the best strategies in real-time';
  } else if (nameLower.includes('gas')) {
    personality =
      'Always ready to execute, moving fast when opportunities arise';
  } else if (nameLower.includes('howto')) {
    personality =
      'A teacher and guide, sharing knowledge to help others succeed';
  } else if (nameLower.includes('mugging')) {
    personality = 'A fierce competitor who takes calculated risks for big wins';
  } else if (nameLower.includes('retro')) {
    personality = 'Drawing wisdom from classic trading strategies of the past';
  } else if (nameLower.includes('eliza')) {
    personality =
      'An AI agent enthusiast, bridging human and machine intelligence';
  } else if (nameLower.includes('multi')) {
    personality = 'A versatile player who excels across multiple market types';
  } else if (nameLower.includes('flocked')) {
    personality =
      'A community leader who brings others together for collective success';
  } else if (nameLower.includes('awed')) {
    personality = "Amazed by the endless possibilities in Babylon's markets";
  } else if (nameLower.includes('signal')) {
    personality = 'An expert at reading market signals and predicting trends';
  } else if (nameLower.includes('wailing')) {
    personality = 'Expressing the emotional rollercoaster of market trading';
  } else if (nameLower.includes('sideeye') || nameLower.includes('judging')) {
    personality =
      'A skeptical analyst who questions everything before committing';
  } else if (nameLower.includes('wallstreet')) {
    personality =
      'A financial veteran bringing traditional market wisdom to Babylon';
  } else if (nameLower.includes('boost')) {
    personality =
      'An amplifier of success, helping strategies reach their full potential';
  } else if (nameLower.includes('eager')) {
    personality = 'Always ready to jump into new markets and opportunities';
  } else if (nameLower.includes('council')) {
    personality =
      'A wise advisor who helps shape the direction of the community';
  } else if (nameLower.includes('seer')) {
    personality = 'A visionary who sees patterns others miss in the chaos';
  } else if (nameLower.includes('uplift')) {
    personality = 'Raising others up while climbing the leaderboard';
  } else if (nameLower.includes('steve')) {
    personality =
      "A legendary figure whose name echoes through Babylon's halls";
  } else if (nameLower.includes('sly')) {
    personality = 'A cunning strategist who plays the long game';
  } else if (nameLower.includes('joyful')) {
    personality = 'Finding joy in every trade, win or lose';
  } else if (nameLower.includes('silly')) {
    personality = "A playful spirit who doesn't take themselves too seriously";
  } else if (nameLower.includes('frazzled')) {
    personality =
      'Surviving the chaos of fast-moving markets with determination';
  } else {
    // Generic personality based on traits
    if (eyes?.toLowerCase().includes('sleep')) {
      personality = 'A patient observer who waits for the right moment';
    } else if (
      eyes?.toLowerCase().includes('excited') ||
      eyes?.toLowerCase().includes('dizzy')
    ) {
      personality = 'An energetic trader who thrives on market volatility';
    } else if (
      mouth?.toLowerCase().includes('wide') ||
      mouth?.toLowerCase().includes('waaaah')
    ) {
      personality = 'Expressing the full range of emotions in trading';
    } else {
      personality = "A skilled participant in Babylon's prediction markets";
    }
  }

  // Combine into unique description (name mentioned only once)
  return `${personality}${traitDescription ? ` This ProtoMonkey features${traitDescription}.` : ''} As one of the top 100 players, ${nftName} represents your onchain identity in Babylon, where humans and AI agents compete together in real-time prediction markets. Your reputation and performance are recorded onchain forever.`;
}

// Fetch NFT metadata using GitHub CLI
async function fetchNftMetadata(tokenId: number): Promise<NftMetadata | null> {
  try {
    // Use GitHub CLI to fetch the file content
    const filePath = `NFT Protomonkeys/${tokenId}.json`;
    const command = `gh api repos/${GITHUB_REPO}/contents/${encodeURIComponent(filePath)} --jq .content | base64 -d`;

    const fileContent = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const data = JSON.parse(fileContent) as {
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
      `Error fetching metadata for NFT #${tokenId} via GitHub CLI`,
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
      const imagePath = getNftImagePath(tokenId);
      await db.insert(nftCollection).values({
        id: nanoid(),
        tokenId,
        name: `Babylon #${tokenId}`,
        description:
          'Your onchain identity inside Babylon, the social arena where humans and AI agents compete together in real time prediction markets.',
        imageUrl: imagePath,
        thumbnailUrl: imagePath,
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

    // Generate unique description based on name, traits, and Babylon narrative
    const uniqueDescription = generateNftDescription(
      metadata.nftName,
      tokenId,
      metadata.attributes
    );

    // Get image path identifier (API routes will convert to proxy URLs)
    const imagePath = getNftImagePath(tokenId);

    // Use actual metadata
    await db.insert(nftCollection).values({
      id: nanoid(),
      tokenId,
      name: metadata.nftName, // Use the actual NFT name from attributes
      description: uniqueDescription, // Use generated unique description
      imageUrl: imagePath,
      thumbnailUrl: imagePath,
      imageCid: null, // Will be set when uploaded to IPFS
      storyTitle: metadata.nftName,
      storyContent: uniqueDescription, // Use generated description for story too
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
