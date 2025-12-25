// @ts-nocheck - Database query type inference issues, needs refactoring
/**
 * ERC-8004 Registry Client
 * Blockchain integration for agent identity and reputation
 */

import {
  AgentCapabilitiesSchema,
  IDENTITY_REGISTRY_ABI,
  type JsonValue,
  logger,
  REPUTATION_SYSTEM_ABI,
} from '@babylon/shared'
import {
  type Abi,
  type Address,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type PublicClient,
} from 'viem'
import type { AgentProfile, AgentReputation } from '../types/a2a'

// Use ABIs from @babylon/shared
const IDENTITY_ABI = IDENTITY_REGISTRY_ABI
const REPUTATION_ABI = REPUTATION_SYSTEM_ABI

/**
 * Validates and normalizes an Ethereum address string to viem Address type.
 * Throws if the address is invalid.
 */
function toAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`)
  }
  return getAddress(address)
}

export interface RegistryConfig {
  rpcUrl: string
  identityRegistryAddress: string
  reputationSystemAddress: string
}

export class RegistryClient {
  private readonly client: PublicClient
  private readonly identityRegistryAddress: Address
  private readonly reputationSystemAddress: Address

  constructor(config: RegistryConfig) {
    // Initialize viem public client
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    })
    // Validate addresses at construction time
    this.identityRegistryAddress = toAddress(config.identityRegistryAddress)
    this.reputationSystemAddress = toAddress(config.reputationSystemAddress)
  }

  /**
   * Helper to read from identity registry.
   * Uses viem's readContract with proper ABI typing.
   * The generic T represents the expected return type from the contract call.
   */
  private async readIdentity<T>(
    functionName: string,
    args: readonly bigint[] | readonly string[] | readonly [],
  ): Promise<T> {
    // viem's readContract returns unknown for dynamic ABI/function combinations.
    // We use a generic to type the expected result based on the caller's knowledge.
    // Type assertions needed because viem expects literal function names from ABI,
    // but we're calling dynamically based on runtime string values.
    const result = await this.client.readContract({
      address: this.identityRegistryAddress,
      abi: IDENTITY_ABI satisfies Abi,
      functionName: functionName as 'getAgentProfile',
      args: args as readonly [bigint],
    })
    // The result type is unknown from viem due to dynamic function selection.
    // The caller provides the expected type T based on contract knowledge.
    return result as T
  }

  /**
   * Helper to read from reputation system.
   * Uses viem's readContract with proper ABI typing.
   * The generic T represents the expected return type from the contract call.
   */
  private async readReputation<T>(
    functionName: string,
    args: readonly bigint[] | readonly [],
  ): Promise<T> {
    // viem's readContract returns unknown for dynamic ABI/function combinations.
    // We use a generic to type the expected result based on the caller's knowledge.
    // Type assertions needed because viem expects literal function names from ABI,
    // but we're calling dynamically based on runtime string values.
    const result = await this.client.readContract({
      address: this.reputationSystemAddress,
      abi: REPUTATION_ABI satisfies Abi,
      functionName: functionName as 'getReputation',
      args: args as readonly [bigint],
    })
    // The result type is unknown from viem due to dynamic function selection.
    // The caller provides the expected type T based on contract knowledge.
    return result as T
  }

  /**
   * Get agent profile by token ID
   */
  async getAgentProfile(tokenId: number): Promise<AgentProfile | null> {
    type ProfileResult = readonly [
      string,
      string,
      string,
      string,
      boolean,
      string,
    ]
    const profile = await this.readIdentity<ProfileResult>('getAgentProfile', [
      BigInt(tokenId),
    ])
    const reputation = await this.getAgentReputation(tokenId)
    const address = await this.readIdentity<Address>('ownerOf', [
      BigInt(tokenId),
    ])

    return {
      tokenId,
      address,
      name: profile[0], // name
      endpoint: profile[1], // endpoint
      capabilities: this.parseCapabilities(profile[5]), // metadata
      reputation,
      isActive: profile[4], // isActive
    }
  }

  /**
   * Get agent profile by address
   */
  async getAgentProfileByAddress(
    address: string,
  ): Promise<AgentProfile | null> {
    const validatedAddress = toAddress(address)
    const tokenId = await this.readIdentity<bigint>('getTokenId', [
      validatedAddress,
    ])
    if (tokenId === 0n) return null
    return this.getAgentProfile(Number(tokenId))
  }

  /**
   * Get agent reputation
   */
  async getAgentReputation(tokenId: number): Promise<AgentReputation> {
    type RepResult = readonly [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
    ]
    const rep = await this.readReputation<RepResult>('getReputation', [
      BigInt(tokenId),
    ])

    return {
      totalBets: Number(rep[0] || 0),
      winningBets: Number(rep[1] || 0),
      totalVolume: rep[2]?.toString() || '0',
      profitLoss: Number(rep[3] || 0),
      accuracyScore: Number(rep[4] || 0),
      trustScore: Number(rep[5] || 0),
      isBanned: rep[6] || false,
    }
  }

  /**
   * Discover agents by filters
   */
  async discoverAgents(filters?: {
    strategies?: string[]
    minReputation?: number
    markets?: string[]
  }): Promise<AgentProfile[]> {
    let tokenIds: readonly bigint[]

    if (filters?.minReputation) {
      tokenIds = await this.readReputation<readonly bigint[]>(
        'getAgentsByMinScore',
        [BigInt(filters.minReputation)],
      )
    } else {
      tokenIds = await this.readIdentity<readonly bigint[]>(
        'getAllActiveAgents',
        [],
      )
    }

    const profiles: AgentProfile[] = []
    for (const tokenId of tokenIds) {
      const profile = await this.getAgentProfile(Number(tokenId))
      if (profile && this.matchesFilters(profile, filters)) {
        profiles.push(profile)
      }
    }

    return profiles
  }

  /**
   * Check if agent matches discovery filters
   */
  private matchesFilters(
    profile: AgentProfile,
    filters?: {
      strategies?: string[]
      minReputation?: number
      markets?: string[]
    },
  ): boolean {
    if (!filters) return true

    // Check strategies
    if (filters.strategies && filters.strategies.length > 0) {
      const hasStrategy = filters.strategies.some((s) =>
        profile.capabilities.strategies.includes(s),
      )
      if (!hasStrategy) return false
    }

    // Check markets
    if (filters.markets && filters.markets.length > 0) {
      const hasMarket = filters.markets.some((m) =>
        profile.capabilities.markets.includes(m),
      )
      if (!hasMarket) return false
    }

    // Check reputation (already filtered in query if provided)
    if (filters.minReputation) {
      if (profile.reputation.trustScore < filters.minReputation) {
        return false
      }
    }

    return true
  }

  /**
   * Parse capabilities from metadata JSON.
   * Uses zod schema validation to safely parse the capabilities.
   */
  private parseCapabilities(metadata: string): {
    strategies: string[]
    markets: string[]
    actions: string[]
    version: string
    skills: string[]
    domains: string[]
  } {
    // JSON.parse returns any by default - immediately validate with zod
    // which handles any input type safely and returns typed data
    const validation = AgentCapabilitiesSchema.safeParse(JSON.parse(metadata))
    if (validation.success) {
      return {
        strategies: validation.data.strategies ?? [],
        markets: validation.data.markets ?? [],
        actions: validation.data.actions ?? [],
        version: validation.data.version ?? '1.0.0',
        skills: validation.data.skills ?? [],
        domains: validation.data.domains ?? [],
      }
    }
    // Return defaults if validation fails
    return {
      strategies: [],
      markets: [],
      actions: [],
      version: '1.0.0',
      skills: [],
      domains: [],
    }
  }

  /**
   * Verify agent address owns the token ID
   */
  async verifyAgent(address: string, tokenId: number): Promise<boolean> {
    const owner = await this.readIdentity<Address>('ownerOf', [BigInt(tokenId)])
    return owner.toLowerCase() === address.toLowerCase()
  }

  /**
   * Check if endpoint is active
   */
  async isEndpointActive(endpoint: string): Promise<boolean> {
    return await this.readIdentity<boolean>('isEndpointActive', [endpoint])
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
    data: Record<string, JsonValue>,
  ): Promise<void> {
    logger.info(`Register agent ${agentId} (read-only client)`, { data })
    throw new Error(
      'RegistryClient is read-only. Use Agent0Client.registerAgent() or /api/agents/onboard for registration',
    )
  }

  /**
   * Unregister agent (required by RegistryClient interface)
   *
   * NOTE: This client is READ-ONLY. Unregistration requires direct blockchain interaction
   * with a wallet that owns the agent token. This is not currently implemented as a
   * server-side operation.
   */
  async unregister(agentId: string): Promise<void> {
    logger.info(`Unregister agent ${agentId} (read-only client)`)
    throw new Error(
      'RegistryClient is read-only. Unregistration requires direct blockchain interaction with agent owner wallet',
    )
  }

  /**
   * Get all agents (required by RegistryClient interface)
   */
  async getAgents(): Promise<
    Array<{ agentId: string; [key: string]: JsonValue }>
  > {
    const profiles = await this.discoverAgents()
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
    }))
  }

  /**
   * Get agent by ID (required by RegistryClient interface)
   */
  async getAgent(
    agentId: string,
  ): Promise<{ agentId: string; [key: string]: JsonValue } | null> {
    const tokenId = Number.parseInt(agentId, 10)
    if (Number.isNaN(tokenId)) {
      return null
    }
    const profile = await this.getAgentProfile(tokenId)
    if (!profile) {
      return null
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
    }
  }
}
