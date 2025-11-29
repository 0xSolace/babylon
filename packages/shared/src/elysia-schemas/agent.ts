/**
 * Agent Elysia Type Schemas
 *
 * Schemas for agent-related API endpoints
 */

import { t } from 'elysia';
import { ISODateString, SnowflakeId, URLString, WalletAddress } from './common';

/**
 * Agent model tiers - includes all possible values for compatibility
 */
export const ModelTierSchema = t.Union([
  t.Literal('lite'),
  t.Literal('standard'),
  t.Literal('free'),
  t.Literal('pro'),
]);

/**
 * Agent status
 */
export const AgentStatusSchema = t.Union([
  t.Literal('active'),
  t.Literal('paused'),
  t.Literal('suspended'),
  t.Literal('error'),
]);

/**
 * Agent profile
 */
export const AgentProfileSchema = t.Object({
  id: SnowflakeId,
  username: t.Nullable(t.String()),
  name: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  profileImageUrl: t.Nullable(URLString),
  pointsBalance: t.Number(),
  totalDeposited: t.Number(),
  totalWithdrawn: t.Number(),
  totalPointsSpent: t.Number(),
  autonomousEnabled: t.Boolean(),
  autonomousTrading: t.Boolean(),
  autonomousPosting: t.Boolean(),
  autonomousCommenting: t.Boolean(),
  autonomousDMs: t.Boolean(),
  autonomousGroupChats: t.Boolean(),
  modelTier: ModelTierSchema,
  status: AgentStatusSchema,
  isActive: t.Boolean(),
  lifetimePnL: t.String(),
  totalTrades: t.Number(),
  profitableTrades: t.Number(),
  winRate: t.Number(),
  lastTickAt: t.Nullable(ISODateString),
  lastChatAt: t.Nullable(ISODateString),
  walletAddress: t.Nullable(WalletAddress),
  onChainRegistered: t.Boolean(),
  agent0TokenId: t.Nullable(t.String()),
  createdAt: ISODateString,
  updatedAt: ISODateString,
});

/**
 * Create agent request
 */
export const CreateAgentRequestSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  system: t.String({ minLength: 1, maxLength: 10000 }),
  description: t.Optional(t.String({ maxLength: 500 })),
  profileImageUrl: t.Optional(URLString),
  coverImageUrl: t.Optional(URLString),
  bio: t.Optional(t.Array(t.String())),
  personality: t.Optional(t.String({ maxLength: 2000 })),
  tradingStrategy: t.Optional(t.String({ maxLength: 2000 })),
  initialDeposit: t.Optional(t.Number({ default: 0, minimum: 0 })),
  modelTier: t.Optional(ModelTierSchema),
});

/**
 * Create agent response
 */
export const CreateAgentResponseSchema = t.Object({
  success: t.Boolean(),
  agent: t.Object({
    id: SnowflakeId,
    username: t.Nullable(t.String()),
    name: t.Nullable(t.String()),
    description: t.Nullable(t.String()),
    profileImageUrl: t.Nullable(URLString),
    pointsBalance: t.Number(),
    autonomousTrading: t.Boolean(),
    autonomousPosting: t.Boolean(),
    autonomousCommenting: t.Boolean(),
    autonomousDMs: t.Boolean(),
    autonomousGroupChats: t.Boolean(),
    modelTier: ModelTierSchema,
    lifetimePnL: t.String(),
    walletAddress: t.Nullable(WalletAddress),
    onChainRegistered: t.Boolean(),
    createdAt: ISODateString,
  }),
});

/**
 * List agents response
 */
export const ListAgentsResponseSchema = t.Object({
  success: t.Boolean(),
  agents: t.Array(AgentProfileSchema),
});

/**
 * Update agent request
 */
export const UpdateAgentRequestSchema = t.Object({
  name: t.Optional(t.String({ maxLength: 100 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  profileImageUrl: t.Optional(URLString),
  system: t.Optional(t.String({ maxLength: 10000 })),
  bio: t.Optional(t.Array(t.String())),
  personality: t.Optional(t.String({ maxLength: 2000 })),
  tradingStrategy: t.Optional(t.String({ maxLength: 2000 })),
  modelTier: t.Optional(ModelTierSchema),
  autonomousTrading: t.Optional(t.Boolean()),
  autonomousPosting: t.Optional(t.Boolean()),
  autonomousCommenting: t.Optional(t.Boolean()),
  autonomousDMs: t.Optional(t.Boolean()),
  autonomousGroupChats: t.Optional(t.Boolean()),
  a2aEnabled: t.Optional(t.Boolean()),
});

/**
 * Agent wallet transaction request
 */
export const AgentWalletTransactionSchema = t.Object({
  action: t.Union([t.Literal('deposit'), t.Literal('withdraw')]),
  amount: t.Number({ minimum: 1 }),
});

/**
 * Agent chat message request
 */
export const AgentChatRequestSchema = t.Object({
  message: t.String({ minLength: 1, maxLength: 5000 }),
  usePro: t.Optional(t.Boolean({ default: false })),
});

/**
 * Agent chat response
 */
export const AgentChatResponseSchema = t.Object({
  success: t.Boolean(),
  response: t.String(),
  pointsCost: t.Number(),
  balanceAfter: t.Number(),
});

/**
 * Agents query parameters
 */
export const AgentsQuerySchema = t.Object({
  autonomousTrading: t.Optional(t.Boolean()),
});

