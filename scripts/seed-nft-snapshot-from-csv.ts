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

import { db, inArray, nftSnapshot, users } from '@babylon/db';
import { logger } from '@babylon/shared';
import { existsSync, readFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { join } from 'path';

interface CsvUser {
  id: string; // Privy ID (did:privy:...)
  walletAddress: string;
  username: string;
  displayName: string;
  reputationPoints: number;
}

/**
 * Parse CSV using a robust approach that handles:
 * - Quoted fields with commas inside
 * - Fields with special characters
 * - Unicode content
 */
function parseCsv(csvPath: string): CsvUser[] {
  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Parse header - first line, simple comma split since header has no special chars
  const headerLine = lines[0]!;
  const headers = headerLine.split(',').map((h) => h.trim());

  const idIndex = headers.indexOf('id');
  const walletIndex = headers.indexOf('walletAddress');
  const usernameIndex = headers.indexOf('username');
  const displayNameIndex = headers.indexOf('displayName');
  const pointsIndex = headers.indexOf('reputationPoints');

  if (idIndex === -1 || walletIndex === -1 || pointsIndex === -1) {
    throw new Error(
      `CSV missing required columns. Found: ${headers.slice(0, 10).join(', ')}... Required: id, walletAddress, reputationPoints`
    );
  }

  const csvUsers: CsvUser[] = [];

  // Parse each data row using a robust CSV parser
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    const id = fields[idIndex]?.trim() ?? '';
    const walletAddress = fields[walletIndex]?.trim().toLowerCase() ?? '';
    const username = fields[usernameIndex]?.trim() ?? '';
    const displayName = fields[displayNameIndex]?.trim() ?? '';
    const pointsStr = fields[pointsIndex]?.trim() ?? '0';
    const reputationPoints = parseInt(pointsStr, 10) || 0;

    // Validate Privy ID format
    if (!id.startsWith('did:privy:')) {
      // Only warn if the id field looks like it should be a Privy ID
      if (id.length > 0 && id.length < 50) {
        logger.warn(
          `Row ${i}: skipping invalid id "${id.slice(0, 30)}"`,
          undefined,
          'SeedSnapshot'
        );
      }
      continue;
    }

    // Validate wallet address
    if (!walletAddress.match(/^0x[a-f0-9]{40}$/i)) {
      logger.warn(
        `Row ${i}: invalid wallet for ${id}`,
        undefined,
        'SeedSnapshot'
      );
      continue;
    }

    csvUsers.push({
      id,
      walletAddress,
      username,
      displayName,
      reputationPoints,
    });
  }

  return csvUsers;
}

/**
 * Robust CSV line parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i]!;

    if (char === '"') {
      // Check for escaped quote ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  result.push(current);
  return result;
}

/**
 * Fisher-Yates shuffle for random assignment
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

async function seedNftSnapshot(
  csvPath: string,
  force = false,
  createMissingUsers = false
) {
  logger.info(`Reading CSV from: ${csvPath}`, undefined, 'SeedSnapshot');

  // Parse CSV
  const csvUsers = parseCsv(csvPath);
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
    logger.warn(
      `${missingUsers.length} users from CSV not found in User table. Use --create-users to create them.`,
      { missing: missingUsers.slice(0, 5).map((u) => u.id) },
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

  // Check for existing snapshots
  const existingSnapshots = await db
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

  // Generate random NFT assignments
  const tokenIds = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
  const snapshotTime = new Date('2025-12-31T00:00:00Z');

  // Clear existing snapshots (only non-minted ones unless force)
  if (force) {
    logger.info(
      'Force mode: clearing all existing snapshots',
      undefined,
      'SeedSnapshot'
    );
    await db.delete(nftSnapshot);
  } else if (existingSnapshots.length > 0) {
    logger.info(
      `Clearing ${existingSnapshots.length} existing non-minted snapshots`,
      undefined,
      'SeedSnapshot'
    );
    await db.delete(nftSnapshot);
  }

  // Insert new snapshots with assigned NFTs
  let inserted = 0;
  for (let i = 0; i < validUsers.length; i++) {
    const csvUser = validUsers[i]!;
    const rank = i + 1;
    const tokenId = tokenIds[i]!;

    // Use current wallet from database (not CSV) in case it changed
    const currentWallet =
      existingUserMap.get(csvUser.id) ?? csvUser.walletAddress;

    await db.insert(nftSnapshot).values({
      id: nanoid(),
      userId: csvUser.id,
      walletAddress: currentWallet || null,
      rank,
      points: csvUser.reputationPoints,
      snapshotTakenAt: snapshotTime,
      assignedTokenId: tokenId,
      hasMinted: false,
    });

    inserted++;

    if (inserted % 20 === 0) {
      logger.info(
        `Inserted ${inserted}/${validUsers.length} snapshots`,
        undefined,
        'SeedSnapshot'
      );
    }
  }

  logger.info(
    `Seeding complete: ${inserted} users assigned NFTs`,
    {
      topUser: { id: validUsers[0]?.id, rank: 1, tokenId: tokenIds[0] },
      lastUser: {
        id: validUsers[inserted - 1]?.id,
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
      `  Rank ${i + 1}: ${user.id.slice(0, 30)}... → NFT #${tokenIds[i]} (${user.reputationPoints} pts)`
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
  join(process.env.HOME ?? '', 'Downloads/user_snapshot_2025-12-31_top100 - user_snapshot_2025-12-31_top100.csv.csv'),
  join(process.cwd(), 'data/nft-snapshot.csv'),
];
const csvPath = csvArg ?? defaultPaths.find((p) => existsSync(p));

if (!csvPath) {
  console.error('Usage: bun run scripts/seed-nft-snapshot-from-csv.ts <csv-path>');
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
