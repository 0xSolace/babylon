import {
  agentService,
  getAgentConfig,
  isAutonomousTradingEnabled,
} from '@babylon/agents';
import { toISO, toISOOrNull } from '@babylon/shared';

export type AgentModelTier = 'free' | 'pro';

export interface OwnedAgentSummary {
  id: string;
  username: string | null;
  name: string | null;
  description: string | null;
  profileImageUrl: string | null;
  virtualBalance: number;
  autonomousEnabled: boolean;
  autonomousTrading: boolean;
  autonomousPosting: boolean;
  autonomousCommenting: boolean;
  autonomousDMs: boolean;
  autonomousGroupChats: boolean;
  a2aEnabled: boolean;
  modelTier: AgentModelTier;
  status: string;
  isActive: boolean;
  lifetimePnL: number;
  totalTrades: number;
  profitableTrades: number;
  winRate: number;
  lastTickAt: string | null;
  lastChatAt: string | null;
  walletAddress: string | null;
  onChainRegistered: boolean;
  agent0TokenId: number | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeModelTier(value: string | null | undefined): AgentModelTier {
  return value === 'pro' ? 'pro' : 'free';
}

export async function listOwnedAgentSummaries(
  managerUserId: string
): Promise<OwnedAgentSummary[]> {
  const agents = await agentService.listUserAgents(managerUserId);

  return Promise.all(
    agents.map(async (agent) => {
      const [performance, config] = await Promise.all([
        agentService.getPerformance(agent.id),
        getAgentConfig(agent.id),
      ]);

      const tradingEnabled = isAutonomousTradingEnabled(config);

      return {
        id: agent.id,
        username: agent.username,
        name: agent.displayName,
        description: agent.bio,
        profileImageUrl: agent.profileImageUrl,
        virtualBalance: Number(agent.virtualBalance ?? 0),
        autonomousEnabled: tradingEnabled,
        autonomousTrading: tradingEnabled,
        autonomousPosting: config?.autonomousPosting ?? false,
        autonomousCommenting: config?.autonomousCommenting ?? false,
        autonomousDMs: config?.autonomousDMs ?? false,
        autonomousGroupChats: config?.autonomousGroupChats ?? false,
        a2aEnabled: config?.a2aEnabled ?? false,
        modelTier: normalizeModelTier(config?.modelTier),
        status: config?.status ?? 'idle',
        isActive: config?.status === 'active',
        lifetimePnL: Number(agent.lifetimePnL ?? 0),
        totalTrades: performance.totalTrades,
        profitableTrades: performance.profitableTrades,
        winRate: performance.winRate,
        lastTickAt: toISOOrNull(config?.lastTickAt),
        lastChatAt: toISOOrNull(config?.lastChatAt),
        walletAddress: agent.walletAddress,
        onChainRegistered: agent.onChainRegistered ?? false,
        agent0TokenId: agent.agent0TokenId,
        createdAt: toISO(agent.createdAt),
        updatedAt: toISO(agent.updatedAt),
      };
    })
  );
}
