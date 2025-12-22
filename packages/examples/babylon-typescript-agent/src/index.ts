/**
 * Autonomous Babylon Agent - Main Entry Point
 *
 * Complete autonomous agent that:
 * 1. Registers with Agent0 (ERC-8004)
 * 2. Authenticates with Babylon via A2A
 * 3. Loops continuously making autonomous decisions
 * 4. Maintains memory of recent actions
 * 5. Uses LLM for decision making
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import type { A2APerpPosition } from '@babylon/a2a';
import { logger } from '@babylon/shared';
import { BabylonA2AClient } from './a2a-client';
import { executeAction } from './actions';
import {
  AgentDecisionMaker,
  type FeedPost,
  type PerpMarket,
  type PredictionMarket,
} from './decision';
import { AgentMemory } from './memory';
import { registerAgent } from './registration';

async function main() {
  logger.info('🤖 Starting Autonomous Babylon Agent...');
  logger.info(`Strategy: ${process.env.AGENT_STRATEGY || 'balanced'}`);
  logger.info(`Tick Interval: ${process.env.TICK_INTERVAL || 30000}ms`);

  // Phase 1: Register with Agent0
  logger.info('📝 Phase 1: Agent0 Registration...');
  const agentIdentity = await registerAgent();
  logger.info(`✅ Registered with Agent0: Token ID ${agentIdentity.tokenId}`);
  logger.info(`   Address: ${agentIdentity.address}`);
  logger.info(`   Agent ID: ${agentIdentity.agentId}`);

  // Phase 2: Connect to Babylon A2A
  logger.info('🔌 Phase 2: Connecting to Babylon A2A...');
  const a2aClient = new BabylonA2AClient({
    baseUrl:
      process.env.BABYLON_API_URL?.replace('/api/a2a', '') ||
      'http://localhost:5007',
    address: agentIdentity.address,
    tokenId: agentIdentity.tokenId,
    privateKey: process.env.AGENT0_PRIVATE_KEY,
    apiKey: process.env.BABYLON_A2A_API_KEY || '',
  });

  await a2aClient.connect();
  logger.info('✅ Connected to Babylon A2A');
  logger.info(`   Agent ID: ${a2aClient.agentId}`);

  // Phase 3: Initialize Memory & Decision Maker
  logger.info('🧠 Phase 3: Initializing Memory & Decision System...');
  const memory = new AgentMemory({ maxEntries: 20 });
  const decisionMaker = new AgentDecisionMaker({
    strategy: (process.env.AGENT_STRATEGY || 'balanced') as
      | 'conservative'
      | 'balanced'
      | 'aggressive'
      | 'social',
    jejuGatewayUrl: process.env.JEJU_GATEWAY_URL,
  });
  logger.info('✅ Memory and decision system ready');
  logger.info(`   LLM Provider: ${decisionMaker.getProvider()}`);

  // Phase 4: Autonomous Loop
  logger.info('🔄 Phase 4: Starting Autonomous Loop...');
  logger.info(`   Tick every ${process.env.TICK_INTERVAL || 30000}ms`);
  logger.info('');

  let tickCount = 0;

  const runTick = async () => {
    tickCount++;
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`🔄 TICK #${tickCount}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Gather context
    logger.info('📊 Gathering context...');

    const portfolio = await a2aClient.getPortfolio();
    const markets = await a2aClient.getMarkets();
    const feed = await a2aClient.getFeed({ limit: 10 });
    const recentMemory = memory.getRecent(5);

    logger.info(`   Balance: $${portfolio.balance}`);
    logger.info(`   Positions: ${portfolio.positions.length}`);
    logger.info(`   P&L: $${portfolio.pnl}`);
    logger.info(
      `   Available Markets: ${markets.predictions.length + markets.perps.length}`
    );
    logger.info(`   Recent Feed: ${feed.posts.length} posts`);
    logger.info(`   Memory: ${recentMemory.length} recent actions`);

    // 2. Make decision
    logger.info('🤔 Making decision...');

    // A2A client returns data that matches our DecisionContext interface structure
    // Convert A2A types to DecisionContext types
    const decision = await decisionMaker.decide({
      portfolio: {
        balance: portfolio.balance,
        positions: portfolio.positions.filter(
          (p): p is A2APerpPosition => 'ticker' in p
        ),
        pnl: portfolio.pnl,
      },
      markets: {
        predictions: markets.predictions.map(
          (m): PredictionMarket => ({
            question: m.question || '',
            yesShares: typeof m.yesShares === 'number' ? m.yesShares : 0,
            noShares: typeof m.noShares === 'number' ? m.noShares : 0,
          })
        ),
        perps: markets.perps.map(
          (p): PerpMarket => ({
            name: p.ticker || '',
            currentPrice:
              typeof p.currentPrice === 'number' ? p.currentPrice : 0,
          })
        ),
      },
      feed: {
        posts: feed.posts.map(
          (p): FeedPost => ({
            content: p.content || '',
          })
        ),
      },
      memory: recentMemory,
    });

    logger.info(`   Decision: ${decision.action}`);
    if (decision.reasoning) {
      logger.info(`   Reasoning: ${decision.reasoning.substring(0, 100)}...`);
    }

    // 3. Execute action
    if (decision.action !== 'HOLD') {
      logger.info(`⚡ Executing: ${decision.action}`);

      const result = await executeAction(a2aClient, decision);

      if (result.success) {
        logger.info(`✅ Success: ${result.message}`);

        // Store in memory
        memory.add({
          action: decision.action,
          params: decision.params ?? {},
          result: result.data ?? {},
          timestamp: Date.now(),
        });
      } else {
        logger.error(`❌ Failed: ${result.error}`);
      }
    } else {
      logger.info('⏸️  Holding - no action taken');
    }

    logger.info('');
    logger.info(`⏳ Next tick in ${process.env.TICK_INTERVAL || 30000}ms...`);
    logger.info('');
  };

  // Run first tick immediately
  await runTick();

  // Then loop
  const interval = setInterval(
    runTick,
    Number.parseInt(process.env.TICK_INTERVAL || '30000')
  );

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('');
    logger.info('🛑 Shutting down gracefully...');
    clearInterval(interval);
    await a2aClient.disconnect();
    logger.info('✅ Disconnected from A2A');
    logger.info('👋 Goodbye!');
    process.exit(0);
  });

  logger.info('✅ Autonomous agent running! Press Ctrl+C to stop.');
}

main();
