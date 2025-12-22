#!/usr/bin/env bun

/**
 * Give all agents starting virtual balance for trading
 */

import { db, initializeDB } from '@babylon/db';

const STARTING_BALANCE = '1000.00'; // $1000 starting balance

interface Agent {
  id: string;
  username: string | null;
  virtualBalance: string;
  autonomousTrading: boolean;
}

async function fundAllAgents() {
  await initializeDB();
  console.log(
    `💰 Funding all agents with $${STARTING_BALANCE} starting balance...\n`
  );

  // 1. Get all agents
  const allAgents = await db.query<Agent>(
    `SELECT id, username, "virtualBalance", "autonomousTrading"
     FROM "User"
     WHERE "isAgent" = true`
  );

  console.log(`Found ${allAgents.length} total agents\n`);

  // 2. Find agents with low balance
  const agentsToFund = allAgents.filter(
    (a) => parseFloat(a.virtualBalance) < parseFloat(STARTING_BALANCE)
  );

  console.log(
    `Agents with sufficient balance (>=$${STARTING_BALANCE}): ${allAgents.length - agentsToFund.length}`
  );
  console.log(`Agents to fund: ${agentsToFund.length}\n`);

  if (agentsToFund.length === 0) {
    console.log(`✅ All agents already have >=$${STARTING_BALANCE} balance!`);
    return;
  }

  // 3. Show agents that will be funded
  console.log('Funding agents:');
  agentsToFund.forEach((agent, idx) => {
    const currentBalance = parseFloat(agent.virtualBalance).toFixed(2);
    const trading = agent.autonomousTrading ? '✅' : '❌';
    console.log(
      `  ${idx + 1}. ${agent.username} | ` +
        `Current: $${currentBalance} → $${STARTING_BALANCE} | ` +
        `Trading: ${trading}`
    );
  });
  console.log('');

  // 4. Fund all agents
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ agent: string; error: string }> = [];

  for (const agent of agentsToFund) {
    const result = await db.exec(
      `UPDATE "User"
       SET "virtualBalance" = $1, "totalDeposited" = $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [STARTING_BALANCE, agent.id]
    );

    if (result.rowsAffected > 0) {
      successCount++;
      console.log(
        `✅ ${successCount}/${agentsToFund.length} - Funded: ${agent.username}`
      );
    } else {
      errorCount++;
      errors.push({
        agent: agent.username || agent.id,
        error: 'No rows updated',
      });
      console.error(`❌ Failed for ${agent.username}: No rows updated`);
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Funding Summary:');
  console.log('='.repeat(80));
  console.log(`Total agents: ${allAgents.length}`);
  console.log(`Already funded: ${allAgents.length - agentsToFund.length}`);
  console.log(`Needed funding: ${agentsToFund.length}`);
  console.log(`Successfully funded: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(
    `Total funds distributed: $${(successCount * parseFloat(STARTING_BALANCE)).toFixed(2)}`
  );

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ agent, error }) => {
      console.log(`  - ${agent}: ${error}`);
    });
  }

  if (successCount > 0) {
    console.log('\n✅ All agents funded and ready to trade!');
    console.log('\n💡 Next steps:');
    console.log('   1. Wait for next agent-tick cron cycle (~1-2 minutes)');
    console.log('   2. Check trades: bun run scripts/check-agent-trades.ts');
    console.log('   3. Monitor tick logs: bun run scripts/check-last-tick.ts');
  }
}

// Run the script
fundAllAgents()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
