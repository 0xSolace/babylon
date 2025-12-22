#!/usr/bin/env bun

/**
 * One-Time Migration to Decentralized Infrastructure
 *
 * This script migrates Babylon from centralized services to Jeju's
 * decentralized infrastructure:
 * - PostgreSQL → CovenantSQL
 * - Redis → Decentralized Cache
 * - Vercel Blob → IPFS/Arweave
 *
 * Run once per environment. Cannot be reversed.
 */

import {
  getJejuStorageClient,
  initializeJejuStorage,
} from '@babylon/api/storage/jeju-storage';
import { db, schema } from '@babylon/db';
import {
  generateAllDDL,
  getCQLClient,
  initializeCQL,
} from '@babylon/db/decentralized';

interface MigrationResult {
  step: string;
  success: boolean;
  rowsMigrated?: number;
  error?: string;
  duration: number;
}

const results: MigrationResult[] = [];

async function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function runStep(
  name: string,
  fn: () => Promise<{ rowsMigrated?: number }>
): Promise<void> {
  log(`Starting: ${name}`);
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;
    results.push({
      step: name,
      success: true,
      rowsMigrated: result.rowsMigrated,
      duration,
    });
    log(
      `✓ Completed: ${name} (${duration}ms)${result.rowsMigrated ? `, ${result.rowsMigrated} rows` : ''}`
    );
  } catch (error) {
    const err = error as Error;
    const duration = Date.now() - start;
    results.push({
      step: name,
      success: false,
      error: err.message,
      duration,
    });
    log(`✗ Failed: ${name} - ${err.message}`);
    throw error;
  }
}

async function migrateSchema(): Promise<{ rowsMigrated?: number }> {
  const cql = getCQLClient();
  const ddlStatements = generateAllDDL();

  for (const ddl of ddlStatements) {
    await cql.exec(ddl);
  }

  return { rowsMigrated: ddlStatements.length };
}

async function migrateUsers(): Promise<{ rowsMigrated: number }> {
  const cql = getCQLClient();
  const users = await db.select().from(schema.users);

  if (users.length === 0) return { rowsMigrated: 0 };

  const batches = chunk(users, 100);
  let total = 0;

  for (const batch of batches) {
    const rows = batch.map((u) => ({
      id: u.id,
      walletAddress: u.walletAddress,
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      profileImageUrl: u.profileImageUrl,
      isActor: u.isActor,
      createdAt: u.createdAt?.toISOString(),
      updatedAt: u.updatedAt?.toISOString(),
      virtualBalance: u.virtualBalance,
      totalDeposited: u.totalDeposited,
      totalWithdrawn: u.totalWithdrawn,
      lifetimePnL: u.lifetimePnL,
      profileComplete: u.profileComplete,
      reputationPoints: u.reputationPoints,
      referralCode: u.referralCode,
      referralCount: u.referralCount,
      referredBy: u.referredBy,
      // Auth migration: OAuth3 (Jeju) is the new auth system; fall back to privyId for legacy users
      // who signed up before the Privy→OAuth3 migration
      oauth3Id: u.oauth3Id ?? u.privyId,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      isAgent: u.isAgent,
      managedBy: u.managedBy,
      farcasterFid: u.farcasterFid,
      twitterId: u.twitterId,
      discordId: u.discordId,
      email: u.email,
      tosAccepted: u.tosAccepted,
      invitePoints: u.invitePoints,
      earnedPoints: u.earnedPoints,
    }));

    const count = await cql.insertMany('User', rows);
    total += count;
  }

  return { rowsMigrated: total };
}

async function migrateMarkets(): Promise<{ rowsMigrated: number }> {
  const cql = getCQLClient();
  const markets = await db.select().from(schema.markets);

  if (markets.length === 0) return { rowsMigrated: 0 };

  const batches = chunk(markets, 100);
  let total = 0;

  for (const batch of batches) {
    const rows = batch.map((m) => ({
      id: m.id,
      question: m.question,
      description: m.description,
      gameId: m.gameId,
      dayNumber: m.dayNumber,
      yesShares: m.yesShares,
      noShares: m.noShares,
      liquidity: m.liquidity,
      resolved: m.resolved,
      resolution: m.resolution,
      endDate: m.endDate?.toISOString(),
      createdAt: m.createdAt?.toISOString(),
      updatedAt: m.updatedAt?.toISOString(),
      onChainMarketId: m.onChainMarketId,
      onChainResolved: m.onChainResolved,
    }));

    const count = await cql.insertMany('Market', rows);
    total += count;
  }

  return { rowsMigrated: total };
}

async function migratePosts(): Promise<{ rowsMigrated: number }> {
  const cql = getCQLClient();
  const posts = await db.select().from(schema.posts);

  if (posts.length === 0) return { rowsMigrated: 0 };

  const batches = chunk(posts, 100);
  let total = 0;

  for (const batch of batches) {
    const rows = batch.map((p) => ({
      id: p.id,
      content: p.content,
      authorId: p.authorId,
      gameId: p.gameId,
      dayNumber: p.dayNumber,
      type: p.type,
      timestamp: p.timestamp?.toISOString(),
      createdAt: p.createdAt?.toISOString(),
      deletedAt: p.deletedAt?.toISOString() || null,
      commentOnPostId: p.commentOnPostId,
      parentCommentId: p.parentCommentId,
    }));

    const count = await cql.insertMany('Post', rows);
    total += count;
  }

  return { rowsMigrated: total };
}

async function migratePositions(): Promise<{ rowsMigrated: number }> {
  const cql = getCQLClient();
  const positions = await db.select().from(schema.positions);

  if (positions.length === 0) return { rowsMigrated: 0 };

  const batches = chunk(positions, 100);
  let total = 0;

  for (const batch of batches) {
    const rows = batch.map((p) => ({
      id: p.id,
      userId: p.userId,
      marketId: p.marketId,
      side: p.side,
      shares: p.shares,
      avgPrice: p.avgPrice,
      amount: p.amount,
      status: p.status,
      pnl: p.pnl,
      createdAt: p.createdAt?.toISOString(),
      updatedAt: p.updatedAt?.toISOString(),
    }));

    const count = await cql.insertMany('Position', rows);
    total += count;
  }

  return { rowsMigrated: total };
}

async function migrateChats(): Promise<{ rowsMigrated: number }> {
  const cql = getCQLClient();
  const chats = await db.select().from(schema.chats);

  if (chats.length === 0) return { rowsMigrated: 0 };

  const batches = chunk(chats, 100);
  let total = 0;

  for (const batch of batches) {
    const rows = batch.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isGroup: c.isGroup,
      createdBy: c.createdBy,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    }));

    const count = await cql.insertMany('Chat', rows);
    total += count;
  }

  return { rowsMigrated: total };
}

async function migrateMessages(): Promise<{ rowsMigrated: number }> {
  const cql = getCQLClient();
  const messages = await db.select().from(schema.messages);

  if (messages.length === 0) return { rowsMigrated: 0 };

  const batches = chunk(messages, 100);
  let total = 0;

  for (const batch of batches) {
    const rows = batch.map((m) => ({
      id: m.id,
      chatId: m.chatId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt?.toISOString(),
    }));

    const count = await cql.insertMany('Message', rows);
    total += count;
  }

  return { rowsMigrated: total };
}

async function migrateImages(): Promise<{ rowsMigrated: number }> {
  const storage = getJejuStorageClient();
  let migrated = 0;

  // Migrate user profile images
  const usersWithImages = await db
    .select({
      id: schema.users.id,
      profileImageUrl: schema.users.profileImageUrl,
    })
    .from(schema.users);

  for (const user of usersWithImages) {
    if (!user.profileImageUrl) continue;

    // Skip if already IPFS
    if (user.profileImageUrl.includes('ipfs')) continue;

    try {
      // Download from old storage
      const response = await fetch(user.profileImageUrl);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      const filename = `profile-${user.id}.jpg`;

      // Upload to IPFS
      const result = await storage.uploadImage({
        file: buffer,
        filename,
        contentType: 'image/jpeg',
        folder: 'user-profiles',
      });

      // Update user record
      await db
        .update(schema.users)
        .set({ profileImageUrl: result.url })
        .where(schema.users.id.equals(user.id));

      migrated++;
    } catch (e) {
      log(
        `Warning: Failed to migrate image for user ${user.id}: ${(e as Error).message}`
      );
    }
  }

  return { rowsMigrated: migrated };
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  log('========================================');
  log('Babylon Decentralization Migration');
  log('========================================');
  log('');

  // Check environment
  const jejuNetwork = process.env.JEJU_NETWORK;
  if (!jejuNetwork) {
    console.error('ERROR: JEJU_NETWORK not set. Cannot proceed.');
    process.exit(1);
  }

  const cqlEndpoint = process.env.CQL_BLOCK_PRODUCER_ENDPOINT;
  if (!cqlEndpoint) {
    console.error(
      'ERROR: CQL_BLOCK_PRODUCER_ENDPOINT not set. Cannot proceed.'
    );
    process.exit(1);
  }

  const storageEndpoint = process.env.JEJU_STORAGE_ENDPOINT;
  if (!storageEndpoint) {
    console.error('ERROR: JEJU_STORAGE_ENDPOINT not set. Cannot proceed.');
    process.exit(1);
  }

  log(`Network: ${jejuNetwork}`);
  log(`CovenantSQL: ${cqlEndpoint}`);
  log(`Storage: ${storageEndpoint}`);
  log('');

  // Confirm
  log(
    'WARNING: This migration is ONE-WAY. Data will be copied to decentralized infrastructure.'
  );
  log('Press Ctrl+C within 10 seconds to abort...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  log('');
  log('Starting migration...');
  log('');

  // Initialize decentralized services
  await runStep('Initialize CovenantSQL', async () => {
    await initializeCQL();
    return {};
  });

  await runStep('Initialize Jeju Storage', async () => {
    await initializeJejuStorage();
    return {};
  });

  // Migrate schema
  await runStep('Create CovenantSQL Schema', migrateSchema);

  // Migrate data
  await runStep('Migrate Users', migrateUsers);
  await runStep('Migrate Markets', migrateMarkets);
  await runStep('Migrate Positions', migratePositions);
  await runStep('Migrate Posts', migratePosts);
  await runStep('Migrate Chats', migrateChats);
  await runStep('Migrate Messages', migrateMessages);

  // Migrate images (this can take a while)
  await runStep('Migrate Images to IPFS', migrateImages);

  // Summary
  log('');
  log('========================================');
  log('Migration Complete');
  log('========================================');
  log('');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalRows = results.reduce((sum, r) => sum + (r.rowsMigrated ?? 0), 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  log(`Steps: ${successful} succeeded, ${failed} failed`);
  log(`Total rows migrated: ${totalRows}`);
  log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
  log('');

  if (failed > 0) {
    log('FAILED STEPS:');
    for (const r of results.filter((r) => !r.success)) {
      log(`  - ${r.step}: ${r.error}`);
    }
    process.exit(1);
  }

  log('Next steps:');
  log('1. Update environment variables to use decentralized services');
  log('2. Deploy frontend to IPFS: bun run deploy:ipfs');
  log('3. Update JNS record: bun run update:jns');
  log('4. Verify all services are working');
  log('5. Disable PostgreSQL/Redis/Vercel connections');
  log('');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
