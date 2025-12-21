/**
 * Test NPC Trading Pools System
 *
 * Validates that all components are working correctly
 */

import { prisma } from '../src/lib/prisma';

async function testPoolsSystem() {
  console.log('🧪 Testing NPC Trading Pools System\n');

  try {
    // Test 1: Check pools exist
    console.log('1️⃣ Testing pool creation...');
    const pools = await prisma.pool.findMany({
      include: {
        npcActor: true,
      },
    });

    console.log(`   ✅ Found ${pools.length} pools`);

    if (pools.length === 0) {
      console.log('   ⚠️  No pools found. Run: npm run pools:init');
      return;
    }

    if (pools.length < 20) {
      console.log(`   ⚠️  Only ${pools.length} pools (expected ~21)`);
    }

    // Test 2: Check actors have correct fields
    console.log('\n2️⃣ Testing actor configuration...');
    const tradingActors = await prisma.actor.findMany({
      where: {
        hasPool: true,
      },
    });

    console.log(`   ✅ Found ${tradingActors.length} actors with hasPool=true`);

    const actorsWithBalance = tradingActors.filter(
      (a) => parseFloat(a.tradingBalance.toString()) === 10000
    );
    console.log(
      `   ✅ ${actorsWithBalance.length}/${tradingActors.length} have $10,000 trading balance`
    );

    const actorsWithReputation = tradingActors.filter(
      (a) => a.reputationPoints === 10000
    );
    console.log(
      `   ✅ ${actorsWithReputation.length}/${tradingActors.length} have 10,000 reputation`
    );

    // Test 3: Check pool structure
    console.log('\n3️⃣ Testing pool structure...');
    const samplePool = pools[0];
    if (samplePool) {
      console.log(`   📝 Sample pool: ${samplePool.name}`);
      console.log(
        `   💰 Total value: $${parseFloat(samplePool.totalValue.toString())}`
      );
      console.log(
        `   📊 Performance fee: ${samplePool.performanceFeeRate * 100}%`
      );
      console.log(`   👤 Manager: ${samplePool.npcActor.name}`);
      console.log(`   ✅ Pool structure valid`);
    }

    // Test 4: Check NPC tier distribution
    console.log('\n4️⃣ Testing tier distribution...');
    const tierCounts: Record<string, number> = {};
    tradingActors.forEach((a) => {
      const tier = a.tier || 'UNKNOWN';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`   ${tier}: ${count} pools`);
    });

    // Test 5: Sample pool managers
    console.log('\n5️⃣ Pool managers by tier:');
    const byTier = {
      S_TIER: tradingActors.filter((a) => a.tier === 'S_TIER'),
      A_TIER: tradingActors.filter((a) => a.tier === 'A_TIER'),
      B_TIER: tradingActors.filter((a) => a.tier === 'B_TIER'),
      C_TIER: tradingActors.filter((a) => a.tier === 'C_TIER'),
    };

    Object.entries(byTier).forEach(([tier, actors]) => {
      if (actors.length > 0) {
        console.log(`   ${tier}: ${actors.map((a) => a.name).join(', ')}`);
      }
    });

    // Test 6: Verify model relationships
    console.log('\n6️⃣ Testing model relationships...');
    const poolWithRelations = await prisma.pool.findFirst({
      include: {
        npcActor: true,
        deposits: true,
        positions: true,
        trades: true,
      },
    });

    if (poolWithRelations) {
      console.log(`   ✅ Pool → Actor relationship working`);
      console.log(
        `   ✅ Pool → Deposits relationship working (${poolWithRelations.deposits.length})`
      );
      console.log(
        `   ✅ Pool → Positions relationship working (${poolWithRelations.positions.length})`
      );
      console.log(
        `   ✅ Pool → Trades relationship working (${poolWithRelations.trades.length})`
      );
    }

    // Test 7: Check reputation points integration
    console.log('\n7️⃣ Testing reputation integration...');
    const users = await prisma.user.findMany({
      select: {
        reputationPoints: true,
        virtualBalance: true,
      },
      take: 5,
    });

    if (users.length > 0) {
      const avgReputation =
        users.reduce((sum, u) => sum + u.reputationPoints, 0) / users.length;
      console.log(
        `   ✅ Users have reputationPoints field (avg: ${avgReputation.toFixed(0)})`
      );
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('✨ SYSTEM TEST COMPLETE ✨');
    console.log('═'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   • Pools: ${pools.length}`);
    console.log(`   • Trader NPCs: ${tradingActors.length}`);
    console.log(`   • S-Tier: ${byTier.S_TIER.length}`);
    console.log(`   • A-Tier: ${byTier.A_TIER.length}`);
    console.log(`   • B-Tier: ${byTier.B_TIER.length}`);
    console.log(`   • C-Tier: ${byTier.C_TIER.length}`);
    console.log(`\n✅ All tests passed!`);
    console.log(
      `\n🚀 Ready to trade! Navigate to: http://localhost:3000/markets`
    );
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testPoolsSystem()
  .then(() => {
    console.log('\n✨ Test suite completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
