/**
 * ERC-8004 Registry Client
 * Blockchain integration for agent identity and reputation
 */

import {
  AgentCapabilitiesSchema,
  type JsonValue,
  logger,
} from '@babylon/shared';
import {
  createPublicClient,
  type GetContractReturnType,
  getContract,
  http,
  type PublicClient,
} from 'viem';
import type { AgentProfile, AgentReputation } from '../types/a2a';

// ERC-8004 Identity Registry ABI (minimal)
const IDENTITY_ABI = [
  {
    type: 'function',
    name: 'getTokenId',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentProfile',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'capabilitiesHash', type: 'bytes32' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'metadata', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllActiveAgents',
    inputs: [],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isEndpointActive',
    inputs: [{ name: 'endpoint', type: 'string' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentsByCapability',
    inputs: [{ name: 'capabilityHash', type: 'bytes32' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const;

// Reputation System ABI (minimal)
const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'getReputation',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [
      { name: 'totalBets', type: 'uint256' },
      { name: 'winningBets', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
      { name: 'profitLoss', type: 'uint256' },
      { name: 'accuracyScore', type: 'uint256' },
      { name: 'trustScore', type: 'uint256' },
      { name: 'isBanned', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeedbackCount',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeedback',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_index', type: 'uint256' },
    ],
    outputs: [
      { name: 'from', type: 'address' },
      { name: 'rating', type: 'int8' },
      { name: 'comment', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentsByMinScore',
    inputs: [{ name: 'minScore', type: 'uint256' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
] as const;

export interface RegistryConfig {
  rpcUrl: string;
  identityRegistryAddress: string;
  reputationSystemAddress: string;
}

type IdentityContract = GetContractReturnType<
  typeof IDENTITY_ABI,
  PublicClient
>;
type ReputationContract = GetContractReturnType<
  typeof REPUTATION_ABI,
  PublicClient
>;

export class RegistryClient {
  private readonly client: PublicClient;
  private readonly identityRegistry: IdentityContract;
  private readonly reputationSystem: ReputationContract;

  constructor(config: RegistryConfig) {
    // Initialize viem public client
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });

    // Create typed contract instances
    this.identityRegistry = getContract({
      address: config.identityRegistryAddress as `0x${string}`,
      abi: IDENTITY_ABI,
      client: this.client,
    });

    this.reputationSystem = getContract({
      address: config.reputationSystemAddress as `0x${string}`,
      abi: REPUTATION_ABI,
      client: this.client,
    });
  }

  /**
   * Get agent profile by token ID
   */
  async getAgentProfile(tokenId: number): Promise<AgentProfile | null> {
    const profile = await this.identityRegistry.read.getAgentProfile([
      BigInt(tokenId),
    ]);
    const reputation = await this.getAgentReputation(tokenId);
    const address = await this.identityRegistry.read.ownerOf([BigInt(tokenId)]);

    return {
      tokenId,
      address,
      name: profile[0], // name
      endpoint: profile[1], // endpoint
      capabilities: this.parseCapabilities(profile[5]), // metadata
      reputation,
      isActive: profile[4], // isActive
    };
  }

  /**
   * Get agent profile by address
   */
  async getAgentProfileByAddress(
    address: string
  ): Promise<AgentProfile | null> {
    const tokenId = await this.identityRegistry.read.getTokenId([
      address as `0x${string}`,
    ]);
    if (tokenId === 0n) return null;
    return this.getAgentProfile(Number(tokenId));
  }

  /**
   * Get agent reputation
   */
  async getAgentReputation(tokenId: number): Promise<AgentReputation> {
    const rep = await this.reputationSystem.read.getReputation([
      BigInt(tokenId),
    ]);

    return {
      totalBets: Number(rep[0] || 0),
      winningBets: Number(rep[1] || 0),
      totalVolume: rep[2]?.toString() || '0',
      profitLoss: Number(rep[3] || 0),
      accuracyScore: Number(rep[4] || 0),
      trustScore: Number(rep[5] || 0),
      isBanned: rep[6] || false,
    };
  }

  /**
   * Discover agents by filters
   */
  async discoverAgents(filters?: {
    strategies?: string[];
    minReputation?: number;
    markets?: string[];
  }): Promise<AgentProfile[]> {
    let tokenIds: readonly bigint[];

    if (filters?.minReputation) {
      tokenIds = await this.reputationSystem.read.getAgentsByMinScore([
        BigInt(filters.minReputation),
      ]);
    } else {
      tokenIds = await this.identityRegistry.read.getAllActiveAgents();
    }

    const profiles: AgentProfile[] = [];
    for (const tokenId of tokenIds) {
      const profile = await this.getAgentProfile(Number(tokenId));
      if (profile && this.matchesFilters(profile, filters)) {
        profiles.push(profile);
      }
    }

    return profiles;
  }

  /**
   * Check if agent matches discovery filters
   */
  private matchesFilters(
    profile: AgentProfile,
    filters?: {
      strategies?: string[];
      minReputation?: number;
      markets?: string[];
    }
  ): boolean {
    if (!filters) return true;

    // Check strategies
    if (filters.strategies && filters.strategies.length > 0) {
      const hasStrategy = filters.strategies.some((s) =>
        profile.capabilities.strategies.includes(s)
      );
      if (!hasStrategy) return false;
    }

    // Check markets
    if (filters.markets && filters.markets.length > 0) {
      const hasMarket = filters.markets.some((m) =>
        profile.capabilities.markets.includes(m)
      );
      if (!hasMarket) return false;
    }

    // Check reputation (already filtered in query if provided)
    if (filters.minReputation) {
      if (profile.reputation.trustScore < filters.minReputation) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse capabilities from metadata JSON
   */
  private parseCapabilities(metadata: string): {
    strategies: string[];
    markets: string[];
    actions: string[];
    version: string;
    skills: string[];
    domains: string[];
  } {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const validation = AgentCapabilitiesSchema.safeParse(parsed);
    return {
      strategies: validation.data?.strategies ?? [],
      markets: validation.data?.markets ?? [],
      actions: validation.data?.actions ?? [],
      version: validation.data?.version ?? '1.0.0',
      skills: validation.data?.skills ?? [],
      domains: validation.data?.domains ?? [],
    };
  }

  /**
   * Verify agent address owns the token ID
   */
  async verifyAgent(address: string, tokenId: number): Promise<boolean> {
    const owner = await this.identityRegistry.read.ownerOf([BigInt(tokenId)]);
    return owner.toLowerCase() === address.toLowerCase();
  }

  /**
   * Check if endpoint is active
   */
  async isEndpointActive(endpoint: string): Promise<boolean> {
    return await this.identityRegistry.read.isEndpointActive([endpoint]);
  }

  /**
   * Register agent (required by RegistryClient interface)
   *
   * NOTE: This client is READ-ONLY. For actual registration, use:
   * - Agent0Client.registerAgent() - Full Agent0 registration with IPFS publishing
   * - /api/agents/onboard - On-chain registration endpoint with server wallet
   * - AgentWalletService.registerAgentOnChain() - Complete registration flow
   *
   * This method exists for interface compatibility only.
   * Registration requires wallet signing and gas, which are handled by the above methods.
   */
  async register(
    agentId: string,
    data: Record<string, JsonValue>
  ): Promise<void> {
    logger.info(`Register agent ${agentId} (read-only client)`, { data });
    throw new Error(
      'RegistryClient is read-only. Use Agent0Client.registerAgent() or /api/agents/onboard for registration'
    );
  }

  /**
   * Unregister agent (required by RegistryClient interface)
   *
   * NOTE: This client is READ-ONLY. Unregistration requires direct blockchain interaction
   * with a wallet that owns the agent token. This is not currently implemented as a
   * server-side operation.
   */
  async unregister(agentId: string): Promise<void> {
    logger.info(`Unregister agent ${agentId} (read-only client)`);
    throw new Error(
      'RegistryClient is read-only. Unregistration requires direct blockchain interaction with agent owner wallet'
    );
  }

  /**
   * Get all agents (required by RegistryClient interface)
   */
  async getAgents(): Promise<
    Array<{ agentId: string; [key: string]: JsonValue }>
  > {
    const profiles = await this.discoverAgents();
    return profiles.map((profile) => ({
      agentId: String(profile.tokenId),
      tokenId: profile.tokenId,
      address: profile.address,
      name: profile.name,
      endpoint: profile.endpoint,
      capabilities: {
        strategies: profile.capabilities.strategies,
        markets: profile.capabilities.markets,
        actions: profile.capabilities.actions,
        version: profile.capabilities.version,
        skills: profile.capabilities.skills || [],
        domains: profile.capabilities.domains || [],
      },
      reputation: {
        totalBets: profile.reputation.totalBets,
        winningBets: profile.reputation.winningBets,
        accuracyScore: profile.reputation.accuracyScore,
        trustScore: profile.reputation.trustScore,
        totalVolume: profile.reputation.totalVolume,
        profitLoss: profile.reputation.profitLoss,
        isBanned: profile.reputation.isBanned,
      },
      isActive: profile.isActive,
    }));
  }

  /**
   * Get agent by ID (required by RegistryClient interface)
   */
  async getAgent(
    agentId: string
  ): Promise<{ agentId: string; [key: string]: JsonValue } | null> {
    const tokenId = Number.parseInt(agentId, 10);
    if (isNaN(tokenId)) {
      return null;
    }
    const profile = await this.getAgentProfile(tokenId);
    if (!profile) {
      return null;
    }
    return {
      agentId: String(profile.tokenId),
      tokenId: profile.tokenId,
      address: profile.address,
      name: profile.name,
      endpoint: profile.endpoint,
      capabilities: {
        strategies: profile.capabilities.strategies,
        markets: profile.capabilities.markets,
        actions: profile.capabilities.actions,
        version: profile.capabilities.version,
        skills: profile.capabilities.skills || [],
        domains: profile.capabilities.domains || [],
      },
      reputation: {
        totalBets: profile.reputation.totalBets,
        winningBets: profile.reputation.winningBets,
        accuracyScore: profile.reputation.accuracyScore,
        trustScore: profile.reputation.trustScore,
        totalVolume: profile.reputation.totalVolume,
        profitLoss: profile.reputation.profitLoss,
        isBanned: profile.reputation.isBanned,
      },
      isActive: profile.isActive,
    };
  }
}
