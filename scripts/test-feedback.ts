#!/usr/bin/env bun
/**
 * Manual testing script for feedback system
 *
 * Usage:
 *   bun run scripts/test-feedback.ts
 *
 * This script tests:
 * 1. Auto-generated trade feedback
 * 2. Auto-generated game feedback
 * 3. Manual feedback submission
 * 4. Feedback metrics updates
 */

import { prisma } from '../src/lib/database-service';
import {
  CompletionFormat,
  type GameMetrics,
  generateGameCompletionFeedback,
  type TradeMetrics,
} from '../src/lib/reputation/reputation-service';

async function createTestUser(username: string) {
  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    return existing;
  }

  return await prisma.user.create({
    data: {
      oauth3Id: `test-${Date.now()}-${Math.random()}`,
      username,
      displayName: `Test ${username}`,
    },
  });
}

async function testTradeFeedback() {
  console.log('\n🧪 Testing Trade Feedback Generation...\n');

  const user = await createTestUser('test-trader');

  // Test 1: Excellent trade
  console.log('Test 1: Excellent profitable trade');
  const excellentTrade: TradeMetrics = {
    profitable: true,
    roi: 0.75, // 75% ROI
    holdingPeriod: 6, // 6 hours
    timingScore: 0.95,
    riskScore: 0.9,
  };

  const excellentFeedback = await CompletionFormat(
    user.id,
    `test_excellent_${Date.now()}`,
    excellentTrade
  );

  console.log(`  ✅ Generated feedback ID: ${excellentFeedback.id}`);
  console.log(`  📊 Score: ${excellentFeedback.score}/100`);
  console.log(`  💬 Comment: ${excellentFeedback.comment}`);
  console.log(
    `  📝 Metadata:`,
    JSON.stringify(excellentFeedback.metadata, null, 2)
  );

  // Test 2: Poor trade
  console.log('\nTest 2: Poor unprofitable trade');
  const poorTrade: TradeMetrics = {
    profitable: false,
    roi: -0.35, // -35% ROI
    holdingPeriod: 72, // 3 days
    timingScore: 0.2,
    riskScore: 0.3,
  };

  const poorFeedback = await CompletionFormat(
    user.id,
    `test_poor_${Date.now()}`,
    poorTrade
  );

  console.log(`  ✅ Generated feedback ID: ${poorFeedback.id}`);
  console.log(`  📊 Score: ${poorFeedback.score}/100`);
  console.log(`  💬 Comment: ${poorFeedback.comment}`);

  // Test 3: Moderate trade
  console.log('\nTest 3: Moderate trade');
  const moderateTrade: TradeMetrics = {
    profitable: true,
    roi: 0.15, // 15% ROI
    holdingPeriod: 24,
    timingScore: 0.6,
    riskScore: 0.5,
  };

  const moderateFeedback = await CompletionFormat(
    user.id,
    `test_moderate_${Date.now()}`,
    moderateTrade
  );

  console.log(`  ✅ Generated feedback ID: ${moderateFeedback.id}`);
  console.log(`  📊 Score: ${moderateFeedback.score}/100`);
  console.log(`  💬 Comment: ${moderateFeedback.comment}`);

  // Check metrics
  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: user.id },
  });

  console.log('\n📈 Updated Metrics:');
  console.log(`  Total Feedback Count: ${metrics?.totalFeedbackCount || 0}`);
  console.log(
    `  Average Feedback Score: ${metrics?.averageFeedbackScore || 0}`
  );
  console.log(`  Total Trades: ${metrics?.totalTrades || 0}`);

  return user;
}

async function testGameFeedback() {
  console.log('\n\n🎮 Testing Game Feedback Generation...\n');

  const user = await createTestUser('test-gamer');

  // Test 1: Winning game
  console.log('Test 1: Winning game with good performance');
  const winningGame: GameMetrics = {
    won: true,
    pnl: 600,
    positionsClosed: 6,
    finalBalance: 1600,
    startingBalance: 1000,
    decisionsCorrect: 9,
    decisionsTotal: 10,
    riskManagement: 0.85,
  };

  const winningFeedback = await generateGameCompletionFeedback(
    user.id,
    `test_winning_game_${Date.now()}`,
    winningGame
  );

  console.log(`  ✅ Generated feedback ID: ${winningFeedback.id}`);
  console.log(`  📊 Score: ${winningFeedback.score}/100`);
  console.log(`  💬 Comment: ${winningFeedback.comment}`);
  console.log(
    `  📝 Metadata:`,
    JSON.stringify(winningFeedback.metadata, null, 2)
  );

  // Test 2: Losing game
  console.log('\nTest 2: Losing game');
  const losingGame: GameMetrics = {
    won: false,
    pnl: -300,
    positionsClosed: 4,
    finalBalance: 700,
    startingBalance: 1000,
    decisionsCorrect: 4,
    decisionsTotal: 10,
    riskManagement: 0.4,
  };

  const losingFeedback = await generateGameCompletionFeedback(
    user.id,
    `test_losing_game_${Date.now()}`,
    losingGame
  );

  console.log(`  ✅ Generated feedback ID: ${losingFeedback.id}`);
  console.log(`  📊 Score: ${losingFeedback.score}/100`);
  console.log(`  💬 Comment: ${losingFeedback.comment}`);

  // Check metrics
  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: user.id },
  });

  console.log('\n📈 Updated Metrics:');
  console.log(`  Games Played: ${metrics?.gamesPlayed || 0}`);
  console.log(`  Games Won: ${metrics?.gamesWon || 0}`);
  console.log(`  Average Game Score: ${metrics?.averageGameScore || 0}`);
  console.log(`  Total Feedback Count: ${metrics?.totalFeedbackCount || 0}`);

  return user;
}

async function testManualFeedback() {
  console.log('\n\n✍️  Testing Manual Feedback Submission...\n');

  const fromUser = await createTestUser('test-feedback-giver');
  const toUser = await createTestUser('test-feedback-receiver');

  // Test 1: Submit feedback with score
  console.log('Test 1: Submit feedback with score');
  const feedback1 = await prisma.feedback.create({
    data: {
      fromUserId: fromUser.id,
      toUserId: toUser.id,
      score: 85,
      comment: 'Great performance! Very impressed.',
      category: 'general',
      interactionType: 'user_to_agent',
    },
  });

  console.log(`  ✅ Created feedback ID: ${feedback1.id}`);
  console.log(`  📊 Score: ${feedback1.score}/100`);
  console.log(`  💬 Comment: ${feedback1.comment}`);

  // Test 2: Submit feedback with stars (converted to score)
  console.log('\nTest 2: Submit feedback with 5 stars');
  const feedback2 = await prisma.feedback.create({
    data: {
      fromUserId: fromUser.id,
      toUserId: toUser.id,
      score: 5 * 20, // 5 stars = 100 score
      rating: 5,
      comment: 'Perfect!',
      category: 'trade_performance',
      interactionType: 'user_to_agent',
    },
  });

  console.log(`  ✅ Created feedback ID: ${feedback2.id}`);
  console.log(`  ⭐ Rating: ${feedback2.rating}/5`);
  console.log(`  📊 Score: ${feedback2.score}/100`);

  // Check receiver's metrics
  const receiverMetrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: toUser.id },
  });

  console.log('\n📈 Receiver Metrics:');
  console.log(
    `  Total Feedback Count: ${receiverMetrics?.totalFeedbackCount || 0}`
  );
  console.log(
    `  Average Feedback Score: ${receiverMetrics?.averageFeedbackScore || 0}`
  );
  console.log(`  Average Rating: ${receiverMetrics?.averageRating || 'N/A'}`);

  return { fromUser, toUser };
}

async function testFeedbackQueries() {
  console.log('\n\n🔍 Testing Feedback Queries...\n');

  const user = await createTestUser('test-query-user');

  // Generate some feedback
  await CompletionFormat(user.id, `query_test_1_${Date.now()}`, {
    profitable: true,
    roi: 0.4,
    holdingPeriod: 12,
    timingScore: 0.7,
    riskScore: 0.6,
  });

  await CompletionFormat(user.id, `query_test_2_${Date.now()}`, {
    profitable: false,
    roi: -0.2,
    holdingPeriod: 48,
    timingScore: 0.4,
    riskScore: 0.5,
  });

  // Query feedback received
  const feedbackReceived = await prisma.feedback.findMany({
    where: { toUserId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${feedbackReceived.length} feedback entries:`);
  feedbackReceived.forEach((fb, idx) => {
    console.log(
      `  ${idx + 1}. Score: ${fb.score}, Category: ${fb.category}, Created: ${fb.createdAt.toISOString()}`
    );
  });

  // Query by category
  const tradeFeedback = await prisma.feedback.findMany({
    where: {
      toUserId: user.id,
      category: 'trade_performance',
    },
  });

  console.log(`\nTrade performance feedback: ${tradeFeedback.length} entries`);

  // Check metrics aggregation
  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: user.id },
  });

  if (metrics) {
    console.log('\n📊 Aggregated Metrics:');
    console.log(`  Positive (>=70): ${metrics.positiveCount}`);
    console.log(`  Neutral (40-69): ${metrics.neutralCount}`);
    console.log(`  Negative (<40): ${metrics.negativeCount}`);
  }
}

async function cleanup() {
  console.log('\n\n🧹 Cleaning up test data...\n');

  const testUsers = await prisma.user.findMany({
    where: {
      username: {
        startsWith: 'test-',
      },
    },
  });

  if (testUsers.length > 0) {
    const userIds = testUsers.map((u) => u.id);

    await prisma.feedback.deleteMany({
      where: {
        OR: [{ toUserId: { in: userIds } }, { fromUserId: { in: userIds } }],
      },
    });

    await prisma.agentPerformanceMetrics.deleteMany({
      where: {
        userId: { in: userIds },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
      },
    });

    console.log(
      `  ✅ Cleaned up ${testUsers.length} test users and associated data`
    );
  } else {
    console.log('  ℹ️  No test users found to clean up');
  }
}

async function main() {
  console.log('🚀 Starting Feedback System Tests\n');
  console.log('='.repeat(60));

  try {
    // Test trade feedback
    await testTradeFeedback();

    // Test game feedback
    await testGameFeedback();

    // Test manual feedback
    await testManualFeedback();

    // Test queries
    await testFeedbackQueries();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All tests completed successfully!');

    // Ask if user wants to cleanup
    const args = process.argv.slice(2);
    if (args.includes('--cleanup') || args.includes('-c')) {
      await cleanup();
    } else {
      console.log('\n💡 Tip: Run with --cleanup to remove test data');
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
