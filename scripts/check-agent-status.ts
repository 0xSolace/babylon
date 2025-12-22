#!/usr/bin/env bun

/**
 * Check agent status and game state
 * Diagnose why agents aren't trading
 */

import { db, initializeDB } from '@babylon/db';

interface GameState {
  id: string;
  currentDay: number;
  isContinuous: boolean;
  isRunning: boolean;
  lastTickAt: Date | null;
  createdAt: Date;
}

interface AgentRegistry {
  agentId: string;
  name: string;
  type: string;
  status: string;
  userId: string | null;
  registeredAt: Date;
  lastActiveAt: Date | null;
}

interface UserAgent {
  id: string;
  username: string | null;
  isAgent: boolean;
  autonomousTrading: boolean;
  agentStatus: string | null;
  agentPointsBalance: number;
  agentLastTickAt: Date | null;
}

interface RegistryForUser {
  userId: string | null;
  agentId: string;
  name: string;
  status: string;
}

async function checkAgentStatus() {
  await initializeDB();
  console.log('🔍 Checking agent status and game state...\n');

  // 1. Check GAME_START env var
  console.log('1️⃣  Environment Check:');
  console.log('='.repeat(120));
  console.log(
    `GAME_START: ${process.env.GAME_START || 'not set (defaults to true)'}`
  );
  console.log('');

  // 2. Check game state
  console.log('2️⃣  Game State:');
  console.log('='.repeat(120));

  const gameStates = await db.query<GameState>(
    `SELECT id, "currentDay", "isContinuous", "isRunning", "lastTickAt", "createdAt"
     FROM "Game"
     ORDER BY "createdAt" DESC
     LIMIT 5`
  );

  if (gameStates.length === 0) {
    console.log('❌ No games found in database!');
  } else {
    gameStates.forEach((game, idx) => {
      const lastTick = game.lastTickAt
        ? getTimeAgo(new Date(game.lastTickAt))
        : 'never';
      console.log(
        `${idx + 1}. Game ${game.id} (Day ${game.currentDay}) | ` +
          `isContinuous: ${game.isContinuous} | ` +
          `isRunning: ${game.isRunning} | ` +
          `Last tick: ${lastTick}`
      );
    });

    const continuousGame = gameStates.find((g) => g.isContinuous);
    if (continuousGame) {
      console.log(`\n✅ Continuous game found: ${continuousGame.id}`);
      if (continuousGame.isRunning) {
        console.log('✅ Game is RUNNING');
      } else {
        console.log('❌ Game is NOT RUNNING (isRunning=false)');
      }
    } else {
      console.log('\n❌ No continuous game found (isContinuous=true required)');
    }
  }
  console.log('');

  // 3. Check agent registry
  console.log('3️⃣  Agent Registry:');
  console.log('='.repeat(120));

  const registeredAgents = await db.query<AgentRegistry>(
    `SELECT "agentId", name, type, status, "userId", "registeredAt", "lastActiveAt"
     FROM "AgentRegistry"
     ORDER BY "registeredAt" DESC
     LIMIT 30`
  );

  console.log(`Total registered agents: ${registeredAgents.length}`);

  if (registeredAgents.length > 0) {
    console.log('\nRegistered agents:');
    registeredAgents.slice(0, 15).forEach((agent, idx) => {
      const lastActive = agent.lastActiveAt
        ? getTimeAgo(new Date(agent.lastActiveAt))
        : 'never';
      console.log(
        `${idx + 1}. ${agent.name} | ` +
          `Type: ${agent.type} | ` +
          `Status: ${agent.status} | ` +
          `Last active: ${lastActive}`
      );
    });

    // Count by status
    const statusCounts = registeredAgents.reduce(
      (acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\nAgent Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Check which ones are eligible for cron (ACTIVE, INITIALIZED, REGISTERED)
    const eligibleStatuses = ['ACTIVE', 'INITIALIZED', 'REGISTERED'];
    const eligible = registeredAgents.filter((a) =>
      eligibleStatuses.includes(a.status)
    );
    console.log(
      `\n✅ Eligible for cron (ACTIVE/INITIALIZED/REGISTERED): ${eligible.length}`
    );
  } else {
    console.log('❌ No agents registered in AgentRegistry table!');
  }
  console.log('');

  // 4. Check User table agents
  console.log('4️⃣  User Table Agents:');
  console.log('='.repeat(120));

  const userAgents = await db.query<UserAgent>(
    `SELECT id, username, "isAgent", "autonomousTrading", "agentStatus", "agentPointsBalance", "agentLastTickAt"
     FROM "User"
     WHERE "isAgent" = true
     LIMIT 20`
  );

  console.log(`Users with isAgent=true: ${userAgents.length}`);

  if (userAgents.length > 0) {
    console.log('\nAgent users with autonomous trading enabled:');
    const tradingAgents = userAgents.filter((u) => u.autonomousTrading);
    console.log(`  ${tradingAgents.length} have autonomousTrading=true`);

    tradingAgents.slice(0, 10).forEach((user, idx) => {
      const lastTick = user.agentLastTickAt
        ? getTimeAgo(new Date(user.agentLastTickAt))
        : 'never';
      console.log(
        `  ${idx + 1}. ${user.username} | ` +
          `Points: ${user.agentPointsBalance} | ` +
          `Status: ${user.agentStatus} | ` +
          `Last tick: ${lastTick}`
      );
    });

    // Check if these users are in AgentRegistry
    const userIds = userAgents.map((u) => u.id);
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const registeredForUsers = await db.query<RegistryForUser>(
      `SELECT "userId", "agentId", name, status
       FROM "AgentRegistry"
       WHERE "userId" IN (${placeholders})`,
      userIds
    );

    console.log(
      `\n🔗 Linked to AgentRegistry: ${registeredForUsers.length}/${userAgents.length}`
    );

    if (registeredForUsers.length < userAgents.length) {
      console.log('⚠️  Some user agents are NOT in AgentRegistry table!');
      const missingUserIds = userIds.filter(
        (id) => !registeredForUsers.find((r) => r.userId === id)
      );
      console.log(`   Missing: ${missingUserIds.length} agents`);
    }
  }
  console.log('');

  // 5. Summary and diagnosis
  console.log('5️⃣  Diagnosis Summary:');
  console.log('='.repeat(120));

  const issues: string[] = [];
  const checks: string[] = [];

  // Check game state
  const continuousGame = gameStates.find((g) => g.isContinuous);
  if (!continuousGame) {
    issues.push('❌ No continuous game found (need isContinuous=true)');
  } else if (!continuousGame.isRunning) {
    issues.push('❌ Game exists but not running (need isRunning=true)');
  } else {
    checks.push('✅ Continuous game is running');
  }

  // Check GAME_START env
  const gameStartEnv = process.env.GAME_START?.toLowerCase();
  if (gameStartEnv === 'false' || gameStartEnv === '0') {
    issues.push('❌ GAME_START environment variable is disabled');
  } else {
    checks.push('✅ GAME_START not disabled');
  }

  // Check agent registry
  const eligibleStatuses = ['ACTIVE', 'INITIALIZED', 'REGISTERED'];
  const eligibleAgents = registeredAgents.filter((a) =>
    eligibleStatuses.includes(a.status)
  );
  if (eligibleAgents.length === 0) {
    issues.push(
      '❌ No agents with eligible status (ACTIVE/INITIALIZED/REGISTERED)'
    );
  } else {
    checks.push(`✅ ${eligibleAgents.length} agents eligible in registry`);
  }

  // Check if user agents have points
  const agentsWithPoints = userAgents.filter((u) => u.agentPointsBalance >= 1);
  if (agentsWithPoints.length === 0 && userAgents.length > 0) {
    issues.push('⚠️  No agents have sufficient points (need >= 1)');
  } else if (agentsWithPoints.length > 0) {
    checks.push(`✅ ${agentsWithPoints.length} agents have sufficient points`);
  }

  console.log('Passing checks:');
  checks.forEach((check) => console.log(check));
  console.log('');

  if (issues.length > 0) {
    console.log('🚨 Issues found:');
    issues.forEach((issue) => console.log(issue));
    console.log('');
    console.log('💡 Agents will NOT trade until these issues are resolved.');
  } else {
    console.log(
      '✅ All checks passed! Agents should be trading if cron is running.'
    );
    console.log('');
    console.log('💡 Next steps:');
    console.log(
      '   1. Check if /api/cron/agent-tick is being called regularly'
    );
    console.log('   2. Check agent-tick logs for errors');
    console.log('   3. Manually trigger: POST /api/cron/agent-tick');
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
checkAgentStatus()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
