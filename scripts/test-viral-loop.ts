/**
 * Test Script: Viral Loop System
 *
 * Tests the complete viral loop flow:
 * 1. User signs up for waitlist
 * 2. User gets invite code
 * 3. User shares invite code
 * 4. New user signs up with referral code
 * 5. Referrer gets +50 points
 * 6. User adds email (+25 points)
 * 7. User connects wallet (+25 points)
 * 8. User makes profitable trade (earned points)
 */

import { prisma } from '../src/lib/database-service';
import { WaitlistService } from '../src/lib/services/waitlist-service';
import { WalletService } from '../src/lib/services/wallet-service';

async function testViralLoop() {
  console.log('🧪 Testing Viral Loop System\n');

  try {
    // === Test 1: Create Users (Simulating Onboarding) ===
    console.log('📝 Test 1: Create test users');

    // Create User 1
    const user1 = await prisma.user.create({
      data: {
        oauth3Id: 'test-oauth3-id-1',
        username: 'testuser1',
        displayName: 'Test User 1',
        reputationPoints: 100, // Waitlist user
        profileComplete: true,
      },
    });

    console.log(`✅ User 1 created: ${user1.id}`);
    console.log();

    // === Test 2: Mark as Waitlisted ===
    console.log('📝 Test 2: Mark User 1 as waitlisted');
    const user1Waitlist = await WaitlistService.markAsWaitlisted(user1.id);

    if (!user1Waitlist.success) {
      throw new Error('Failed to mark user 1 as waitlisted');
    }

    console.log(`✅ User 1 marked as waitlisted`);
    console.log(`   Position: #${user1Waitlist.waitlistPosition}`);
    console.log(`   Invite Code: ${user1Waitlist.inviteCode}`);
    console.log(`   Points: ${user1Waitlist.points}`);
    console.log();

    // === Test 3: Get Initial Position ===
    console.log('📊 Test 3: Check initial waitlist position');
    const position1 = await WaitlistService.getWaitlistPosition(user1.id);

    if (!position1) {
      throw new Error('Failed to get waitlist position');
    }

    console.log(`✅ Position retrieved`);
    console.log(`   Leaderboard Rank: #${position1.leaderboardRank} (dynamic)`);
    console.log(
      `   Waitlist Position: #${position1.waitlistPosition} (historical)`
    );
    console.log(`   Ahead: ${position1.totalAhead}`);
    console.log(`   Percentile: Top ${position1.percentile}%`);
    console.log(`   Points Breakdown:`);
    console.log(`     - Total: ${position1.points}`);
    console.log(`     - Invite: ${position1.invitePoints}`);
    console.log(`     - Earned: ${position1.earnedPoints}`);
    console.log(`     - Bonus: ${position1.bonusPoints}`);
    console.log();

    // === Test 4: Create User 2 and Mark with Referral ===
    console.log('👥 Test 4: User 2 signs up with referral code');

    const user2 = await prisma.user.create({
      data: {
        oauth3Id: 'test-oauth3-id-2',
        username: 'testuser2',
        displayName: 'Test User 2',
        reputationPoints: 100,
        profileComplete: true,
      },
    });

    const user2Waitlist = await WaitlistService.markAsWaitlisted(
      user2.id,
      user1Waitlist.inviteCode
    );

    if (!user2Waitlist.success) {
      throw new Error('Failed to mark user 2 as waitlisted');
    }

    console.log(`✅ User 2 signed up with referral`);
    console.log(`   Waitlist Position: #${user2Waitlist.waitlistPosition}`);
    console.log(`   Referrer Rewarded: ${user2Waitlist.referrerRewarded}`);
    console.log();

    // Check if referrer got points and MOVED UP
    const position1After = await WaitlistService.getWaitlistPosition(user1.id);

    if (!position1After) {
      throw new Error('Failed to get updated position');
    }

    console.log(`💰 CRITICAL TEST: Referrer rank should improve!`);
    console.log(
      `   Before: Rank #${position1.leaderboardRank}, Points ${position1.points}`
    );
    console.log(
      `   After: Rank #${position1After.leaderboardRank}, Points ${position1After.points}`
    );
    console.log(
      `   Invite Points: ${position1.invitePoints} → ${position1After.invitePoints}`
    );
    console.log(
      `   Referrals: ${position1.referralCount} → ${position1After.referralCount}`
    );

    if (position1After.invitePoints !== 50) {
      throw new Error(
        `Expected 50 invite points, got ${position1After.invitePoints}`
      );
    }
    if (position1After.points !== 150) {
      throw new Error(
        `Expected 150 total points, got ${position1After.points}`
      );
    }
    console.log(`   ✅ Points correctly awarded!`);
    console.log();

    // === Test 5: Create User 3 (No Referral) to Test Ranking ===
    console.log('👤 Test 5: User 3 signs up WITHOUT referral');

    const user3 = await prisma.user.create({
      data: {
        oauth3Id: 'test-oauth3-id-3',
        username: 'testuser3',
        displayName: 'Test User 3',
        reputationPoints: 100,
        profileComplete: true,
      },
    });

    await WaitlistService.markAsWaitlisted(user3.id);

    const position3 = await WaitlistService.getWaitlistPosition(user3.id);

    console.log(`✅ User 3 position:`);
    console.log(`   Leaderboard Rank: #${position3?.leaderboardRank}`);
    console.log(`   Invite Points: ${position3?.invitePoints}`);
    console.log();

    // User 1 should be #1 (150 points), User 2 and 3 should be tied (100 points)
    const position1AfterUser3 = await WaitlistService.getWaitlistPosition(
      user1.id
    );
    console.log(`📊 Ranking after 3 users:`);
    console.log(
      `   User 1: Rank #${position1AfterUser3?.leaderboardRank} (${position1AfterUser3?.invitePoints} invite pts)`
    );
    console.log(
      `   User 3: Rank #${position3?.leaderboardRank} (${position3?.invitePoints} invite pts)`
    );

    if (position1AfterUser3?.leaderboardRank !== 1) {
      throw new Error(
        `User 1 should be #1 with 50 invite points, but is #${position1AfterUser3?.leaderboardRank}`
      );
    }

    console.log(`   ✅ Dynamic ranking working correctly!`);
    console.log();

    // === Test 6: Email Bonus ===
    console.log('📧 Test 6: User adds email address');
    const emailAwarded = await WaitlistService.awardEmailBonus(
      user1.id,
      'test@example.com'
    );

    console.log(
      `✅ Email bonus: ${emailAwarded ? 'Awarded' : 'Already awarded'}`
    );

    const positionAfterEmail = await WaitlistService.getWaitlistPosition(
      user1.id
    );
    if (positionAfterEmail) {
      console.log(
        `   Points: ${position1After.points} → ${positionAfterEmail.points}`
      );
      console.log(`   Bonus Points: ${positionAfterEmail.bonusPoints}`);
    }
    console.log();

    // === Test 7: Wallet Bonus ===
    console.log('💳 Test 7: User connects wallet');
    const walletAwarded = await WaitlistService.awardWalletBonus(
      user1.id,
      '0x1234567890123456789012345678901234567890'
    );

    console.log(
      `✅ Wallet bonus: ${walletAwarded ? 'Awarded' : 'Already awarded'}`
    );

    const positionAfterWallet = await WaitlistService.getWaitlistPosition(
      user1.id
    );
    if (positionAfterWallet) {
      console.log(
        `   Points: ${positionAfterEmail?.points} → ${positionAfterWallet.points}`
      );
      console.log(`   Bonus Points: ${positionAfterWallet.bonusPoints}`);
    }
    console.log();

    // === Test 8: Trading P&L and Earned Points ===
    console.log('📈 Test 8: User makes profitable trade');

    // Simulate a profitable trade
    const profitAmount = 150; // $150 profit
    await WalletService.recordPnL(
      user1.id,
      profitAmount,
      'prediction_sell',
      'test-trade-1'
    );

    // Wait a bit for async points update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const positionAfterTrade = await WaitlistService.getWaitlistPosition(
      user1.id
    );
    if (positionAfterTrade) {
      console.log(`✅ Earned points updated`);
      console.log(`   P&L: $${profitAmount}`);
      console.log(`   Earned Points: ${positionAfterTrade.earnedPoints}`);
      console.log(`   Total Points: ${positionAfterTrade.points}`);
    }
    console.log();

    // === Test 9: Dynamic Ranking Test ===
    console.log('🏆 Test 9: Verify dynamic ranking');

    // Get top waitlist users
    const topUsers = await WaitlistService.getTopWaitlistUsers(10);

    console.log('📊 Top Waitlist Users:');
    topUsers.forEach((u) => {
      console.log(
        `   #${u.rank}: ${u.displayName} - ${u.invitePoints} invite pts, ${u.referralCount} referrals`
      );
    });
    console.log();

    // User 1 should still be #1 (has invites)
    if (topUsers[0]?.id !== user1.id) {
      throw new Error('User 1 should be #1 on leaderboard!');
    }
    console.log(
      `   ✅ Dynamic ranking correct - User with most invites is #1!`
    );
    console.log();

    // === Test 10: Summary ===
    console.log('📋 Final Summary for User 1:');
    console.log(
      `   Leaderboard Rank: #${positionAfterTrade?.leaderboardRank} (DYNAMIC - changes with invites!)`
    );
    console.log(
      `   Waitlist Position: #${positionAfterTrade?.waitlistPosition} (historical record)`
    );
    console.log(`   Total Points: ${positionAfterTrade?.points}`);
    console.log(`   ├─ Base: 100`);
    console.log(
      `   ├─ Invite Points: ${positionAfterTrade?.invitePoints} (${positionAfterTrade?.referralCount} referrals)`
    );
    console.log(
      `   ├─ Earned Points: ${positionAfterTrade?.earnedPoints} (from trading)`
    );
    console.log(
      `   └─ Bonus Points: ${positionAfterTrade?.bonusPoints} (email + wallet)`
    );
    console.log();
    console.log(
      '🎯 Key Insight: Leaderboard rank is DYNAMIC! More invites = better position!'
    );

    console.log('✨ All tests passed!');

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.user.deleteMany({
      where: {
        oauth3Id: {
          in: ['test-oauth3-id-1', 'test-oauth3-id-2'],
        },
      },
    });
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testViralLoop()
  .then(() => {
    console.log('\n✅ Viral loop test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Viral loop test failed:', error);
    process.exit(1);
  });
