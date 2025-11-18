/**
 * Agent Discovery Service
 *
 * Merges local agent registry with Agent0 network discovery
 * to provide comprehensive agent search.
 */

import { logger } from '@/lib/logger';
import type { AgentProfile } from '@/types/a2a';
import { AgentRegistry } from '../AgentRegistry';
import { parseCapabilities } from './capabilities-schema';
import { ReputationBridge } from './ReputationBridge';
import { type SubgraphAgent, SubgraphClient } from './SubgraphClient';
// Agent0Client available if needed for future enhancements
import type { DiscoveryFilters, IAgentDiscoveryService, IReputationBridge } from './types';

export class AgentDiscoveryService implements IAgentDiscoveryService {
  private localRegistry: AgentRegistry;
  private subgraphClient: SubgraphClient;
  private reputationBridge: IReputationBridge | null;

  constructor(
    localRegistry: AgentRegistry,
    subgraphClient: SubgraphClient,
    reputationBridge?: IReputationBridge | null
  ) {
    this.localRegistry = localRegistry;
    this.subgraphClient = subgraphClient;
    this.reputationBridge = reputationBridge || null;
  }

  /**
   * Discover agents from both local registry and Agent0 network
   */
  async discoverAgents(filters: DiscoveryFilters): Promise<AgentProfile[]> {
    const results: AgentProfile[] = [];

    const localAgents = this.localRegistry.search({
      strategies: filters.strategies,
      minReputation: filters.minReputation,
    });

    results.push(...localAgents.map((r: { profile: AgentProfile }) => r.profile));

    if (filters.includeExternal && process.env.AGENT0_ENABLED === 'true') {
      const externalAgents = await this.subgraphClient.searchAgents({
        strategies: filters.strategies,
        markets: filters.markets,
        minTrustScore: filters.minReputation,
      });

      for (const agent0Data of externalAgents) {
        const profile = await this.transformAgent0Profile(agent0Data, this.reputationBridge);
        results.push(profile);
      }
    }

    return this.deduplicateAndSort(results);
  }

  /**
   * Transform Agent0 subgraph data to Babylon AgentProfile format
   */
  private async transformAgent0Profile(
    agent0Data: SubgraphAgent,
    reputationBridge?: IReputationBridge | null
  ): Promise<AgentProfile> {
    let parsed: unknown = {};
    const capabilitiesJson = agent0Data.capabilities ?? '{}';
    try {
      parsed = JSON.parse(capabilitiesJson);
    } catch (error) {
      logger.warn('Failed to parse agent0 capabilities JSON', {
        error,
        capabilitiesJson,
      });
    }
    const capabilities = parseCapabilities(parsed);

    let reputation: AgentProfile['reputation'];
    if (reputationBridge) {
      const aggregated = await reputationBridge.getAggregatedReputation(agent0Data.tokenId);
      reputation = {
        totalBets: aggregated.totalBets,
        winningBets: aggregated.winningBets,
        accuracyScore: aggregated.accuracyScore,
        trustScore: aggregated.trustScore,
        totalVolume: aggregated.totalVolume,
        profitLoss: aggregated.profitLoss,
        isBanned: aggregated.isBanned,
      };
    } else {
      const fallbackReputation = agent0Data.reputation;
      const accuracyRaw = fallbackReputation?.accuracyScore ?? 0;
      const trustRaw = fallbackReputation?.trustScore ?? 0;
      reputation = {
        totalBets: fallbackReputation?.totalBets ?? 0,
        winningBets: fallbackReputation?.winningBets ?? 0,
        accuracyScore: accuracyRaw / 100,
        trustScore: trustRaw / 100,
        totalVolume: '0',
        profitLoss: 0,
        isBanned: false,
      };
    }

    return {
      agentId: `agent0-${agent0Data.tokenId}`,
      tokenId: agent0Data.tokenId,
      address: agent0Data.walletAddress,
      name: agent0Data.name,
      endpoint: agent0Data.a2aEndpoint ?? '',
      capabilities,
      reputation,
      isActive: true,
    };
  }

  /**
   * Deduplicate agents by address and sort by reputation
   */
  private deduplicateAndSort(agents: AgentProfile[]): AgentProfile[] {
    // Deduplicate by address, prefer local agents (those without 'agent0-' prefix)
    const seen = new Map<string, AgentProfile>();

    for (const agent of agents) {
      const address = agent.address.toLowerCase();
      const existing = seen.get(address);

      if (!existing || (agent.agentId && !agent.agentId.startsWith('agent0-'))) {
        seen.set(address, agent);
      }
    }

    // Sort by trust score (descending)
    return Array.from(seen.values()).sort(
      (a, b) => b.reputation.trustScore - a.reputation.trustScore
    );
  }

  /**
   * Get agent by ID (searches both local and external)
   */
  async getAgent(agentId: string): Promise<AgentProfile | null> {
    if (agentId.startsWith('agent0-')) {
      const tokenId = parseInt(agentId.replace('agent0-', ''), 10);
      const agent0Data = await this.subgraphClient.getAgent(tokenId);
      return this.transformAgent0Profile(agent0Data, this.reputationBridge);
    }

    const localAgent = this.localRegistry.getAgent(agentId);
    return localAgent?.profile ?? null;
  }
}

/**
 * Get or create singleton AgentDiscoveryService instance
 */
let agentDiscoveryInstance: AgentDiscoveryService | null = null;

export function getAgentDiscoveryService(): AgentDiscoveryService {
  if (!agentDiscoveryInstance) {
    const localRegistry = new AgentRegistry();
    const subgraphClient = new SubgraphClient();

    let reputationBridge: ReputationBridge | null = null;
    if (process.env.AGENT0_ENABLED === 'true') {
      reputationBridge = new ReputationBridge(undefined);
    }

    agentDiscoveryInstance = new AgentDiscoveryService(
      localRegistry,
      subgraphClient,
      reputationBridge
    );
  }

  return agentDiscoveryInstance;
}
