#!/usr/bin/env bun

/**
 * Debug script to check agent data and trade records
 */

import { db, initializeDB } from '@babylon/db';

interface TradeCount {
  count: number;
}

interface AgentTrade {
  agentUserId: string;
  action: string;
  ticker: string | null;
  executedAt: Date;
}

interface AgentUser {
  id: string;
  username: string | null;
  displayName: string | null;
  isAgent: boolean;
  managedBy: string | null;
  autonomousTrading: boolean;
  agentStatus: string | null;
  agentCount: number;
  createdAt: Date;
}

interface TradeByAgent {
  agentUserId: string;
  count: number;
}

interface AutonomousUser {
  id: string;
  username: string | null;
  displayName: string | null;
  isAgent: boolean;
  autonomousTrading: boolean;
  agentStatus: string | null;
}

interface PerpPosition {
  userId: string;
  ticker: string;
  side: string;
  size: string;
  openedAt: Date;
  closedAt: Date | null;
}

interface UserInfo {
  id: string;
  username: string | null;
  isAgent: boolean;
  autonomousTrading: boolean;
}

async function debugAgentData() {
  await initializeDB();
  console.log('🔍 Debugging agent data...\n');

  // Check if there are ANY trades in AgentTrade table
  const totalTrades = await db.query<TradeCount>(
    `SELECT COUNT(*)::int AS count FROM "AgentTrade"`
  );

  console.log(`📊 Total trades in AgentTrade table: ${totalTrades[0].count}\n`);

  if (totalTrades[0].count > 0) {
    // Show sample trades
    const sampleTrades = await db.query<AgentTrade>(
      `SELECT "agentUserId", action, ticker, "executedAt"
       FROM "AgentTrade"
       ORDER BY "executedAt" DESC
       LIMIT 5`
    );

    console.log('Sample trades:');
    sampleTrades.forEach((trade, idx) => {
      console.log(
        `${idx + 1}. Agent: ${trade.agentUserId} | Action: ${trade.action} | Ticker: ${trade.ticker} | Time: ${trade.executedAt}`
      );
    });
    console.log('');
  }

  // Check users with isAgent=true
  const agentUsers = await db.query<AgentUser>(
    `SELECT id, username, "displayName", "isAgent", "managedBy", "autonomousTrading", 
            "agentStatus", "agentCount", "createdAt"
     FROM "User"
     WHERE "isAgent" = true
     LIMIT 20`
  );

  console.log(`👤 Users with isAgent=true: ${agentUsers.length}\n`);

  if (agentUsers.length > 0) {
    console.log('Agent users:');
    agentUsers.forEach((user, idx) => {
      console.log(
        `${idx + 1}. ${user.username || user.displayName || user.id} | ` +
          `Status: ${user.agentStatus} | ` +
          `Autonomous Trading: ${user.autonomousTrading} | ` +
          `Created: ${new Date(user.createdAt).toISOString()}`
      );
    });
    console.log('');

    // Check if these agents have any trades
    const agentIds = agentUsers.map((u) => u.id);
    const placeholders = agentIds.map((_, i) => `$${i + 1}`).join(', ');
    const tradesForAgents = await db.query<TradeByAgent>(
      `SELECT "agentUserId", COUNT(*)::int AS count
       FROM "AgentTrade"
       WHERE "agentUserId" IN (${placeholders})
       GROUP BY "agentUserId"`,
      agentIds
    );

    console.log('Trades by agent users:');
    if (tradesForAgents.length === 0) {
      console.log('  None found\n');
    } else {
      tradesForAgents.forEach((stat) => {
        const agent = agentUsers.find((u) => u.id === stat.agentUserId);
        console.log(
          `  ${agent?.username || stat.agentUserId}: ${stat.count} trades`
        );
      });
      console.log('');
    }
  }

  // Check if there are users with autonomousTrading enabled
  const autonomousUsers = await db.query<AutonomousUser>(
    `SELECT id, username, "displayName", "isAgent", "autonomousTrading", "agentStatus"
     FROM "User"
     WHERE "autonomousTrading" = true
     LIMIT 20`
  );

  console.log(
    `🤖 Users with autonomousTrading=true: ${autonomousUsers.length}\n`
  );

  if (autonomousUsers.length > 0) {
    console.log('Users with autonomous trading enabled:');
    autonomousUsers.forEach((user, idx) => {
      console.log(
        `${idx + 1}. ${user.username || user.displayName || user.id} | ` +
          `isAgent: ${user.isAgent} | ` +
          `Status: ${user.agentStatus}`
      );
    });
    console.log('');
  }

  // Check PerpPositions for any recent trading activity
  const recentPositions = await db.query<PerpPosition>(
    `SELECT "userId", ticker, side, size, "openedAt", "closedAt"
     FROM "PerpPosition"
     ORDER BY "openedAt" DESC
     LIMIT 10`
  );

  console.log(
    `📈 Recent perp positions (last 10): ${recentPositions.length}\n`
  );

  if (recentPositions.length > 0) {
    console.log('Recent positions:');
    recentPositions.forEach((pos, idx) => {
      const status = pos.closedAt ? 'CLOSED' : 'OPEN';
      const timeAgo = getTimeAgo(new Date(pos.openedAt));
      console.log(
        `${idx + 1}. User: ${pos.userId.slice(0, 8)}... | ` +
          `${pos.ticker} ${pos.side} | ` +
          `Size: ${pos.size} | ` +
          `Status: ${status} | ` +
          `Opened: ${timeAgo}`
      );
    });
    console.log('');

    // Check if these users are agents
    const userIds = [...new Set(recentPositions.map((p) => p.userId))];
    const userPlaceholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const usersData = await db.query<UserInfo>(
      `SELECT id, username, "isAgent", "autonomousTrading"
       FROM "User"
       WHERE id IN (${userPlaceholders})`,
      userIds
    );

    console.log('Are these users agents?');
    usersData.forEach((user) => {
      console.log(
        `  ${user.username || user.id.slice(0, 8)}: ` +
          `isAgent=${user.isAgent}, autonomousTrading=${user.autonomousTrading}`
      );
    });
    console.log('');
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

// Run the debug check
debugAgentData()
  .then(() => {
    console.log('✅ Debug complete');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });
