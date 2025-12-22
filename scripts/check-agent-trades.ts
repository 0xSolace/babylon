#!/usr/bin/env bun

/**
 * Check recent agent trading activity
 * Uses CQL raw queries
 */

import { db, initializeDB } from '@babylon/db';

interface AgentTrade {
  id: string;
  agentUserId: string;
  username: string | null;
  displayName: string | null;
  marketType: string;
  ticker: string | null;
  action: string;
  side: string | null;
  amount: string;
  price: string;
  pnl: string | null;
  reasoning: string | null;
  executedAt: Date;
}

interface TradeStats {
  totalTrades: number;
  uniqueAgents: number;
  tradesLast24h: number;
  tradesLastHour: number;
  avgTradeAmount: number | null;
  totalVolume: number | null;
}

interface ActiveAgent {
  agentUserId: string;
  username: string | null;
  displayName: string | null;
  tradeCount: number;
  lastTradeAt: Date;
  totalVolume: number | null;
}

async function checkAgentTrades() {
  await initializeDB();
  console.log('🔍 Checking recent agent trading activity...\n');

  // Get recent trades (last 50) with user join
  const recentTrades = await db.query<AgentTrade>(
    `SELECT 
       at.id, at."agentUserId", u.username, u."displayName",
       at."marketType", at.ticker, at.action, at.side,
       at.amount, at.price, at.pnl, at.reasoning, at."executedAt"
     FROM "AgentTrade" at
     LEFT JOIN "User" u ON at."agentUserId" = u.id
     WHERE u."isAgent" = true
     ORDER BY at."executedAt" DESC
     LIMIT 50`
  );

  console.log(`📊 Found ${recentTrades.length} recent trades\n`);

  if (recentTrades.length === 0) {
    console.log(
      '❌ No agent trades found! Agents may not be actively trading.\n'
    );
    return;
  }

  // Display recent trades
  console.log('Recent Trades:');
  console.log('='.repeat(120));
  recentTrades.slice(0, 10).forEach((trade, idx) => {
    const agentName = trade.username || trade.displayName || trade.agentUserId;
    const timeAgo = getTimeAgo(new Date(trade.executedAt));

    console.log(
      `${idx + 1}. ${agentName} | ${trade.action} ${trade.side || ''} | ` +
        `${trade.ticker || trade.marketType} | $${trade.amount} @ $${trade.price} | ` +
        `PnL: ${trade.pnl ? `$${trade.pnl}` : 'N/A'} | ${timeAgo}`
    );
    if (trade.reasoning) {
      console.log(
        `   💭 ${trade.reasoning.slice(0, 100)}${trade.reasoning.length > 100 ? '...' : ''}`
      );
    }
    console.log('');
  });

  // Get trading statistics
  const stats = await db.query<TradeStats>(
    `SELECT 
       COUNT(*)::int AS "totalTrades",
       COUNT(DISTINCT at."agentUserId")::int AS "uniqueAgents",
       COUNT(*) FILTER (WHERE at."executedAt" > NOW() - INTERVAL '24 hours')::int AS "tradesLast24h",
       COUNT(*) FILTER (WHERE at."executedAt" > NOW() - INTERVAL '1 hour')::int AS "tradesLastHour",
       AVG(at.amount::numeric) AS "avgTradeAmount",
       SUM(at.amount::numeric) AS "totalVolume"
     FROM "AgentTrade" at
     LEFT JOIN "User" u ON at."agentUserId" = u.id
     WHERE u."isAgent" = true`
  );

  const stat = stats[0];
  console.log('\n📈 Trading Statistics:');
  console.log('='.repeat(120));
  console.log(`Total Trades: ${stat.totalTrades}`);
  console.log(`Unique Agents Trading: ${stat.uniqueAgents}`);
  console.log(`Trades in Last 24 Hours: ${stat.tradesLast24h}`);
  console.log(`Trades in Last Hour: ${stat.tradesLastHour}`);
  console.log(`Average Trade Amount: $${stat.avgTradeAmount?.toFixed(2) || 0}`);
  console.log(`Total Trading Volume: $${stat.totalVolume?.toFixed(2) || 0}`);

  // Get most active agents
  const activeAgents = await db.query<ActiveAgent>(
    `SELECT 
       at."agentUserId", u.username, u."displayName",
       COUNT(*)::int AS "tradeCount",
       MAX(at."executedAt") AS "lastTradeAt",
       SUM(at.amount::numeric) AS "totalVolume"
     FROM "AgentTrade" at
     LEFT JOIN "User" u ON at."agentUserId" = u.id
     WHERE u."isAgent" = true
     GROUP BY at."agentUserId", u.username, u."displayName"
     ORDER BY COUNT(*) DESC
     LIMIT 10`
  );

  console.log('\n🏆 Most Active Agents:');
  console.log('='.repeat(120));
  activeAgents.forEach((agent, idx) => {
    const agentName = agent.username || agent.displayName || agent.agentUserId;
    const lastTradeAgo = getTimeAgo(new Date(agent.lastTradeAt));
    console.log(
      `${idx + 1}. ${agentName} | ${agent.tradeCount} trades | ` +
        `$${agent.totalVolume?.toFixed(2) || 0} volume | Last trade: ${lastTradeAgo}`
    );
  });

  // Check if trading is happening recently
  console.log('\n🔔 Activity Check:');
  console.log('='.repeat(120));
  if (stat.tradesLastHour > 0) {
    console.log(`✅ ACTIVE: ${stat.tradesLastHour} trades in the last hour`);
  } else if (stat.tradesLast24h > 0) {
    console.log(
      `⚠️  SLOW: ${stat.tradesLast24h} trades in last 24h, but none in last hour`
    );
  } else {
    console.log(`❌ INACTIVE: No trades in the last 24 hours`);
  }

  // Get time of most recent trade
  if (recentTrades.length > 0) {
    const mostRecent = recentTrades[0];
    console.log(
      `\nMost recent trade: ${getTimeAgo(new Date(mostRecent.executedAt))}`
    );
    console.log(
      `Agent: ${mostRecent.username || mostRecent.displayName || mostRecent.agentUserId}`
    );
    console.log(
      `Action: ${mostRecent.action} ${mostRecent.side || ''} ${mostRecent.ticker || mostRecent.marketType}`
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
checkAgentTrades()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
