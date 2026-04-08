/**
 * Agent Service v2 - Agents are Users
 *
 * Core service for agent lifecycle management. Agents are implemented as users
 * with isAgent=true, allowing them to participate fully in the platform.
 *
 * @remarks
 * Architecture: Agents ARE users (isAgent=true), not separate entities.
 * They can post, comment, join chats, trade, and do everything users can do.
 * The creating user "manages" them via the managedBy field.
 * Agent configuration is stored in the UserAgentConfig table.
 *
 * @packageDocumentation
 */

import { assertPrivyOfflineConfig } from '@babylon/api';
import {
  type AgentLog,
  type AgentMessage,
  deleteUserAgentConfigByUserId,
  deleteUserById,
  insertAgentLogReturningRow,
  insertAgentLogRow,
  insertAgentPointsTransactionRow,
  insertBalanceTransactionRow,
  insertUserAgentConfigRow,
  insertUserReturningFull,
  selectAgentLogsFiltered,
  selectAgentMessagesForChatHistory,
  selectAgentsManagedByAutonomousTradingOrderCreatedDesc,
  selectAgentsManagedByOrderCreatedDesc,
  selectAgentTradesByAgentUserIdAll,
  selectUserAgentConfigByUserId,
  selectUserIdExistsForUsername,
  selectUserRowById,
  selectUserVirtualBalanceById,
  selectUserVirtualBalanceManagedByForUpdate,
  selectUserVirtualBalanceTotalDepositedById,
  selectUserVirtualBalanceTotalWithdrawnById,
  type User,
  type UserAgentConfig,
  updateUserAgentConfigByUserId,
  updateUserColumnsById,
  updateUserVirtualBalanceAndUpdatedAt,
  updateUserVirtualBalanceReturningVirtualBalance,
  updateUserVirtualBalanceTotalDeposited,
  updateUserVirtualBalanceTotalWithdrawn,
  withTransaction,
} from '@babylon/db';
import { db } from '@babylon/db/engine-storage';
import type { AgentCapabilities, JsonValue } from '@babylon/shared';
import {
  BABYLON_POINTS_SYMBOL,
  getCurrentChainId,
  IDENTITY_REGISTRY_BASE_SEPOLIA,
  REPUTATION_SYSTEM_BASE_SEPOLIA,
} from '@babylon/shared';
import { AuthorizationError } from '../errors';
import { agentIdentityService } from '../identity/AgentIdentityService';
import { agentRuntimeManager } from '../runtime/AgentRuntimeManager';
import { logger } from '../shared/logger';
import { generateSnowflakeId } from '../shared/snowflake';
import type { AgentPerformance, CreateAgentParams } from '../types';
import { agentRegistry } from './agent-registry.service';
import { teamChatService } from './TeamChatService';

/** User with agent configuration */
export type UserWithConfig = User & { agentConfig: UserAgentConfig | null };

/**
 * Get agent config for a user
 */
export async function getAgentConfig(
  userId: string
): Promise<UserAgentConfig | null> {
  const row = await selectUserAgentConfigByUserId(db, userId);
  return row ?? null;
}

/**
 * Get user with their agent config
 */
export async function getUserWithConfig(
  userId: string
): Promise<UserWithConfig | null> {
  const user = await selectUserRowById(db, userId);
  if (!user) return null;

  const config = await getAgentConfig(userId);
  return { ...user, agentConfig: config };
}

/**
 * Service for agent lifecycle management
 */
export class AgentServiceV2 {
  /**
   * Creates a new agent (creates a full User with isAgent=true)
   *
   * Creates a complete user account with agent capabilities and initial
   * configuration. Wallet readiness is provisioned asynchronously after
   * creation; wallet-specific actions must remain gated until the agent
   * reaches a ready state.
   *
   * @param params - Agent creation parameters
   * @returns Created user/agent entity
   * @throws Error if manager not found or insufficient points for deposit
   */
  async createAgent(params: CreateAgentParams): Promise<User> {
    const {
      userId: managerUserId,
      name,
      username: providedUsername,
      description,
      profileImageUrl,
      coverImageUrl,
      system,
      bio,
      personality,
      tradingStrategy,
      initialDeposit,
    } = params;

    const manager = await selectUserRowById(db, managerUserId);
    if (!manager) throw new Error('Manager user not found');

    if (initialDeposit && initialDeposit > 0) {
      const managerBalance = Number(manager.virtualBalance ?? 0);
      if (managerBalance < initialDeposit) {
        throw new Error(
          `Insufficient balance. Have: $${managerBalance.toFixed(2)}, Need: $${initialDeposit.toFixed(2)}`
        );
      }
    }

    // Use provided username or generate one
    let agentUsername: string;
    if (providedUsername) {
      const trimmed = providedUsername.trim().toLowerCase();

      // Validate format - reject invalid characters instead of sanitizing
      if (!/^[a-z0-9_]+$/.test(trimmed)) {
        throw new Error(
          'Username can only contain lowercase letters, numbers, and underscores'
        );
      }

      // Validate username length
      if (trimmed.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (trimmed.length > 20) {
        throw new Error('Username must be at most 20 characters');
      }

      agentUsername = trimmed;

      const usernameTaken = await selectUserIdExistsForUsername(
        db,
        agentUsername
      );
      if (usernameTaken) {
        throw new Error(`Username '${agentUsername}' is already taken`);
      }
    } else {
      // Auto-generate username for programmatic use cases
      const baseUsername = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 20);
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      agentUsername = `${baseUsername}_${randomSuffix}`;
    }
    const agentUserId = await generateSnowflakeId();

    const agent = await withTransaction(async (tx) => {
      const now = new Date();
      const newAgent = await insertUserReturningFull(tx, {
        id: agentUserId,
        username: agentUsername,
        displayName: name,
        bio:
          description ||
          `AI agent managed by ${manager.displayName || manager.username}`,
        profileImageUrl: profileImageUrl || null,
        coverImageUrl: coverImageUrl || null,
        isAgent: true,
        managedBy: managerUserId,
        virtualBalance: '0',
        totalDeposited: '0',
        reputationPoints: 0,
        profileComplete: true,
        hasUsername: true,
        hasBio: Boolean(description),
        hasProfileImage: Boolean(profileImageUrl),
        updatedAt: now,
      });

      await insertUserAgentConfigRow(tx, {
        id: await generateSnowflakeId(),
        userId: agentUserId,
        systemPrompt: system ?? null,
        personality: personality ?? null,
        tradingStrategy: tradingStrategy ?? null,
        messageExamples: bio ? JSON.parse(JSON.stringify(bio)) : null,
        a2aEnabled: true,
        autonomousPosting: true,
        autonomousCommenting: true,
        autonomousTrading: true,
        autonomousDMs: true,
        autonomousGroupChats: true,
        updatedAt: now,
      });

      if (initialDeposit && initialDeposit > 0) {
        const initialManagerBalance = Number(manager.virtualBalance ?? 0);

        await updateUserVirtualBalanceAndUpdatedAt(
          tx,
          managerUserId,
          String(initialManagerBalance - initialDeposit),
          now
        );

        await updateUserVirtualBalanceTotalDeposited(tx, agentUserId, {
          virtualBalance: String(initialDeposit),
          totalDeposited: String(initialDeposit),
          updatedAt: now,
        });

        await insertBalanceTransactionRow(tx, {
          id: await generateSnowflakeId(),
          userId: managerUserId,
          type: 'agent_deposit',
          amount: String(-initialDeposit),
          balanceBefore: String(initialManagerBalance),
          balanceAfter: String(initialManagerBalance - initialDeposit),
          relatedId: agentUserId,
          description: `Initial deposit to agent: ${name}`,
        });

        await insertBalanceTransactionRow(tx, {
          id: await generateSnowflakeId(),
          userId: agentUserId,
          type: 'owner_deposit',
          amount: String(initialDeposit),
          balanceBefore: '0',
          balanceAfter: String(initialDeposit),
          relatedId: managerUserId,
          description: 'Initial deposit from owner',
        });
      }

      await insertAgentLogRow(tx, {
        id: await generateSnowflakeId(),
        agentUserId,
        type: 'system',
        level: 'info',
        message: `Agent created: ${name}`,
        metadata: { initialDeposit: initialDeposit || 0 } as JsonValue,
      });

      return newAgent;
    });

    logger.info(
      `Agent user created: ${agentUserId} managed by ${managerUserId}`,
      undefined,
      'AgentService'
    );

    // Register agent in registry
    if (agentRegistry) {
      const capabilities: AgentCapabilities = {
        strategies: [
          'prediction_markets',
          'social_interaction',
          ...(tradingStrategy
            ? [`trading_${tradingStrategy.toLowerCase()}`]
            : []),
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
        gameNetwork: {
          chainId: getCurrentChainId(),
          registryAddress: IDENTITY_REGISTRY_BASE_SEPOLIA,
          reputationAddress: REPUTATION_SYSTEM_BASE_SEPOLIA,
        },
        skills: [],
        domains: [],
      };

      await agentRegistry.registerUserAgent({
        userId: agentUserId,
        name: name,
        systemPrompt:
          system || 'You are a helpful AI agent on Babylon prediction market.',
        capabilities,
      });

      logger.info(
        `Agent ${agentUserId} registered in registry`,
        undefined,
        'AgentService'
      );
    }

    if (this.shouldAutoSetupAgentIdentity()) {
      void this.setupAgentIdentity(agentUserId).catch((error) => {
        logger.error(
          'Agent identity setup failed',
          {
            agentUserId,
            error: error instanceof Error ? error.message : String(error),
          },
          'AgentService'
        );
      });
    }

    // Add agent to Agents (team chat)
    // This creates the team chat if it doesn't exist (first agent)
    try {
      await teamChatService.addAgentToTeamChat(managerUserId, agentUserId);
      logger.info(
        `Agent ${agentUserId} added to Agents`,
        undefined,
        'AgentService'
      );
    } catch (error) {
      // Log but don't fail agent creation - team chat can be synced later
      logger.error(
        `Failed to add agent ${agentUserId} to Agents: ${error}`,
        { managerUserId, agentUserId },
        'AgentService'
      );
    }

    return agent;
  }

  async getAgent(
    agentUserId: string,
    managerUserId?: string
  ): Promise<User | null> {
    const agent = await selectUserRowById(db, agentUserId);
    if (!agent) return null;
    if (!agent.isAgent) throw new Error('User is not an agent');
    if (managerUserId && agent.managedBy !== managerUserId) {
      throw new AuthorizationError(
        'You do not have permission to access this agent. You can only chat with agents you own.',
        'agent',
        'chat'
      );
    }
    return agent;
  }

  /**
   * Get agent with config
   */
  async getAgentWithConfig(
    agentUserId: string,
    managerUserId?: string
  ): Promise<UserWithConfig | null> {
    const agent = await this.getAgent(agentUserId, managerUserId);
    if (!agent) return null;

    const config = await getAgentConfig(agentUserId);
    return { ...agent, agentConfig: config };
  }

  async listUserAgents(
    managerUserId: string,
    filters?: { autonomousTrading?: boolean }
  ): Promise<User[]> {
    // If filtering by autonomousTrading, we need to join with userAgentConfigs
    if (filters?.autonomousTrading !== undefined) {
      return selectAgentsManagedByAutonomousTradingOrderCreatedDesc(
        db,
        managerUserId,
        filters.autonomousTrading
      );
    }

    return selectAgentsManagedByOrderCreatedDesc(db, managerUserId);
  }

  async updateAgent(
    agentUserId: string,
    managerUserId: string,
    updates: Partial<{
      name: string;
      description: string;
      profileImageUrl: string;
      coverImageUrl: string;
      system: string;
      bio: string[]; // Bio array for ElizaOS agentMessageExamples
      personality: string;
      tradingStrategy: string;
      modelTier: 'free' | 'pro';
      autonomousTrading: boolean;
      autonomousPosting: boolean;
      autonomousCommenting: boolean;
      autonomousDMs: boolean;
      autonomousGroupChats: boolean;
      a2aEnabled: boolean;
    }>
  ): Promise<User> {
    await this.getAgent(agentUserId, managerUserId); // Verify ownership

    if (
      updates.system ||
      updates.personality ||
      updates.modelTier ||
      updates.bio
    ) {
      await agentRuntimeManager.clearRuntime(agentUserId);
    }

    // Update user fields
    const userUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name) userUpdates.displayName = updates.name;
    if (updates.description) userUpdates.bio = updates.description;
    if (updates.profileImageUrl !== undefined)
      userUpdates.profileImageUrl = updates.profileImageUrl;
    if (updates.coverImageUrl !== undefined)
      userUpdates.coverImageUrl = updates.coverImageUrl;

    if (Object.keys(userUpdates).length > 1) {
      await updateUserColumnsById(
        db,
        agentUserId,
        userUpdates as Parameters<typeof updateUserColumnsById>[2]
      );
    }

    const configPatch: Partial<
      Omit<UserAgentConfig, 'id' | 'userId' | 'createdAt'>
    > = {};
    if (updates.system) configPatch.systemPrompt = updates.system;
    if (updates.bio)
      configPatch.messageExamples = JSON.stringify(
        updates.bio
      ) as UserAgentConfig['messageExamples'];
    if (updates.personality) configPatch.personality = updates.personality;
    if (updates.tradingStrategy)
      configPatch.tradingStrategy = updates.tradingStrategy;
    if (updates.modelTier) configPatch.modelTier = updates.modelTier;
    if (updates.autonomousTrading !== undefined)
      configPatch.autonomousTrading = updates.autonomousTrading;
    if (updates.autonomousPosting !== undefined)
      configPatch.autonomousPosting = updates.autonomousPosting;
    if (updates.autonomousCommenting !== undefined)
      configPatch.autonomousCommenting = updates.autonomousCommenting;
    if (updates.autonomousDMs !== undefined)
      configPatch.autonomousDMs = updates.autonomousDMs;
    if (updates.autonomousGroupChats !== undefined)
      configPatch.autonomousGroupChats = updates.autonomousGroupChats;
    if (updates.a2aEnabled !== undefined)
      configPatch.a2aEnabled = updates.a2aEnabled;

    if (Object.keys(configPatch).length > 0) {
      await updateUserAgentConfigByUserId(
        db,
        agentUserId,
        configPatch,
        new Date()
      );
    }

    const updatedAgent = (await selectUserRowById(db, agentUserId))!;

    await insertAgentLogRow(db, {
      id: await generateSnowflakeId(),
      agentUserId,
      type: 'system',
      level: 'info',
      message: 'Agent configuration updated',
      metadata: updates as JsonValue,
    });

    logger.info(`Agent updated: ${agentUserId}`, undefined, 'AgentService');
    return updatedAgent;
  }

  async deleteAgent(agentUserId: string, managerUserId: string): Promise<void> {
    const agentWithConfig = await this.getAgentWithConfig(
      agentUserId,
      managerUserId
    );
    if (!agentWithConfig) throw new Error('Agent not found');

    // Remove agent from Agents BEFORE deleting (so we can still get agent info)
    await teamChatService.removeAgentFromTeamChat(managerUserId, agentUserId);
    logger.info(
      `Agent ${agentUserId} removed from Agents`,
      undefined,
      'AgentService'
    );

    // Get agent's remaining balance from users table
    const agentBalance = Number(agentWithConfig.virtualBalance ?? 0);

    await withTransaction(async (tx) => {
      if (agentBalance > 0) {
        const managerRow = await selectUserVirtualBalanceById(
          tx,
          managerUserId
        );

        const currentBalance = Number(managerRow?.virtualBalance ?? 0);
        const now = new Date();

        await updateUserVirtualBalanceAndUpdatedAt(
          tx,
          managerUserId,
          String(currentBalance + agentBalance),
          now
        );

        await insertBalanceTransactionRow(tx, {
          id: await generateSnowflakeId(),
          userId: managerUserId,
          type: 'agent_balance_return',
          amount: String(agentBalance),
          balanceBefore: String(currentBalance),
          balanceAfter: String(currentBalance + agentBalance),
          relatedId: agentUserId,
          description: `Balance returned from deleted agent: ${agentWithConfig.displayName}`,
        });
      }

      await deleteUserAgentConfigByUserId(tx, agentUserId);

      await deleteUserById(tx, agentUserId);
    });

    // Clear runtime from agent runtime manager
    await agentRuntimeManager.clearRuntime(agentUserId);

    logger.info(`Agent deleted: ${agentUserId}`, undefined, 'AgentService');
  }

  /**
   * Deposit to agent's virtualBalance from manager's virtualBalance
   * @deprecated Use depositTradingBalance instead - now unified
   *
   * @param agentUserId - Agent user ID
   * @param managerUserId - Manager (owner) user ID
   * @param amount - Amount to deposit
   * @returns Updated agent User
   * @throws Error if insufficient balance or agent not found
   */
  async depositPoints(
    agentUserId: string,
    managerUserId: string,
    amount: number
  ): Promise<User> {
    // Delegate to depositTradingBalance - now unified
    return this.depositTradingBalance(agentUserId, managerUserId, amount);
  }

  /**
   * Withdraw from agent's virtualBalance to manager's virtualBalance
   * @deprecated Use withdrawTradingBalance instead - now unified
   */
  async withdrawPoints(
    agentUserId: string,
    managerUserId: string,
    amount: number
  ): Promise<User> {
    // Delegate to withdrawTradingBalance - now unified
    return this.withdrawTradingBalance(agentUserId, managerUserId, amount);
  }

  /**
   * Deposit to agent's virtualBalance from manager's virtualBalance.
   *
   * This is the canonical method for all agent deposit operations.
   * The deprecated `depositPoints` method delegates to this.
   *
   * @param agentUserId - Agent user ID
   * @param managerUserId - Manager (owner) user ID
   * @param amount - Amount to deposit
   * @returns Updated agent User
   * @throws Error if insufficient balance or agent not found
   */
  async depositTradingBalance(
    agentUserId: string,
    managerUserId: string,
    amount: number
  ): Promise<User> {
    if (amount <= 0) throw new Error('Amount must be positive');

    const agentWithConfig = await this.getAgentWithConfig(
      agentUserId,
      managerUserId
    );
    if (!agentWithConfig) throw new Error('Agent not found');

    const managerRow = await selectUserVirtualBalanceById(db, managerUserId);
    if (!managerRow) throw new Error('Manager not found');

    const managerBalance = Number(managerRow.virtualBalance ?? 0);
    if (managerBalance < amount) {
      throw new Error(
        `Insufficient trading balance. Have: $${managerBalance.toFixed(2)}, Need: $${amount.toFixed(2)}`
      );
    }

    const agentRow = await selectUserVirtualBalanceTotalDepositedById(
      db,
      agentUserId
    );

    const agentBalance = Number(agentRow?.virtualBalance ?? 0);
    const agentTotalDeposited = Number(agentRow?.totalDeposited ?? 0);

    const now = new Date();
    await withTransaction(async (tx) => {
      await updateUserVirtualBalanceAndUpdatedAt(
        tx,
        managerUserId,
        String(managerBalance - amount),
        now
      );

      await updateUserVirtualBalanceTotalDeposited(tx, agentUserId, {
        virtualBalance: String(agentBalance + amount),
        totalDeposited: String(agentTotalDeposited + amount),
        updatedAt: now,
      });

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId: managerUserId,
        type: 'agent_deposit',
        amount: String(-amount),
        balanceBefore: String(managerBalance),
        balanceAfter: String(managerBalance - amount),
        relatedId: agentUserId,
        description: `Deposit to agent: ${agentWithConfig.displayName}`,
      });

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId: agentUserId,
        type: 'owner_deposit',
        amount: String(amount),
        balanceBefore: String(agentBalance),
        balanceAfter: String(agentBalance + amount),
        relatedId: managerUserId,
        description: `Deposit from owner`,
      });
    });

    logger.info(
      `Deposited ${BABYLON_POINTS_SYMBOL}${amount} trading balance to agent ${agentUserId}`,
      undefined,
      'AgentService'
    );

    return (await selectUserRowById(db, agentUserId))!;
  }

  /**
   * Withdraw trading balance (virtualBalance) from agent to manager.
   *
   * This is the canonical method for all agent withdrawal operations.
   * The deprecated `withdrawPoints` method delegates to this.
   * Transfers USD from agent's trading balance back to user's trading balance.
   *
   * @param agentUserId - Agent user ID
   * @param managerUserId - Manager (owner) user ID
   * @param amount - Amount to withdraw
   * @returns Updated agent User
   * @throws Error if insufficient balance or agent not found
   */
  async withdrawTradingBalance(
    agentUserId: string,
    managerUserId: string,
    amount: number
  ): Promise<User> {
    if (amount <= 0) throw new Error('Amount must be positive');

    const agentWithConfig = await this.getAgentWithConfig(
      agentUserId,
      managerUserId
    );
    if (!agentWithConfig) throw new Error('Agent not found');

    const agentRow = await selectUserVirtualBalanceTotalWithdrawnById(
      db,
      agentUserId
    );

    const agentBalance = Number(agentRow?.virtualBalance ?? 0);
    const agentTotalWithdrawn = Number(agentRow?.totalWithdrawn ?? 0);
    if (agentBalance < amount) {
      throw new Error(
        `Insufficient agent trading balance. Have: $${agentBalance.toFixed(2)}, Need: $${amount.toFixed(2)}`
      );
    }

    const managerRow = await selectUserVirtualBalanceById(db, managerUserId);

    const managerBalance = Number(managerRow?.virtualBalance ?? 0);

    const now = new Date();
    await withTransaction(async (tx) => {
      await updateUserVirtualBalanceTotalWithdrawn(tx, agentUserId, {
        virtualBalance: String(agentBalance - amount),
        totalWithdrawn: String(agentTotalWithdrawn + amount),
        updatedAt: now,
      });

      await updateUserVirtualBalanceAndUpdatedAt(
        tx,
        managerUserId,
        String(managerBalance + amount),
        now
      );

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId: agentUserId,
        type: 'owner_withdraw',
        amount: String(-amount),
        balanceBefore: String(agentBalance),
        balanceAfter: String(agentBalance - amount),
        relatedId: managerUserId,
        description: `Withdrawal to owner`,
      });

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId: managerUserId,
        type: 'agent_withdraw',
        amount: String(amount),
        balanceBefore: String(managerBalance),
        balanceAfter: String(managerBalance + amount),
        relatedId: agentUserId,
        description: `Withdrawal from agent: ${agentWithConfig.displayName}`,
      });
    });

    logger.info(
      `Withdrew ${BABYLON_POINTS_SYMBOL}${amount} trading balance from agent ${agentUserId}`,
      undefined,
      'AgentService'
    );

    return (await selectUserRowById(db, agentUserId))!;
  }

  /**
   * Deduct from agent's virtualBalance for AI operations (chat, tick, post).
   *
   * @param agentUserId - Agent user ID
   * @param amount - Amount to deduct
   * @param reason - Reason for deduction (used to determine transaction type)
   * @param relatedId - Optional related entity ID
   * @returns New balance after deduction
   */
  async deductPoints(
    agentUserId: string,
    amount: number,
    reason: string,
    relatedId?: string
  ): Promise<number> {
    // Fetch and validate balance inside transaction with row-level locking to prevent race conditions
    const newBalance = await withTransaction(async (tx) => {
      const agent = await selectUserVirtualBalanceManagedByForUpdate(
        tx,
        agentUserId
      );
      if (!agent) throw new Error('Agent not found');

      const currentBalance = Number(agent.virtualBalance ?? 0);
      if (currentBalance < amount) {
        throw new Error(
          `Insufficient balance. Have: ${currentBalance.toFixed(2)}, Need: ${amount.toFixed(2)}`
        );
      }

      const now = new Date();
      const result = await updateUserVirtualBalanceReturningVirtualBalance(
        tx,
        agentUserId,
        {
          virtualBalance: String(currentBalance - amount),
          updatedAt: now,
        }
      );

      const managedBy = agent.managedBy || agentUserId;

      await insertAgentPointsTransactionRow(tx, {
        id: await generateSnowflakeId(),
        type: reason.includes('chat')
          ? 'spend_chat'
          : reason.includes('post')
            ? 'spend_post'
            : 'spend_tick',
        amount: -amount,
        balanceBefore: String(currentBalance),
        balanceAfter: String(currentBalance - amount),
        description: reason,
        relatedId: relatedId ?? null,
        agentUserId: agentUserId,
        managerUserId: managedBy,
      });

      await insertBalanceTransactionRow(tx, {
        id: await generateSnowflakeId(),
        userId: agentUserId,
        type: reason.includes('chat')
          ? 'agent_chat'
          : reason.includes('post')
            ? 'agent_post'
            : 'agent_tick',
        amount: String(-amount),
        balanceBefore: String(currentBalance),
        balanceAfter: String(currentBalance - amount),
        relatedId: relatedId ?? null,
        description: reason,
      });

      return Number(result?.virtualBalance ?? 0);
    });

    return newBalance;
  }

  async getPerformance(agentUserId: string): Promise<AgentPerformance> {
    const agent = await selectUserRowById(db, agentUserId);
    if (!agent || !agent.isAgent) throw new Error('Agent not found');

    const trades = await selectAgentTradesByAgentUserIdAll(db, agentUserId);

    const closedTrades = trades.filter((t) => t.pnl !== null);
    const profitableTrades = closedTrades.filter(
      (t) => t.pnl && t.pnl > 0
    ).length;
    const avgTradeSize =
      trades.length > 0
        ? trades.reduce((sum, t) => sum + t.amount, 0) / trades.length
        : 0;

    return {
      lifetimePnL: Number(agent.lifetimePnL),
      totalTrades: trades.length,
      profitableTrades,
      winRate:
        closedTrades.length > 0 ? profitableTrades / closedTrades.length : 0,
      avgTradeSize,
    };
  }

  async getChatHistory(
    agentUserId: string,
    limit = 50,
    cursor?: string
  ): Promise<{
    messages: AgentMessage[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const results = await selectAgentMessagesForChatHistory(db, {
      agentUserId,
      limit: limit + 1,
      cursorCreatedBefore: cursor ? new Date(cursor) : undefined,
    });

    // Check if there are more messages
    const hasMore = results.length > limit;
    const messages = hasMore ? results.slice(0, limit) : results;

    // Get the cursor for the next page (oldest message's createdAt)
    const nextCursor =
      hasMore && messages.length > 0
        ? messages[messages.length - 1]!.createdAt.toISOString()
        : null;

    return { messages, hasMore, nextCursor };
  }

  async getLogs(
    agentUserId: string,
    filters?: { type?: string; level?: string; limit?: number }
  ): Promise<AgentLog[]> {
    return selectAgentLogsFiltered(db, {
      agentUserId,
      type: filters?.type,
      level: filters?.level,
      limit: filters?.limit || 100,
    });
  }

  async createLog(
    agentUserId: string,
    log: {
      type:
        | 'chat'
        | 'tick'
        | 'trade'
        | 'error'
        | 'system'
        | 'post'
        | 'comment'
        | 'dm'
        | 'like'
        | 'repost'
        | 'follow';
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      prompt?: string;
      completion?: string;
      thinking?: string;
      metadata?: Record<string, JsonValue>;
    }
  ) {
    return insertAgentLogReturningRow(db, {
      id: await generateSnowflakeId(),
      agentUserId,
      type: log.type,
      level: log.level,
      message: log.message,
      prompt: log.prompt ?? null,
      completion: log.completion ?? null,
      thinking: log.thinking ?? null,
      metadata: log.metadata ? JSON.parse(JSON.stringify(log.metadata)) : null,
    });
  }

  private shouldAutoSetupAgentIdentity(): boolean {
    if (process.env.AUTO_CREATE_AGENT_WALLETS === 'false') {
      return false;
    }

    try {
      assertPrivyOfflineConfig();
      return true;
    } catch (error) {
      logger.warn(
        'Skipping automatic agent identity setup - Privy offline configuration is incomplete',
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'AgentService'
      );
      return false;
    }
  }

  private async setupAgentIdentity(agentUserId: string): Promise<void> {
    const skipAgent0Registration = process.env.AGENT0_ENABLED !== 'true';

    const agent = await agentIdentityService.setupAgentIdentity(agentUserId, {
      skipAgent0Registration,
    });

    logger.info(
      'Agent identity setup complete',
      {
        agentUserId,
        walletProvisioned: Boolean(agent.walletAddress),
        agent0TokenId: agent.agent0TokenId,
        skippedAgent0: skipAgent0Registration,
      },
      'AgentService'
    );
  }
}

export const agentService = new AgentServiceV2();
