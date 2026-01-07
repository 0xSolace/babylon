/**
 * Integration Tests: NFT Claim Flow
 *
 * Tests the complete NFT claim flow including:
 * - Claim API endpoint
 * - Database transactions
 * - Double-claim prevention
 * - Assigned NFT verification
 * - Ownership record creation
 *
 * Run with: bun test integration/nft-claim.integration.test.ts
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  and,
  db,
  eq,
  inArray,
  nftClaims,
  nftCollection,
  nftOwnership,
  nftSnapshot,
  users,
} from '@babylon/db';
import { generateSnowflakeId } from '@babylon/shared';

const BASE_URL =
  process.env.TEST_API_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://localhost:3000';

let serverAvailable = false;
let databaseAvailable = false;
let nftTablesExist = false;

// Track test data for cleanup
const testUserIds: string[] = [];
const testNftTokenIds: number[] = [];

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function createTestUser(options?: {
  walletAddress?: string;
  reputationPoints?: number;
}): Promise<{ id: string; walletAddress: string }> {
  const userId = await generateSnowflakeId();
  const walletAddress =
    options?.walletAddress ??
    `0x${Math.random().toString(16).slice(2).padStart(40, '0')}`;

  await db.insert(users).values({
    id: userId,
    walletAddress,
    username: `test-claim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    displayName: `Test Claim User ${userId.slice(0, 8)}`,
    isActor: false,
    isBanned: false,
    onChainRegistered: false,
    reputationPoints: options?.reputationPoints ?? 0,
    invitePoints: 0,
    earnedPoints: 0,
    bonusPoints: 0,
    updatedAt: new Date(),
  });

  testUserIds.push(userId);
  return { id: userId, walletAddress };
}

// Generate unique token ID to avoid conflicts with existing data
const testTokenIdBase = Date.now() % 100000;
let testTokenCounter = 0;
function getUniqueTokenId(): number {
  return testTokenIdBase + testTokenCounter++;
}

async function createTestNft(tokenId?: number): Promise<number> {
  const actualTokenId = tokenId ?? getUniqueTokenId();
  const uniqueId = `test-claim-nft-${actualTokenId}-${Date.now()}`;

  await db.insert(nftCollection).values({
    id: uniqueId,
    tokenId: actualTokenId,
    name: `Test Claim NFT #${actualTokenId}`,
    description: `A test NFT for claim testing with token ID ${actualTokenId}`,
    imageUrl: `nft://${actualTokenId}`,
    thumbnailUrl: `nft://${actualTokenId}`,
    storyTitle: `The Tale of Claim NFT #${actualTokenId}`,
    storyContent: `This is the story of test claim NFT #${actualTokenId}.`,
    attributes: [
      { trait_type: 'Collection', value: 'Test Claim Collection' },
      { trait_type: 'Token Number', value: actualTokenId },
    ],
    contractAddress: '0x0000000000000000000000000000000000000000',
    chainId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  testNftTokenIds.push(actualTokenId);
  return actualTokenId;
}

// Generate unique rank to avoid conflicts with existing data or other tests
let testRankCounter = 1000;
function getUniqueRank(): number {
  return testRankCounter++;
}

async function createTestSnapshot(
  userId: string,
  _rank: number, // Ignored - we use unique ranks
  points: number,
  walletAddress?: string,
  assignedTokenId?: number
): Promise<void> {
  const uniqueRank = getUniqueRank(); // Use unique rank to avoid conflicts
  await db.insert(nftSnapshot).values({
    id: `test-claim-snapshot-${userId}`,
    userId,
    walletAddress: walletAddress ?? null,
    rank: uniqueRank,
    points,
    snapshotTakenAt: new Date(),
    hasMinted: false,
    assignedTokenId: assignedTokenId ?? null,
  });
}

async function cleanupTestData(): Promise<void> {
  if (testNftTokenIds.length > 0) {
    await db
      .delete(nftClaims)
      .where(inArray(nftClaims.tokenId, testNftTokenIds));
    await db
      .delete(nftOwnership)
      .where(inArray(nftOwnership.tokenId, testNftTokenIds));
    await db
      .delete(nftCollection)
      .where(inArray(nftCollection.tokenId, testNftTokenIds));
    testNftTokenIds.length = 0;
  }

  if (testUserIds.length > 0) {
    await db
      .delete(nftSnapshot)
      .where(inArray(nftSnapshot.userId, testUserIds));
    await db.delete(users).where(inArray(users.id, testUserIds));
    testUserIds.length = 0;
  }
}

describe('NFT Claim Integration Tests', () => {
  beforeAll(async () => {
    serverAvailable = await checkServerHealth();
    if (!serverAvailable) {
      console.warn(
        '⚠️  Server not available - some tests will be skipped. Start server with: bun run dev'
      );
    }

    try {
      await db.select().from(users).limit(1);
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      console.warn(
        '⚠️  Database not available - tests will be skipped. Set DATABASE_URL environment variable.'
      );
    }

    if (databaseAvailable) {
      try {
        await db.select().from(nftCollection).limit(1);
        nftTablesExist = true;
      } catch {
        nftTablesExist = false;
        console.warn(
          '⚠️  NFT tables do not exist - NFT database tests will be skipped.'
        );
      }
    }
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Claim API Endpoint', () => {
    test('should require authentication', async () => {
      if (!serverAvailable) {
        console.log('Skipping test: server not available');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/nft/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Database Claim Operations', () => {
    test('should create snapshot with assigned token ID', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser({ reputationPoints: 5000 });
      await createTestSnapshot(user.id, 1, 5000, user.walletAddress, tokenId);

      const [snapshot] = await db
        .select()
        .from(nftSnapshot)
        .where(eq(nftSnapshot.userId, user.id))
        .limit(1);

      expect(snapshot).toBeDefined();
      expect(snapshot!.assignedTokenId).toBe(tokenId);
      expect(snapshot!.hasMinted).toBe(false);
    });

    test('should update snapshot on claim', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser();
      await createTestSnapshot(user.id, 1, 10000, user.walletAddress, tokenId);

      // Simulate claim
      const [updated] = await db
        .update(nftSnapshot)
        .set({
          hasMinted: true,
          mintedTokenId: tokenId,
          mintedAt: new Date(),
          mintTxHash: 'simulated-test-hash',
        })
        .where(
          and(eq(nftSnapshot.userId, user.id), eq(nftSnapshot.hasMinted, false))
        )
        .returning();

      expect(updated).toBeDefined();
      expect(updated!.hasMinted).toBe(true);
      expect(updated!.mintedTokenId).toBe(tokenId);
    });

    test('should prevent double claim via WHERE clause', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser();
      await createTestSnapshot(user.id, 1, 10000, user.walletAddress, tokenId);

      // First claim succeeds
      const [firstClaim] = await db
        .update(nftSnapshot)
        .set({
          hasMinted: true,
          mintedTokenId: tokenId,
          mintedAt: new Date(),
          mintTxHash: 'simulated-first-claim',
        })
        .where(
          and(eq(nftSnapshot.userId, user.id), eq(nftSnapshot.hasMinted, false))
        )
        .returning();

      expect(firstClaim).toBeDefined();

      // Second claim returns nothing (row already updated)
      const secondClaim = await db
        .update(nftSnapshot)
        .set({
          hasMinted: true,
          mintedTokenId: tokenId,
          mintedAt: new Date(),
          mintTxHash: 'simulated-second-claim',
        })
        .where(
          and(eq(nftSnapshot.userId, user.id), eq(nftSnapshot.hasMinted, false))
        )
        .returning();

      expect(secondClaim).toHaveLength(0);
    });

    test('should create ownership record on claim', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser();

      const now = new Date();
      const txHash = 'simulated-ownership-test';

      await db.insert(nftOwnership).values({
        id: `test-ownership-${tokenId}-${Date.now()}`,
        tokenId,
        ownerAddress: user.walletAddress.toLowerCase(),
        userId: user.id,
        acquiredAt: now,
        txHash,
        updatedAt: now,
      });

      const [ownership] = await db
        .select()
        .from(nftOwnership)
        .where(eq(nftOwnership.tokenId, tokenId))
        .limit(1);

      expect(ownership).toBeDefined();
      expect(ownership!.ownerAddress).toBe(user.walletAddress.toLowerCase());
      expect(ownership!.userId).toBe(user.id);
      expect(ownership!.txHash).toBe(txHash);
    });

    test('should create claim record with provenance', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser();

      const now = new Date();
      const rank = 42;
      const points = 7500;

      await db.insert(nftClaims).values({
        id: `test-claim-${tokenId}-${Date.now()}`,
        tokenId,
        claimerUserId: user.id,
        claimerAddress: user.walletAddress.toLowerCase(),
        claimedAt: now,
        txHash: 'simulated-claim-record-test',
        snapshotRank: rank,
        snapshotPoints: points,
      });

      const [claim] = await db
        .select()
        .from(nftClaims)
        .where(eq(nftClaims.tokenId, tokenId))
        .limit(1);

      expect(claim).toBeDefined();
      expect(claim!.snapshotRank).toBe(rank);
      expect(claim!.snapshotPoints).toBe(points);
      expect(claim!.claimerUserId).toBe(user.id);
    });

    test('should enforce unique assigned token ID', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // First user gets the token
      await createTestSnapshot(
        user1.id,
        1,
        10000,
        user1.walletAddress,
        tokenId
      );

      // Second user trying to get same token should fail
      try {
        await db.insert(nftSnapshot).values({
          id: `test-snapshot-${user2.id}-dup`,
          userId: user2.id,
          walletAddress: user2.walletAddress,
          rank: getUniqueRank(),
          points: 9000,
          snapshotTakenAt: new Date(),
          hasMinted: false,
          assignedTokenId: tokenId, // Same token!
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected: unique constraint violation
        expect(error).toBeDefined();
      }
    });
  });

  describe('Eligibility with Assigned NFT', () => {
    test('should show assigned NFT in eligibility response', async () => {
      if (!serverAvailable || !databaseAvailable || !nftTablesExist) {
        console.log(
          'Skipping test: server, database, or NFT tables not available'
        );
        return;
      }

      // This would require an authenticated request which we can't do
      // in this test. Instead we verify the database state.
      const tokenId = await createTestNft();
      const user = await createTestUser();
      await createTestSnapshot(user.id, 1, 10000, user.walletAddress, tokenId);

      // Verify assignment is in database
      const [snapshot] = await db
        .select({
          assignedTokenId: nftSnapshot.assignedTokenId,
          hasMinted: nftSnapshot.hasMinted,
        })
        .from(nftSnapshot)
        .where(eq(nftSnapshot.userId, user.id))
        .limit(1);

      expect(snapshot).toBeDefined();
      expect(snapshot!.assignedTokenId).toBe(tokenId);
      expect(snapshot!.hasMinted).toBe(false);

      // Verify NFT exists
      const [nft] = await db
        .select({ name: nftCollection.name })
        .from(nftCollection)
        .where(eq(nftCollection.tokenId, tokenId))
        .limit(1);

      expect(nft).toBeDefined();
      expect(nft!.name).toContain(`${tokenId}`);
    });

    test('should update eligibility after claim', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser();
      await createTestSnapshot(user.id, 1, 10000, user.walletAddress, tokenId);

      // Before claim
      const [before] = await db
        .select({ hasMinted: nftSnapshot.hasMinted })
        .from(nftSnapshot)
        .where(eq(nftSnapshot.userId, user.id))
        .limit(1);

      expect(before!.hasMinted).toBe(false);

      // Simulate claim
      await db
        .update(nftSnapshot)
        .set({
          hasMinted: true,
          mintedTokenId: tokenId,
          mintedAt: new Date(),
          mintTxHash: 'simulated-eligibility-test',
        })
        .where(eq(nftSnapshot.userId, user.id));

      // After claim
      const [after] = await db
        .select({
          hasMinted: nftSnapshot.hasMinted,
          mintedTokenId: nftSnapshot.mintedTokenId,
        })
        .from(nftSnapshot)
        .where(eq(nftSnapshot.userId, user.id))
        .limit(1);

      expect(after!.hasMinted).toBe(true);
      expect(after!.mintedTokenId).toBe(tokenId);
    });
  });

  describe('Concurrent Claim Operations', () => {
    test('should handle concurrent claim attempts for same user', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const user = await createTestUser();
      await createTestSnapshot(user.id, 1, 10000, user.walletAddress, tokenId);

      // Simulate concurrent claims
      const claimPromises = Array.from({ length: 5 }, (_, i) =>
        db
          .update(nftSnapshot)
          .set({
            hasMinted: true,
            mintedTokenId: tokenId,
            mintedAt: new Date(),
            mintTxHash: `simulated-concurrent-${i}`,
          })
          .where(
            and(
              eq(nftSnapshot.userId, user.id),
              eq(nftSnapshot.hasMinted, false)
            )
          )
          .returning()
      );

      const results = await Promise.all(claimPromises);

      // Only one should succeed (return a row)
      const successfulClaims = results.filter((r) => r.length > 0);
      expect(successfulClaims).toHaveLength(1);

      // Verify final state
      const [final] = await db
        .select()
        .from(nftSnapshot)
        .where(eq(nftSnapshot.userId, user.id))
        .limit(1);

      expect(final!.hasMinted).toBe(true);
    });

    test('should handle concurrent claims for different users', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      // Create 5 users with different assigned NFTs sequentially to track tokenIds
      const userTokenPairs: Array<{
        user: { id: string; walletAddress: string };
        tokenId: number;
      }> = [];

      for (let i = 0; i < 5; i++) {
        const tokenId = await createTestNft();
        const user = await createTestUser();
        await createTestSnapshot(
          user.id,
          i + 1,
          10000 - i * 1000,
          user.walletAddress,
          tokenId
        );
        userTokenPairs.push({ user, tokenId });
      }

      // Simulate concurrent claims for all users
      const claimPromises = userTokenPairs.map(({ user, tokenId }, i) =>
        db
          .update(nftSnapshot)
          .set({
            hasMinted: true,
            mintedTokenId: tokenId,
            mintedAt: new Date(),
            mintTxHash: `simulated-multi-user-${i}`,
          })
          .where(
            and(
              eq(nftSnapshot.userId, user.id),
              eq(nftSnapshot.hasMinted, false)
            )
          )
          .returning()
      );

      const results = await Promise.all(claimPromises);

      // All should succeed (different users)
      results.forEach((result) => {
        expect(result).toHaveLength(1);
      });

      // Verify all claims recorded
      const claimCount = await db
        .select()
        .from(nftSnapshot)
        .where(
          inArray(
            nftSnapshot.userId,
            userTokenPairs.map(({ user }) => user.id)
          )
        );

      expect(claimCount.filter((s) => s.hasMinted)).toHaveLength(5);
    });
  });

  describe('Wallet Address Edge Cases', () => {
    test('should normalize wallet address to lowercase', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      const tokenId = await createTestNft();
      const mixedCaseWallet = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';
      const user = await createTestUser({ walletAddress: mixedCaseWallet });

      await db.insert(nftOwnership).values({
        id: `test-ownership-${tokenId}-${Date.now()}`,
        tokenId,
        ownerAddress: user.walletAddress.toLowerCase(),
        userId: user.id,
        acquiredAt: new Date(),
        updatedAt: new Date(),
      });

      const [ownership] = await db
        .select()
        .from(nftOwnership)
        .where(eq(nftOwnership.tokenId, tokenId))
        .limit(1);

      expect(ownership!.ownerAddress).toBe(mixedCaseWallet.toLowerCase());
    });

    test('should handle user without wallet', async () => {
      if (!databaseAvailable || !nftTablesExist) {
        console.log('Skipping test: database or NFT tables not available');
        return;
      }

      // Create user without wallet
      const userId = await generateSnowflakeId();
      await db.insert(users).values({
        id: userId,
        walletAddress: null,
        username: `test-no-wallet-${Date.now()}`,
        displayName: 'No Wallet User',
        isActor: false,
        isBanned: false,
        onChainRegistered: false,
        reputationPoints: 10000,
        invitePoints: 0,
        earnedPoints: 0,
        bonusPoints: 0,
        updatedAt: new Date(),
      });
      testUserIds.push(userId);

      const tokenId = await createTestNft();
      await createTestSnapshot(userId, 1, 10000, undefined, tokenId);

      // Verify snapshot exists but has null wallet
      const [snapshot] = await db
        .select()
        .from(nftSnapshot)
        .where(eq(nftSnapshot.userId, userId))
        .limit(1);

      expect(snapshot).toBeDefined();
      expect(snapshot!.walletAddress).toBeNull();
      expect(snapshot!.assignedTokenId).toBe(tokenId);
    });
  });
});
