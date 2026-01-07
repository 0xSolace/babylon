/**
 * Seed NftSnapshot from CSV file
 *
 * Imports top 100 users from a CSV snapshot and randomly assigns each
 * user exactly one NFT (tokenId 1-100).
 *
 * Usage:
 *   bun run scripts/seed-nft-snapshot-from-csv.ts <csv-path>
 *   bun run scripts/seed-nft-snapshot-from-csv.ts --force        # Overwrite existing
 *   bun run scripts/seed-nft-snapshot-from-csv.ts --create-users # Create missing users
 *
 * Required CSV columns: id (Privy ID), walletAddress, reputationPoints
 */

import { db, eq, inArray, nftSnapshot, users } from '@babylon/db';
import { logger, parseCsvFile, shuffle } from '@babylon/shared';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';
import { join } from 'path';

async function seedNftSnapshot(
  csvPath: string,
  force = false,
  createMissingUsers = false
) {
  logger.info(`Reading CSV from: ${csvPath}`, undefined, 'SeedSnapshot');

  // Parse CSV using shared utility
  const csvUsers = parseCsvFile(csvPath);
  logger.info(
    `Parsed ${csvUsers.length} users from CSV`,
    undefined,
    'SeedSnapshot'
  );

  // Sort by reputationPoints descending and take top 100
  const sortedUsers = csvUsers
    .sort((a, b) => b.reputationPoints - a.reputationPoints)
    .slice(0, 100);

  logger.info(
    `Top 100 users by reputationPoints: ${sortedUsers[0]?.reputationPoints} to ${sortedUsers[sortedUsers.length - 1]?.reputationPoints}`,
    undefined,
    'SeedSnapshot'
  );

  // Verify all users exist in the User table
  const userIds = sortedUsers.map((u) => u.id);
  const existingUsers = await db
    .select({ id: users.id, walletAddress: users.walletAddress })
    .from(users)
    .where(inArray(users.id, userIds));

  const existingUserMap = new Map(
    existingUsers.map((u) => [u.id, u.walletAddress])
  );

  const missingUsers = sortedUsers.filter((u) => !existingUserMap.has(u.id));

  // Create missing users if flag is set (for local development)
  if (missingUsers.length > 0 && createMissingUsers) {
    logger.info(
      `Creating ${missingUsers.length} missing users for local development`,
      undefined,
      'SeedSnapshot'
    );

    for (const csvUser of missingUsers) {
      await db.insert(users).values({
        id: csvUser.id,
        privyId: csvUser.id,
        walletAddress: csvUser.walletAddress,
        username: csvUser.username || `user_${csvUser.id.slice(-8)}`,
        displayName:
          csvUser.displayName || csvUser.username || 'Top 100 Player',
        profileImageUrl: null,
        isActor: false,
        reputationPoints: csvUser.reputationPoints,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      existingUserMap.set(csvUser.id, csvUser.walletAddress);
    }

    logger.info(
      `Created ${missingUsers.length} users`,
      undefined,
      'SeedSnapshot'
    );
  } else if (missingUsers.length > 0) {
    // Mask DIDs for privacy: show only last 6 chars
    const maskDid = (id: string) => `...${id.slice(-6)}`;
    logger.warn(
      `${missingUsers.length} users from CSV not found in User table. Use --create-users to create them.`,
      {
        missingCount: missingUsers.length,
        sample: missingUsers.slice(0, 5).map((u) => maskDid(u.id)),
      },
      'SeedSnapshot'
    );
  }

  // Only include users that exist in the database
  const validUsers = sortedUsers.filter((u) => existingUserMap.has(u.id));
  if (validUsers.length === 0) {
    throw new Error(
      'No valid users found in database. Use --create-users flag for local dev.'
    );
  }

  logger.info(
    `${validUsers.length} valid users to seed`,
    undefined,
    'SeedSnapshot'
  );

  // Generate random NFT assignments
  const tokenIds = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
  const snapshotTime = new Date('2025-12-31T00:00:00Z');

  // Prepare snapshot values outside transaction
  const snapshotValues = validUsers.map((csvUser, i) => {
    const currentWallet =
      existingUserMap.get(csvUser.id) ?? csvUser.walletAddress;
    return {
      id: nanoid(),
      userId: csvUser.id,
      walletAddress: currentWallet || null,
      rank: i + 1,
      points: csvUser.reputationPoints,
      snapshotTakenAt: snapshotTime,
      assignedTokenId: tokenIds[i]!,
      hasMinted: false,
    };
  });

  // Wrap all DB operations in a transaction to ensure consistency
  const inserted = await db.transaction(async (tx) => {
    // Re-check for existing snapshots inside transaction to avoid race conditions
    const existingSnapshots = await tx
      .select({
        userId: nftSnapshot.userId,
        assignedTokenId: nftSnapshot.assignedTokenId,
        hasMinted: nftSnapshot.hasMinted,
      })
      .from(nftSnapshot);

    const hasMintedUsers = existingSnapshots.filter((s) => s.hasMinted);
    if (hasMintedUsers.length > 0 && !force) {
      throw new Error(
        `${hasMintedUsers.length} users have already minted. Use --force to clear and reseed (this will lose claim data)`
      );
    }

    // Clear existing snapshots (only non-minted ones unless force)
    if (force) {
      logger.info(
        'Force mode: clearing all existing snapshots',
        undefined,
        'SeedSnapshot'
      );
      await tx.delete(nftSnapshot);
    } else {
      // Only delete non-minted snapshots (defensive filter to prevent race conditions)
      const nonMintedCount = existingSnapshots.filter(
        (s) => !s.hasMinted
      ).length;
      if (nonMintedCount > 0) {
        logger.info(
          `Clearing ${nonMintedCount} existing non-minted snapshots`,
          undefined,
          'SeedSnapshot'
        );
        await tx.delete(nftSnapshot).where(eq(nftSnapshot.hasMinted, false));
      }
    }

    // Insert new snapshots with assigned NFTs (batch insert for efficiency)
    await tx.insert(nftSnapshot).values(snapshotValues);

    return snapshotValues.length;
  });

  // Redact DID for privacy: show first 6 and last 4 chars
  const redactId = (id: string) => `${id.slice(0, 6)}...${id.slice(-4)}`;

  logger.info(
    `Seeding complete: ${inserted} users assigned NFTs`,
    {
      topUser: {
        id: redactId(validUsers[0]?.id ?? ''),
        rank: 1,
        tokenId: tokenIds[0],
      },
      lastUser: {
        id: redactId(validUsers[inserted - 1]?.id ?? ''),
        rank: inserted,
        tokenId: tokenIds[inserted - 1],
      },
    },
    'SeedSnapshot'
  );

  // Print summary
  console.log('\n=== NFT Assignment Summary ===');
  console.log(`Total users assigned: ${inserted}`);
  console.log(`Snapshot date: ${snapshotTime.toISOString()}`);
  console.log('\nTop 10 assignments:');
  for (let i = 0; i < Math.min(10, validUsers.length); i++) {
    const user = validUsers[i]!;
    console.log(
      `  Rank ${i + 1}: ${redactId(user.id)} → NFT #${tokenIds[i]} (${user.reputationPoints} pts)`
    );
  }
}

// Main
const args = process.argv.slice(2);
const force = args.includes('--force');
const createUsers = args.includes('--create-users');

// Find CSV path from args or use common locations
const csvArg = args.find((a) => !a.startsWith('--'));
const defaultPaths = [
  // Project-relative paths
  join(process.cwd(), 'data/nft-snapshot.csv'),
  join(process.cwd(), 'data/user_snapshot_top100.csv'),
  // Environment-driven path (optional)
  process.env.NFT_SNAPSHOT_CSV_PATH,
].filter((p): p is string => !!p);
const csvPath = csvArg ?? defaultPaths.find((p) => existsSync(p));

if (!csvPath) {
  console.error(
    'Usage: bun run scripts/seed-nft-snapshot-from-csv.ts <csv-path>'
  );
  console.error('No CSV path provided and no default file found.');
  process.exit(1);
}

seedNftSnapshot(csvPath, force, createUsers)
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Seed failed', { error: String(error) }, 'SeedSnapshot');
    console.error(error);
    process.exit(1);
  });
