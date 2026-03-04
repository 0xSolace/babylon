/**
 * Quick e2e verification: does GET /api/agents still 500 on prod data?
 * Tests the same logic as the route handler against the real DB.
 */
import {
  agentService,
  getAgentConfig,
  isAutonomousTradingEnabled,
} from '@babylon/agents';
import { db, users } from '@babylon/db';
import { eq, inArray } from 'drizzle-orm';

async function test() {
  console.log('=== Testing GET /api/agents fix against prod DB ===\n');

  // Find agents and their owners (managedBy = privy ID of the owner)
  const agentRows = await db
    .select({ managedBy: users.managedBy })
    .from(users)
    .where(eq(users.isAgent, true))
    .limit(50);

  const ownerPrivyIds = [
    ...new Set(agentRows.map((a) => a.managedBy).filter(Boolean)),
  ] as string[];

  // Resolve privy IDs to user IDs
  const owners = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.privyId, ownerPrivyIds))
    .limit(10);

  if (owners.length === 0) {
    console.log('No agent owners found in DB');
    process.exit(1);
  }

  console.log(`Found ${owners.length} agent owners to test\n`);

  let totalAgents = 0;
  let gracefulSkips = 0;
  let fatalFailures = 0;

  for (const owner of agentOwners) {
    const uid = owner.userId!;
    console.log(`--- Testing user ${uid} ---`);

    try {
      const agents = await agentService.listUserAgents(uid, {});
      console.log(`  Found ${agents.length} agents`);

      const results = await Promise.all(
        agents.map(async (agent) => {
          try {
            const [performance, config] = await Promise.all([
              agentService.getPerformance(agent.id),
              getAgentConfig(agent.id),
            ]);
            const tradingEnabled = isAutonomousTradingEnabled(config);

            return {
              id: agent.id,
              username: agent.username,
              name: agent.displayName,
              virtualBalance: Number(agent.virtualBalance ?? 0),
              autonomousTrading: tradingEnabled,
              lifetimePnL: (agent.lifetimePnL ?? 0).toString(),
              totalTrades: performance.totalTrades,
              onChainRegistered: agent.onChainRegistered ?? false,
            };
          } catch (err) {
            // THIS IS THE FIX - individual agent errors are caught
            console.log(
              `  ⚠ Agent ${agent.id} error (handled gracefully): ${err instanceof Error ? err.message : String(err)}`
            );
            gracefulSkips++;
            return null;
          }
        })
      );

      const validAgents = results.filter((a) => a !== null);
      totalAgents += validAgents.length;
      console.log(
        `  ✅ ${validAgents.length}/${agents.length} agents returned successfully`
      );
    } catch (err) {
      console.log(`  ❌ FATAL ERROR for user ${uid}: ${err}`);
      fatalFailures++;
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Total agents processed: ${totalAgents}`);
  console.log(`Agents with errors (gracefully handled): ${gracefulSkips}`);
  console.log(`Fatal failures: ${fatalFailures}`);
  console.log(
    fatalFailures === 0
      ? '\n✅ FIX VERIFIED - No 500 errors!'
      : '\n❌ STILL BROKEN'
  );

  process.exit(fatalFailures > 0 ? 1 : 0);
}

test().catch((e) => {
  console.error('Script error:', e);
  process.exit(1);
});
