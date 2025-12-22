#!/usr/bin/env bun

/**
 * Enable autonomous trading for all agents
 */

import { db, initializeDB } from '@babylon/db';

interface Agent {
  id: string;
  username: string | null;
  autonomousTrading: boolean;
  agentPointsBalance: number;
}

async function enableAllAgentTrading() {
  await initializeDB();
  console.log('🤖 Enabling autonomous trading for all agents...\n');

  // 1. Get all agents
  const allAgents = await db.query<Agent>(
    `SELECT id, username, "autonomousTrading", "agentPointsBalance"
     FROM "User"
     WHERE "isAgent" = true`
  );

  console.log(`Found ${allAgents.length} total agents\n`);

  // 2. Find agents without trading enabled
  const agentsToEnable = allAgents.filter((a) => !a.autonomousTrading);

  console.log(
    `Agents with trading already enabled: ${allAgents.length - agentsToEnable.length}`
  );
  console.log(`Agents to enable trading for: ${agentsToEnable.length}\n`);

  if (agentsToEnable.length === 0) {
    console.log('✅ All agents already have autonomous trading enabled!');
    return;
  }

  // 3. Show agents that will be updated
  console.log('Enabling trading for:');
  agentsToEnable.forEach((agent, idx) => {
    console.log(
      `  ${idx + 1}. ${agent.username} | Points: ${agent.agentPointsBalance}`
    );
  });
  console.log('');

  // 4. Enable trading for all agents
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ agent: string; error: string }> = [];

  for (const agent of agentsToEnable) {
    const result = await db.exec(
      `UPDATE "User"
       SET "autonomousTrading" = true, "updatedAt" = NOW()
       WHERE id = $1`,
      [agent.id]
    );

    if (result.rowsAffected > 0) {
      successCount++;
      console.log(
        `✅ ${successCount}/${agentsToEnable.length} - Enabled: ${agent.username}`
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
  console.log('📊 Update Summary:');
  console.log('='.repeat(80));
  console.log(`Total agents: ${allAgents.length}`);
  console.log(`Already enabled: ${allAgents.length - agentsToEnable.length}`);
  console.log(`Needed update: ${agentsToEnable.length}`);
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(({ agent, error }) => {
      console.log(`  - ${agent}: ${error}`);
    });
  }

  if (successCount > 0) {
    console.log('\n✅ Autonomous trading enabled for all agents!');
    console.log('\n💡 Next steps:');
    console.log(
      '   1. Wait for next agent-tick cron cycle (should run automatically)'
    );
    console.log('   2. Check trades: bun run scripts/check-agent-trades.ts');
    console.log('   3. Monitor activity: bun run scripts/check-last-tick.ts');
  }
}

// Run the script
enableAllAgentTrading()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
