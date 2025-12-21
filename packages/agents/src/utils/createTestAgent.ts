/**
 * Test Agent Creation Utility
 *
 * Creates test agents for benchmarking and RL training with proper configuration.
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db';
import { generateRandomWallet } from '@babylon/shared';
import { agentRegistry } from '../services/agent-registry.service';
import { getAgentConfig } from '../shared/agent-config';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';

export interface TestAgentConfig {
  username?: string;
  displayName?: string;
  virtualBalance?: number;
  pointsBalance?: number;
  autonomousTrading?: boolean;
  autonomousPosting?: boolean;
  autonomousCommenting?: boolean;
  autonomousDMs?: boolean;
  autonomousGroupChats?: boolean;
  systemPrompt?: string;
  modelTier?: 'lite' | 'standard' | 'pro';
}

export interface CreateTestAgentResult {
  agentId: string;
  created: boolean;
  agent: {
    id: string;
    username: string;
    displayName: string | null;
    isAgent: boolean;
  };
}

/**
 * Creates or gets a test agent
 *
 * @param prefix - Username prefix for the test agent
 * @param config - Test agent configuration
 * @returns Test agent creation result
 */
export async function createTestAgent(
  prefix = 'test-agent',
  config: TestAgentConfig = {}
): Promise<CreateTestAgentResult> {
  const {
    username,
    displayName = `${prefix} ${Date.now().toString().slice(-6)}`,
    virtualBalance = 10000,
    pointsBalance = 1000,
    autonomousTrading = true,
    autonomousPosting = true,
    autonomousCommenting = true,
    autonomousDMs = false,
    autonomousGroupChats = false,
    systemPrompt = 'You are an autonomous trading agent on Babylon prediction markets. Make smart trading decisions based on market analysis.',
    modelTier = 'lite',
  } = config;

  // Try to find existing agent with same prefix
  let agent;
  if (username) {
    agent = await db.user.findFirst({
      where: { username },
    });
  } else {
    agent = await db.user.findFirst({
      where: { username: { startsWith: prefix } },
    });
  }

  let created = false;

  if (!agent) {
    // Create new agent
    const agentId = await generateSnowflakeId();
    const finalUsername = username || `${prefix}-${agentId.slice(-6)}`;

    // Insert user record
    agent = await db.user.create({
      data: {
        id: agentId,
        privyId: `did:privy:${prefix}-${agentId}`,
        username: finalUsername,
        displayName,
        walletAddress: generateRandomWallet().address,
        isAgent: true,
        virtualBalance: String(virtualBalance),
        reputationPoints: 1000,
        isTest: true,
        updatedAt: new Date(),
      },
    });

    // Insert agent config record
    const configId = await generateSnowflakeId();
    await db.userAgentConfig.create({
      data: {
        id: configId,
        userId: agentId,
        autonomousTrading,
        autonomousPosting,
        autonomousCommenting,
        autonomousDMs,
        autonomousGroupChats,
        systemPrompt,
        modelTier,
        pointsBalance,
        updatedAt: new Date(),
      },
    });

    created = true;

    logger.info('Created test agent', {
      agentId: String(agent.id),
      username: String(agent.username),
      displayName: agent.displayName ? String(agent.displayName) : null,
    });
  } else {
    logger.info('Using existing test agent', {
      agentId: String(agent.id),
      username: String(agent.username),
    });
  }

  // Register in Agent Registry if not already registered
  const agentIdStr = String(agent.id);
  const usernameStr = String(agent.username);
  const displayNameStr = agent.displayName ? String(agent.displayName) : null;
  const isAgentBool = Boolean(agent.isAgent);

  if (isAgentBool) {
    // Check if already registered before attempting registration
    const existingReg = await agentRegistry.getAgentById(agentIdStr);

    if (!existingReg) {
      logger.info('Registering user agent...', { userId: agentIdStr });

      // Get agent config for system prompt
      const agentConfig = await getAgentConfig(agentIdStr);

      await agentRegistry.registerUserAgent({
        userId: agentIdStr,
        name: displayNameStr || usernameStr || 'Test Agent',
        systemPrompt:
          agentConfig?.systemPrompt ||
          'You are a helpful AI agent on Babylon prediction market.',
        capabilities: {
          strategies: [
            'prediction_markets',
            'social_interaction',
            'trading_analysis',
          ],
          markets: ['prediction', 'perpetual', 'spot'],
          actions: [
            'trade',
            'post',
            'comment',
            'like',
            'message',
            'analyze_market',
            'manage_portfolio',
          ],
          version: '1.0.0',
          x402Support: true,
          platform: 'babylon',
          userType: 'user_controlled',
          skills: [],
          domains: [],
        },
      });
      logger.info('Registered test agent in registry', {
        agentId: agentIdStr,
      });
    }
  }

  return {
    agentId: agentIdStr,
    created,
    agent: {
      id: agentIdStr,
      username: usernameStr,
      displayName: displayNameStr,
      isAgent: isAgentBool,
    },
  };
}

/**
 * Helper to create multiple test agents
 *
 * @param count - Number of agents to create
 * @param prefix - Username prefix
 * @param baseConfig - Base configuration for all agents
 * @returns Array of created agents
 */
export async function createTestAgents(
  count: number,
  prefix = 'test-agent',
  baseConfig: TestAgentConfig = {}
): Promise<CreateTestAgentResult[]> {
  const results: CreateTestAgentResult[] = [];

  for (let i = 0; i < count; i++) {
    const result = await createTestAgent(`${prefix}-${i}`, baseConfig);
    results.push(result);
  }

  return results;
}

/**
 * Cleanup test agents
 *
 * @param prefix - Username prefix to match
 * @returns Number of agents deleted
 */
export async function cleanupTestAgents(
  prefix = 'test-agent'
): Promise<number> {
  // Get test agents
  const testAgents = await db.user.findMany({
    where: { username: { startsWith: prefix } },
  });

  if (testAgents.length === 0) {
    return 0;
  }

  // Delete agent configs first
  for (const agent of testAgents) {
    await db.userAgentConfig.deleteMany({
      where: { userId: String(agent.id) },
    });
  }

  // Delete the agents
  const result = await db.user.deleteMany({
    where: { username: { startsWith: prefix } },
  });

  logger.info(`Cleaned up ${result.count} test agents`);
  return result.count;
}
