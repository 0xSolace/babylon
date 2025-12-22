#!/usr/bin/env bun

/**
 * Check when the last agent tick ran
 */

import { db, initializeDB } from '@babylon/db';

interface GameInfo {
  id: string;
  currentDay: number;
  lastTickAt: Date | null;
  isRunning: boolean;
}

interface AgentWithTick {
  id: string;
  username: string | null;
  agentLastTickAt: Date | null;
  agentStatus: string | null;
  agentPointsBalance: number;
}

interface TickStat {
  hasTickedRecently: boolean;
  count: number;
}

interface TickLog {
  agentUserId: string;
  username: string | null;
  type: string;
  level: string;
  message: string;
  createdAt: Date;
}

async function checkLastTick() {
  await initializeDB();
  console.log('🕐 Checking last agent tick times...\n');

  // 1. Check game tick
  console.log('1️⃣  Game Tick:');
  console.log('='.repeat(80));

  const game = await db.query<GameInfo>(
    `SELECT id, "currentDay", "lastTickAt", "isRunning"
     FROM "Game"
     WHERE "isContinuous" = true
     LIMIT 1`
  );

  if (game[0]) {
    const lastTick = game[0].lastTickAt
      ? `${getTimeAgo(new Date(game[0].lastTickAt))} (${new Date(game[0].lastTickAt).toISOString()})`
      : 'never';
    console.log(`Game: ${game[0].id}`);
    console.log(`Last Tick: ${lastTick}`);
    console.log(`Status: ${game[0].isRunning ? 'RUNNING' : 'PAUSED'}`);
  }
  console.log('');

  // 2. Check agent last tick times from User table
  console.log('2️⃣  Agent Last Tick (from User table):');
  console.log('='.repeat(80));

  const agentsWithTicks = await db.query<AgentWithTick>(
    `SELECT id, username, "agentLastTickAt", "agentStatus", "agentPointsBalance"
     FROM "User"
     WHERE "isAgent" = true
     ORDER BY "agentLastTickAt" DESC NULLS LAST
     LIMIT 10`
  );

  console.log('Agents with most recent ticks:');
  agentsWithTicks.forEach((agent, idx) => {
    const lastTick = agent.agentLastTickAt
      ? `${getTimeAgo(new Date(agent.agentLastTickAt))} (${new Date(agent.agentLastTickAt).toISOString()})`
      : 'never';
    console.log(
      `${idx + 1}. ${agent.username} | ` +
        `Last tick: ${lastTick} | ` +
        `Status: ${agent.agentStatus} | ` +
        `Points: ${agent.agentPointsBalance}`
    );
  });

  // Count agents by tick status
  const tickStats = await db.query<TickStat>(
    `SELECT 
       CASE WHEN "agentLastTickAt" > NOW() - INTERVAL '1 hour' THEN true ELSE false END AS "hasTickedRecently",
       COUNT(*)::int AS count
     FROM "User"
     WHERE "isAgent" = true
     GROUP BY CASE WHEN "agentLastTickAt" > NOW() - INTERVAL '1 hour' THEN true ELSE false END`
  );

  console.log('\nTick Statistics:');
  tickStats.forEach((stat) => {
    const label = stat.hasTickedRecently
      ? 'Ticked in last hour'
      : 'Not ticked recently';
    console.log(`  ${label}: ${stat.count}`);
  });
  console.log('');

  // 3. Check agent logs for tick events
  console.log('3️⃣  Recent Tick Logs:');
  console.log('='.repeat(80));

  const recentTickLogs = await db.query<TickLog>(
    `SELECT al."agentUserId", u.username, al.type, al.level, al.message, al."createdAt"
     FROM "AgentLog" al
     LEFT JOIN "User" u ON al."agentUserId" = u.id
     WHERE al.type = 'tick'
     ORDER BY al."createdAt" DESC
     LIMIT 10`
  );

  if (recentTickLogs.length > 0) {
    console.log('Most recent tick logs:');
    recentTickLogs.forEach((log, idx) => {
      const timeAgo = getTimeAgo(new Date(log.createdAt));
      console.log(
        `${idx + 1}. ${log.username} | ` + `${timeAgo} | ` + `${log.message}`
      );
    });
  } else {
    console.log('❌ No tick logs found in AgentLog table');
  }
  console.log('');

  // 4. Summary
  console.log('4️⃣  Summary:');
  console.log('='.repeat(80));

  const anyRecentTicks = agentsWithTicks.some(
    (a) =>
      a.agentLastTickAt &&
      Date.now() - new Date(a.agentLastTickAt).getTime() < 3600000 // 1 hour
  );

  if (anyRecentTicks) {
    console.log('✅ Agents have ticked recently');
  } else if (agentsWithTicks.some((a) => a.agentLastTickAt !== null)) {
    const mostRecent = agentsWithTicks.find((a) => a.agentLastTickAt !== null);
    if (mostRecent?.agentLastTickAt) {
      console.log(
        `⚠️  Last agent tick was ${getTimeAgo(new Date(mostRecent.agentLastTickAt))}`
      );
      console.log('   Agent tick cron may not be running');
    }
  } else {
    console.log('❌ No agents have ever ticked');
    console.log(
      '   The /api/cron/agent-tick endpoint has never run successfully'
    );
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

// Run the check
checkLastTick()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
