// @ts-nocheck - Database query type inference issues, needs refactoring
/**
 * Agent Registry Service
 *
 * Single source of truth for all agent types: USER_CONTROLLED, NPC, EXTERNAL.
 * Provides registration, discovery, and management for all agent types
 * with support for ERC-8004, Agent0 SDK, and A2A Protocol.
 *
 * @packageDocumentation
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { verifyApiKey } from '@babylon/api'
import type {
  AgentCapability,
  AgentRegistry,
  ExternalAgentConnection,
  JsonValue,
  SQLCondition,
  User,
} from '@babylon/db'
import {
  agentCapabilities,
  agentRegistries,
  db,
  eq,
  externalAgentConnections,
  gte,
  ilike,
  inArray,
  or,
  users,
} from '@babylon/db'
import { type StaticActor, StaticDataRegistry } from '@babylon/engine'
import { type AgentCapabilities, logger } from '@babylon/shared'
import {
  type AgentDiscoveryFilter,
  type AgentRegistration,
  AgentStatus,
  AgentType,
  type ExternalAgentConnectionParams,
  TrustLevel,
} from '@jejunetwork/agents'
import { hasStringProperty, isObject, toNull } from '@jejunetwork/shared'

/**
 * Gets encryption key from environment or dev fallback
 * @internal
 */
const getEncryptionKey = () => {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRON_SECRET must be set in production')
  }
  return 'dev-key-change-in-production-32-chars!!'
}

/** Encryption algorithm for API key storage */
const ALGORITHM = 'aes-256-cbc'

/**
 * Registry entry with loaded relations
 * Uses Omit to override the capabilities field from AgentRegistry (which is string[])
 * with the full AgentCapability object from the join
 * @internal
 */
type RegistryWithRelations = Omit<AgentRegistry, 'capabilities'> & {
  capabilities: AgentCapability | null
  User?: User | null
  Actor?: StaticActor | null
  externalConnection?: ExternalAgentConnection | null
}

/**
 * Agent Registry Service
 *
 * Service for managing agent registry with support for all agent types.
 */
export class AgentRegistryService {
  /**
   * Registers a USER_CONTROLLED agent from User record
   *
   * Creates registry entry linked to existing User. Verifies user exists
   * and is not already registered.
   *
   * @param params - Registration parameters
   * @param params.userId - User ID
   * @param params.name - Agent name
   * @param params.systemPrompt - System prompt
   * @param params.capabilities - Agent capabilities
   * @param params.trustLevel - Trust level (default: 0)
   * @returns Registered agent
   * @throws Error if user not found or already registered
   */
  async registerUserAgent(params: {
    userId: string
    name: string
    systemPrompt: string
    capabilities: AgentCapabilities
    trustLevel?: TrustLevel
  }): Promise<AgentRegistration> {
    const { userId, name, systemPrompt, capabilities, trustLevel = 0 } = params

    // Verify user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    // Check if already registered
    const [existing] = await db
      .select()
      .from(agentRegistries)
      .where(eq(agentRegistries.userId, userId))
      .limit(1)

    if (existing) {
      throw new Error(
        `User ${userId} already registered as agent ${existing.agentId}`,
      )
    }

    const registryId = `agent-user-${userId}`
    const capabilityId = `cap-${userId}`

    // Create registry entry
    await db.insert(agentRegistries).values({
      id: registryId,
      agentId: userId,
      type: AgentType.USER_CONTROLLED,
      status: AgentStatus.REGISTERED,
      trustLevel,
      userId,
      name,
      systemPrompt,
      // Discovery metadata
      discoveryAuthRequired: false,
      discoveryAuthMethods: [],
      updatedAt: new Date(),
    })

    // Create capabilities
    await db.insert(agentCapabilities).values({
      id: capabilityId,
      agentRegistryId: registryId,
      strategies: capabilities.strategies ?? [],
      markets: capabilities.markets ?? [],
      actions: capabilities.actions ?? [],
      version: capabilities.version ?? '1.0.0',
      x402Support: capabilities.x402Support ?? false,
      platform: capabilities.platform,
      userType: capabilities.userType,
      gameNetworkChainId: capabilities.gameNetwork?.chainId,
      gameNetworkRpcUrl: capabilities.gameNetwork?.registryAddress,
      gameNetworkExplorerUrl: capabilities.gameNetwork?.reputationAddress,
      // OASF Taxonomy Support (Agent0 SDK v0.31.0)
      skills: capabilities.skills ?? [],
      domains: capabilities.domains ?? [],
      // A2A Communication Endpoints (Agent0 SDK v0.31.0)
      a2aEndpoint: capabilities.a2aEndpoint,
      mcpEndpoint: capabilities.mcpEndpoint,
      updatedAt: new Date(),
    })

    // Fetch complete registry with relations
    const registry = await this.getRegistryWithRelations(userId)
    if (!registry) {
      throw new Error('Failed to create agent registry')
    }

    return this.mapToRegistration(registry)
  }

  /**
   * Register an NPC agent from Actor record
   *
   * @description Creates registry entry linked to existing Actor. Verifies actor exists
   * and is not already registered. Creates registry entry with NPC type and SYSTEM trust level.
   *
   * @param {object} params - Registration parameters
   * @param {string} params.actorId - Actor ID
   * @param {string} params.systemPrompt - System prompt
   * @param {AgentCapabilities} params.capabilities - Agent capabilities
   * @returns {Promise<AgentRegistration>} Registered agent
   * @throws {Error} If actor not found or already registered
   */
  async registerNpcAgent(params: {
    actorId: string
    systemPrompt: string
    capabilities: AgentCapabilities
  }): Promise<AgentRegistration> {
    const { actorId, systemPrompt, capabilities } = params

    // Verify actor exists in static registry
    const actor = StaticDataRegistry.getActor(actorId)

    if (!actor) {
      throw new Error(`Actor not found: ${actorId}`)
    }

    // Check if already registered
    const [existing] = await db
      .select()
      .from(agentRegistries)
      .where(eq(agentRegistries.actorId, actorId))
      .limit(1)

    if (existing) {
      throw new Error(
        `Actor ${actorId} already registered as agent ${existing.agentId}`,
      )
    }

    const registryId = `agent-npc-${actorId}`
    const capabilityId = `cap-${actorId}`

    // Create registry entry with SYSTEM trust level for NPCs
    await db.insert(agentRegistries).values({
      id: registryId,
      agentId: actorId,
      type: AgentType.NPC,
      status: AgentStatus.REGISTERED,
      trustLevel: 4, // SYSTEM trust level for NPCs
      actorId,
      name: actor.name,
      systemPrompt,
      discoveryAuthRequired: false,
      discoveryAuthMethods: [],
      updatedAt: new Date(),
    })

    // Create capabilities
    await db.insert(agentCapabilities).values({
      id: capabilityId,
      agentRegistryId: registryId,
      strategies: capabilities.strategies ?? [],
      markets: capabilities.markets ?? [],
      actions: capabilities.actions ?? [],
      version: capabilities.version ?? '1.0.0',
      x402Support: capabilities.x402Support ?? false,
      platform: capabilities.platform,
      userType: capabilities.userType,
      gameNetworkChainId: capabilities.gameNetwork?.chainId,
      gameNetworkRpcUrl: capabilities.gameNetwork?.registryAddress,
      gameNetworkExplorerUrl: capabilities.gameNetwork?.reputationAddress,
      skills: capabilities.skills ?? [],
      domains: capabilities.domains ?? [],
      a2aEndpoint: capabilities.a2aEndpoint,
      mcpEndpoint: capabilities.mcpEndpoint,
      updatedAt: new Date(),
    })

    // Fetch complete registry with relations
    const registry = await this.getRegistryWithRelations(actorId)
    if (!registry) {
      throw new Error('Failed to create agent registry')
    }

    return this.mapToRegistration(registry)
  }

  /**
   * Register an EXTERNAL agent (ElizaOS, MCP, Agent0, custom)
   *
   * @description Creates registry entry with connection parameters for external agents.
   * Verifies external agent is not already registered. Creates registry entry with EXTERNAL
   * type and UNTRUSTED trust level by default.
   *
   * @param {ExternalAgentConnectionParams} params - External agent connection parameters
   * @returns {Promise<AgentRegistration>} Registered agent
   * @throws {Error} If external agent already registered
   */
  async registerExternalAgent(
    params: ExternalAgentConnectionParams,
  ): Promise<AgentRegistration> {
    const {
      externalId,
      name,
      description,
      endpoint,
      protocol,
      capabilities,
      authentication,
      agentCard,
    } = params

    // Check if already registered
    const [existing] = await db
      .select()
      .from(externalAgentConnections)
      .where(eq(externalAgentConnections.externalId, externalId))
      .limit(1)

    if (existing) {
      throw new Error(`External agent already registered: ${externalId}`)
    }

    const registryId = `agent-ext-${externalId}`
    const capabilityId = `cap-${externalId}`
    const connectionId = `ext-conn-${externalId}`

    // Create registry entry with UNTRUSTED trust level by default
    await db.insert(agentRegistries).values({
      id: registryId,
      agentId: externalId,
      type: AgentType.EXTERNAL,
      status: AgentStatus.REGISTERED,
      trustLevel: 0, // UNTRUSTED by default, must be verified
      name,
      systemPrompt: description,
      // Discovery metadata from Agent Card
      discoveryCardVersion: agentCard?.version,
      discoveryEndpointA2a: agentCard?.endpoints?.a2a,
      discoveryEndpointMcp: agentCard?.endpoints?.mcp,
      discoveryEndpointRpc: agentCard?.endpoints?.rpc,
      discoveryAuthRequired: agentCard?.authentication?.required ?? false,
      discoveryAuthMethods: agentCard?.authentication?.methods ?? [],
      discoveryRateLimit: agentCard?.limits?.rateLimit,
      discoveryCostPerAction: agentCard?.limits?.costPerAction,
      updatedAt: new Date(),
    })

    // Create capabilities
    await db.insert(agentCapabilities).values({
      id: capabilityId,
      agentRegistryId: registryId,
      strategies: capabilities.strategies ?? [],
      markets: capabilities.markets ?? [],
      actions: capabilities.actions ?? [],
      version: capabilities.version ?? '1.0.0',
      x402Support: capabilities.x402Support ?? false,
      platform: capabilities.platform,
      userType: capabilities.userType,
      gameNetworkChainId: capabilities.gameNetwork?.chainId,
      gameNetworkRpcUrl: capabilities.gameNetwork?.registryAddress,
      gameNetworkExplorerUrl: capabilities.gameNetwork?.reputationAddress,
      skills: capabilities.skills ?? [],
      domains: capabilities.domains ?? [],
      a2aEndpoint: capabilities.a2aEndpoint,
      mcpEndpoint: capabilities.mcpEndpoint,
      updatedAt: new Date(),
    })

    // Create external connection
    await db.insert(externalAgentConnections).values({
      id: connectionId,
      agentRegistryId: registryId,
      externalId,
      endpoint,
      protocol,
      authType: authentication?.type,
      authCredentials: authentication?.credentials
        ? this.encryptCredentials(authentication.credentials)
        : null,
      // AgentCard is structurally compatible with JsonValue - all fields are JsonValue types
      // (strings, numbers, booleans, objects, arrays - all JsonValue-compatible)
      agentCardJson: agentCard
        ? (JSON.parse(JSON.stringify(agentCard)) as JsonValue)
        : null,
      updatedAt: new Date(),
    })

    // Fetch complete registry with relations
    const registry = await this.getRegistryWithRelations(externalId)
    if (!registry) {
      throw new Error('Failed to create agent registry')
    }

    return this.mapToRegistration(registry)
  }

  /**
   * Discover agents using flexible filters
   *
   * @description Supports querying by type, status, trust level, capabilities,
   * OASF skills/domains. Returns paginated results ordered by trust level and registration date.
   *
   * @param {AgentDiscoveryFilter} [filter={}] - Discovery filter options
   * @returns {Promise<AgentRegistration[]>} Array of matching agents
   */
  async discoverAgents(
    filter: AgentDiscoveryFilter = {},
  ): Promise<AgentRegistration[]> {
    const {
      types,
      statuses,
      minTrustLevel,
      requiredCapabilities,
      requiredSkills,
      requiredDomains,
      matchMode = 'all',
      search,
      limit = 50,
      offset = 0,
    } = filter

    // Build where conditions
    const conditions: SQLCondition[] = []

    if (types && types.length > 0) {
      conditions.push(inArray(agentRegistries.type, types))
    }

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(agentRegistries.status, statuses))
    }

    if (minTrustLevel !== undefined) {
      conditions.push(gte(agentRegistries.trustLevel, minTrustLevel))
    }

    if (search) {
      const searchCondition = or(
        ilike(agentRegistries.name, `%${search}%`),
        ilike(agentRegistries.systemPrompt, `%${search}%`),
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    // Use raw SQL for join queries - query builder doesn't track join types
    // Build WHERE clause dynamically
    const whereClauseParams: (string | number)[] = []
    const whereParts: string[] = []
    let paramIndex = 1

    if (types && types.length > 0) {
      const placeholders = types.map(() => `$${paramIndex++}`).join(', ')
      whereParts.push(`ar.type IN (${placeholders})`)
      whereClauseParams.push(...types)
    }

    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => `$${paramIndex++}`).join(', ')
      whereParts.push(`ar.status IN (${placeholders})`)
      whereClauseParams.push(...statuses)
    }

    if (minTrustLevel !== undefined) {
      whereParts.push(`ar.trustLevel >= $${paramIndex++}`)
      whereClauseParams.push(minTrustLevel)
    }

    if (search) {
      whereParts.push(
        `(ar.name LIKE $${paramIndex} OR ar.systemPrompt LIKE $${paramIndex})`,
      )
      whereClauseParams.push(`%${search}%`)
      paramIndex++
    }

    const whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    // Type for raw SQL join result (camelCase column names from SQLit)
    interface RawJoinedRow {
      // AgentRegistry fields (actual SQLit schema)
      id: string
      agentId: string
      userId: string | null
      actorId: string | null
      type: string
      name: string
      systemPrompt: string
      status: string
      trustLevel: number
      registeredAt: Date
      lastActiveAt: Date | null
      // Discovery fields
      discoveryEndpointA2a: string | null
      discoveryEndpointMcp: string | null
      // On-chain fields
      onChainReputationScore: number | null
      // Agent0 fields
      agent0TokenId: string | null
      agent0MetadataCID: string | null
      agent0DiscoveryEndpoint: string | null
      // AgentCapability fields (prefixed)
      cap_id: string | null
      cap_strategies: string[] | null
      cap_markets: string[] | null
      cap_actions: string[] | null
      cap_skills: string[] | null
      cap_domains: string[] | null
      cap_a2aEndpoint: string | null
      // User fields (prefixed)
      user_username: string | null
      user_displayName: string | null
      user_email: string | null
      // ExternalAgentConnection fields (prefixed)
      ext_id: string | null
      ext_endpoint: string | null
      ext_protocol: string | null
      ext_isHealthy: number | null
    }

    const sql = `
      SELECT
        ar.id, ar.agentId, ar.userId, ar.actorId, ar.type, ar.name,
        ar.systemPrompt, ar.status, ar.trustLevel,
        ar.registeredAt, ar.lastActiveAt,
        ar.discoveryEndpointA2a, ar.discoveryEndpointMcp,
        ar.onChainReputationScore,
        ar.agent0TokenId, ar.agent0MetadataCID, ar.agent0DiscoveryEndpoint,
        ac.id as cap_id, ac.strategies as cap_strategies, ac.markets as cap_markets,
        ac.actions as cap_actions, ac.skills as cap_skills, ac.domains as cap_domains,
        ac.a2aEndpoint as cap_a2aEndpoint,
        u.username as user_username, u.displayName as user_displayName, u.email as user_email,
        eac.id as ext_id, eac.endpoint as ext_endpoint,
        eac.protocol as ext_protocol, eac.isHealthy as ext_isHealthy
      FROM AgentRegistry ar
      LEFT JOIN AgentCapability ac ON ac.agentRegistryId = ar.id
      LEFT JOIN User u ON u.id = ar.userId
      LEFT JOIN ExternalAgentConnection eac ON eac.agentRegistryId = ar.id
      ${whereClause}
      ORDER BY ar.trustLevel DESC, ar.registeredAt DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `

    const rawRows = await db.query<RawJoinedRow>(sql, [
      ...whereClauseParams,
      limit,
      offset,
    ])

    // Transform raw rows to RegistryWithRelations
    const typedRows = rawRows.map((row) => ({
      AgentRegistry: {
        id: row.id,
        agentId: row.agentId,
        userId: row.userId,
        actorId: row.actorId,
        type: row.type,
        name: row.name,
        systemPrompt: row.systemPrompt,
        status: row.status,
        trustLevel: row.trustLevel,
        registeredAt: row.registeredAt,
        lastActiveAt: row.lastActiveAt,
        // Map discovery fields to legacy format
        a2aEndpoint: row.discoveryEndpointA2a ?? row.cap_a2aEndpoint,
        // Map agent0 fields
        agent0Address: row.agent0DiscoveryEndpoint,
        onChainReputationScore: row.onChainReputationScore,
        // Raw SQL to schema mapping requires unknown intermediate due to missing fields
      } as unknown as AgentRegistry,
      AgentCapability: row.cap_id
        ? ({
            id: row.cap_id,
            agentRegistryId: row.id,
            strategies: row.cap_strategies,
            markets: row.cap_markets,
            actions: row.cap_actions,
            skills: row.cap_skills,
            domains: row.cap_domains,
            a2aEndpoint: row.cap_a2aEndpoint,
          } as AgentCapability)
        : null,
      User:
        row.user_username !== null
          ? ({
              id: row.userId,
              username: row.user_username,
              displayName: row.user_displayName,
              email: row.user_email,
            } as User)
          : null,
      ExternalAgentConnection: row.ext_id
        ? ({
            id: row.ext_id,
            agentRegistryId: row.id,
            endpoint: row.ext_endpoint,
            protocol: row.ext_protocol,
            isHealthy: row.ext_isHealthy === 1,
          } as unknown as ExternalAgentConnection)
        : null,
    }))

    // Map to registry with relations format, getting Actor from static registry
    const registrations: RegistryWithRelations[] = typedRows
      .filter((row) => row.AgentRegistry !== null)
      .map((row) => {
        const agentReg = row.AgentRegistry
        const actorId = agentReg.actorId
        const staticActor = actorId
          ? StaticDataRegistry.getActor(actorId)
          : null
        // Spread the full AgentRegistry and add relations
        return {
          ...agentReg,
          capabilities: toNull(row.AgentCapability),
          User: toNull(row.User),
          Actor: staticActor,
          externalConnection: toNull(row.ExternalAgentConnection),
        } as RegistryWithRelations
      })

    // Filter by required capabilities if specified
    let filtered = registrations
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      filtered = filtered.filter((reg) => {
        if (!reg.capabilities) return false
        const allCaps = [
          ...(reg.capabilities.strategies || []),
          ...(reg.capabilities.markets || []),
          ...(reg.capabilities.actions || []),
        ]
        return requiredCapabilities.every((cap) => allCaps.includes(cap))
      })
    }

    // Filter by OASF skills if specified (Agent0 SDK v0.31.0)
    if (requiredSkills && requiredSkills.length > 0) {
      filtered = filtered.filter((reg) => {
        if (!reg.capabilities || !reg.capabilities.skills) return false
        const agentSkills = reg.capabilities.skills

        if (matchMode === 'all') {
          // All required skills must be present
          return requiredSkills.every((skill) => agentSkills.includes(skill))
        }
        // Any required skill matches
        return requiredSkills.some((skill) => agentSkills.includes(skill))
      })
    }

    // Filter by OASF domains if specified (Agent0 SDK v0.31.0)
    if (requiredDomains && requiredDomains.length > 0) {
      filtered = filtered.filter((reg) => {
        if (!reg.capabilities || !reg.capabilities.domains) return false
        const agentDomains = reg.capabilities.domains

        if (matchMode === 'all') {
          // All required domains must be present
          return requiredDomains.every((domain) =>
            agentDomains.includes(domain),
          )
        }
        // Any required domain matches
        return requiredDomains.some((domain) => agentDomains.includes(domain))
      })
    }

    return filtered.map((reg) => this.mapToRegistration(reg))
  }

  /**
   * Get agent by agentId
   *
   * @description Gets agent by agentId (userId for USER_CONTROLLED, actorId for NPC,
   * externalId for EXTERNAL). Returns null if not found.
   *
   * @param {string} agentId - Agent ID
   * @returns {Promise<AgentRegistration | null>} Agent registration or null
   */
  async getAgentById(agentId: string): Promise<AgentRegistration | null> {
    const registry = await this.getRegistryWithRelations(agentId)

    if (!registry) return null

    return this.mapToRegistration(registry)
  }

  /**
   * Update agent status
   *
   * @description Updates agent status in lifecycle: REGISTERED → INITIALIZED → ACTIVE → PAUSED → TERMINATED.
   * Updates lastActiveAt for ACTIVE status and terminatedAt for TERMINATED status.
   *
   * @param {string} agentId - Agent ID
   * @param {AgentStatus} status - New status
   * @returns {Promise<AgentRegistration>} Updated agent registration
   */
  async updateAgentStatus(
    agentId: string,
    status: AgentStatus,
  ): Promise<AgentRegistration> {
    await db
      .update(agentRegistries)
      .set({
        status,
        lastActiveAt: status === AgentStatus.ACTIVE ? new Date() : undefined,
        terminatedAt:
          status === AgentStatus.TERMINATED ? new Date() : undefined,
      })
      .where(eq(agentRegistries.agentId, agentId))

    const registry = await this.getRegistryWithRelations(agentId)
    if (!registry) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    return this.mapToRegistration(registry)
  }

  /**
   * Set runtime instance ID when AgentRuntime is created
   *
   * @description Sets runtime instance ID and updates status to INITIALIZED when
   * AgentRuntime is created.
   *
   * @param {string} agentId - Agent ID
   * @param {string} runtimeInstanceId - Runtime instance ID
   * @returns {Promise<void>}
   */
  async setRuntimeInstance(
    agentId: string,
    runtimeInstanceId: string,
  ): Promise<void> {
    await db
      .update(agentRegistries)
      .set({
        runtimeInstanceId,
        status: AgentStatus.INITIALIZED,
      })
      .where(eq(agentRegistries.agentId, agentId))
  }

  /**
   * Clear runtime instance ID when AgentRuntime is destroyed
   *
   * @description Clears runtime instance ID and updates status to REGISTERED when
   * AgentRuntime is destroyed.
   *
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async clearRuntimeInstance(agentId: string): Promise<void> {
    await db
      .update(agentRegistries)
      .set({
        runtimeInstanceId: null,
        status: AgentStatus.REGISTERED,
      })
      .where(eq(agentRegistries.agentId, agentId))
  }

  /**
   * Update trust level
   *
   * @description Updates agent trust level. Requires verification before calling.
   *
   * @param {string} agentId - Agent ID
   * @param {TrustLevel} trustLevel - New trust level
   * @returns {Promise<void>}
   */
  async updateTrustLevel(
    agentId: string,
    trustLevel: TrustLevel,
  ): Promise<void> {
    await db
      .update(agentRegistries)
      .set({ trustLevel })
      .where(eq(agentRegistries.agentId, agentId))
  }

  /**
   * Link external agent to User account
   *
   * @description Allows EXTERNAL agents to gain USER_CONTROLLED capabilities after verification.
   * Verifies agent is EXTERNAL type and user is not already linked to another agent.
   * Updates trust level to at least BASIC when linked.
   *
   * @param {string} agentId - External agent ID
   * @param {string} userId - User ID to link
   * @returns {Promise<AgentRegistration>} Updated agent registration
   * @throws {Error} If agent not found, not EXTERNAL type, user not found, or user already linked
   */
  async linkExternalAgentToUser(
    agentId: string,
    userId: string,
  ): Promise<AgentRegistration> {
    // Verify agent is EXTERNAL type
    const [registry] = await db
      .select()
      .from(agentRegistries)
      .where(eq(agentRegistries.agentId, agentId))
      .limit(1)

    if (!registry) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    if (registry.type !== AgentType.EXTERNAL) {
      throw new Error(
        `Only EXTERNAL agents can be linked to users. Agent ${agentId} is type ${registry.type}`,
      )
    }

    // Verify user exists and not already linked to another agent
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    const [existingAgentRegistry] = await db
      .select()
      .from(agentRegistries)
      .where(eq(agentRegistries.userId, userId))
      .limit(1)

    if (existingAgentRegistry) {
      throw new Error(
        `User ${userId} already linked to agent ${existingAgentRegistry.agentId}`,
      )
    }

    // Link external agent to user
    await db
      .update(agentRegistries)
      .set({
        userId,
        trustLevel: Math.max(Number(registry.trustLevel), 1), // At least BASIC trust when linked
      })
      .where(eq(agentRegistries.agentId, agentId))

    const updated = await this.getRegistryWithRelations(agentId)
    if (!updated) {
      throw new Error(`Failed to update agent: ${agentId}`)
    }

    return this.mapToRegistration(updated)
  }

  /**
   * Verify external agent API key
   *
   * @description Verifies an API key against registered external agents.
   * Decrypts stored credentials and checks hash.
   *
   * @param {string} apiKey - API key to verify
   * @returns {Promise<AgentRegistration | null>} Agent registration if valid, null otherwise
   */
  async verifyExternalAgentApiKey(
    apiKey: string,
  ): Promise<AgentRegistration | null> {
    const agents = await db
      .select()
      .from(externalAgentConnections)
      .where(eq(externalAgentConnections.authType, 'apiKey'))

    for (const agent of agents) {
      if (!agent.authCredentials) continue

      // Decrypt and verify credentials - continue to next agent if this one fails
      const decrypted = this.decryptCredentials(String(agent.authCredentials))
      const parsed: unknown = JSON.parse(decrypted)

      // Validate credentials structure
      if (!isObject(parsed)) continue
      const apiKeyHash = hasStringProperty(parsed, 'apiKeyHash')
        ? parsed.apiKeyHash
        : undefined

      const externalId = String(agent.externalId)
      if (apiKeyHash && verifyApiKey(apiKey, apiKeyHash)) {
        const registry = await this.getRegistryWithRelations(externalId)
        if (!registry) {
          logger.warn(
            `Valid key for external agent ${externalId} but missing AgentRegistry link`,
            undefined,
            'AgentRegistryService',
          )
          return null
        }
        return this.mapToRegistration(registry)
      }
    }

    return null
  }

  /**
   * Helper method to get registry with all relations
   * Uses raw SQL for proper type safety with joins
   */
  private async getRegistryWithRelations(
    agentId: string,
  ): Promise<RegistryWithRelations | null> {
    // Type for raw SQL join result - using actual DB column names
    interface RawJoinedRow {
      // AgentRegistry fields (camelCase from DB)
      id: string
      agent_id: string
      user_id: string | null
      actor_id: string | null
      type: string
      name: string
      system_prompt: string | null
      model_id: string | null
      status: string
      trust_level: number
      registered_at: Date
      last_active_at: Date | null
      metadata: JsonValue | null
      capabilities: string[] | null
      api_key_hash: string | null
      api_key_iv: string | null
      erc8004_contract_address: string | null
      agent0_address: string | null
      a2a_endpoint: string | null
      a2a_agent_card: JsonValue | null
      // AgentCapability fields (prefixed)
      cap_id: string | null
      cap_strategies: string[] | null
      cap_markets: string[] | null
      cap_actions: string[] | null
      cap_skills: string[] | null
      cap_domains: string[] | null
      // User fields (prefixed)
      user_username: string | null
      user_display_name: string | null
      user_email: string | null
      // ExternalAgentConnection fields (prefixed)
      ext_id: string | null
      ext_endpoint_url: string | null
      ext_protocol: string | null
      ext_status: string | null
    }

    // Query using actual DB column names (camelCase tables, camelCase columns)
    // Columns that don't exist in current schema are set to NULL
    const sql = `
      SELECT
        ar.id, ar.agentId as agent_id, ar.userId as user_id, ar.actorId as actor_id, ar.type, ar.name,
        ar.systemPrompt as system_prompt, NULL as model_id, ar.status, ar.trustLevel as trust_level,
        ar.registeredAt as registered_at, ar.lastActiveAt as last_active_at, NULL as metadata, NULL as capabilities,
        NULL as api_key_hash, NULL as api_key_iv, NULL as erc8004_contract_address,
        ar.agent0SubgraphOwner as agent0_address, ar.discoveryEndpointA2a as a2a_endpoint, NULL as a2a_agent_card,
        ac.id as cap_id, ac.strategies as cap_strategies, ac.markets as cap_markets,
        ac.actions as cap_actions, ac.skills as cap_skills, ac.domains as cap_domains,
        u.username as user_username, u.displayName as user_display_name, u.email as user_email,
        eac.id as ext_id, eac.endpoint as ext_endpoint_url,
        eac.protocol as ext_protocol, eac.isHealthy as ext_status
      FROM AgentRegistry ar
      LEFT JOIN AgentCapability ac ON ac.agentRegistryId = ar.id
      LEFT JOIN User u ON u.id = ar.userId
      LEFT JOIN ExternalAgentConnection eac ON eac.agentRegistryId = ar.id
      WHERE ar.agentId = $1
      LIMIT 1
    `

    const rows = await db.query<RawJoinedRow>(sql, [agentId])
    const row = rows[0]
    if (!row) return null

    // Get Actor from static registry
    const actorId = row.actor_id
    const staticActor = actorId ? StaticDataRegistry.getActor(actorId) : null

    // Map raw row to RegistryWithRelations (without capabilities array from registry)
    // Raw SQL to RegistryWithRelations mapping requires unknown intermediate
    const result = {
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
      actorId: row.actor_id,
      type: row.type,
      name: row.name,
      systemPrompt: row.system_prompt,
      model: row.model_id, // DB column is model_id, interface expects model
      status: row.status,
      trustLevel: row.trust_level !== null ? String(row.trust_level) : null,
      registeredAt: row.registered_at,
      lastActiveAt: row.last_active_at,
      metadata: row.metadata,
      apiKeyHash: row.api_key_hash,
      apiKeyIv: row.api_key_iv,
      erc8004ContractAddress: row.erc8004_contract_address,
      agent0Address: row.agent0_address,
      a2aEndpoint: row.a2a_endpoint,
      a2aAgentCard: row.a2a_agent_card,
      capabilities: row.cap_id
        ? ({
            id: row.cap_id,
            agentRegistryId: row.id,
            strategies: row.cap_strategies,
            markets: row.cap_markets,
            actions: row.cap_actions,
            skills: row.cap_skills,
            domains: row.cap_domains,
          } as AgentCapability)
        : null,
      User:
        row.user_username !== null
          ? ({
              id: row.user_id,
              username: row.user_username,
              displayName: row.user_display_name,
              email: row.user_email,
            } as User)
          : null,
      Actor: staticActor,
      externalConnection: row.ext_id
        ? ({
            id: row.ext_id,
            agentRegistryId: row.id,
            endpointUrl: row.ext_endpoint_url,
            protocol: row.ext_protocol,
            status: row.ext_status,
          } as unknown as ExternalAgentConnection)
        : null,
    }
    // Raw SQL to RegistryWithRelations mapping requires unknown intermediate
    return result as unknown as RegistryWithRelations
  }

  /**
   * Map database model to AgentRegistration type
   *
   * @description Maps SQLit AgentRegistry model with relations to AgentRegistration
   * type. Handles capabilities, discovery metadata, on-chain data, and Agent0 data mapping.
   *
   * @param {RegistryWithRelations} registry - Registry with relations
   * @returns {AgentRegistration} Agent registration
   * @private
   */
  private mapToRegistration(
    registry: RegistryWithRelations,
  ): AgentRegistration {
    // Map capabilities with null coalescing for array fields
    const cap = registry.capabilities
    const capabilities: AgentCapabilities = cap
      ? {
          strategies: cap.strategies ?? [],
          markets: cap.markets ?? [],
          actions: cap.actions ?? [],
          version: cap.version ?? '1.0.0',
          x402Support: cap.x402Support ?? false,
          platform: cap.platform,
          userType: cap.userType,
          gameNetwork: cap.gameNetworkChainId
            ? {
                chainId: cap.gameNetworkChainId,
                registryAddress:
                  cap.gameNetworkRpcUrl ||
                  '0x0000000000000000000000000000000000000000',
                reputationAddress: cap.gameNetworkExplorerUrl,
              }
            : undefined,
          skills: cap.skills ?? [],
          domains: cap.domains ?? [],
          a2aEndpoint: cap.a2aEndpoint,
          mcpEndpoint: cap.mcpEndpoint,
        }
      : {
          strategies: [],
          markets: [],
          actions: [],
          version: '1.0.0',
          x402Support: false,
          skills: [],
          domains: [],
        }

    const agentId = registry.agentId ?? registry.id
    return {
      agentId,
      type: registry.type as AgentType,
      status: registry.status as AgentStatus,
      // trustLevel is stored as string in DB, convert to TrustLevel enum
      // Default to BASIC if not set
      trustLevel: (() => {
        const level = String(registry.trustLevel ?? 'basic')
        // Map string to enum value
        const levelMap: Record<string, TrustLevel> = {
          '0': TrustLevel.UNTRUSTED,
          '1': TrustLevel.BASIC,
          '2': TrustLevel.VERIFIED,
          '3': TrustLevel.PREMIUM,
          untrusted: TrustLevel.UNTRUSTED,
          basic: TrustLevel.BASIC,
          verified: TrustLevel.VERIFIED,
          premium: TrustLevel.PREMIUM,
        }
        return levelMap[level.toLowerCase()] ?? TrustLevel.BASIC
      })(),
      userId: registry.userId,
      name: registry.name,
      systemPrompt: registry.systemPrompt ?? '',
      capabilities,
      discoveryMetadata: registry.discoveryCardVersion
        ? {
            version: '1.0' as const,
            agentId,
            name: registry.name,
            description: registry.systemPrompt ?? '',
            endpoints: {
              a2a: registry.discoveryEndpointA2a,
              mcp: registry.discoveryEndpointMcp,
              rpc: registry.discoveryEndpointRpc,
            },
            capabilities,
            authentication: registry.discoveryAuthRequired
              ? {
                  required: true,
                  methods: registry.discoveryAuthMethods as (
                    | 'apiKey'
                    | 'oauth'
                    | 'wallet'
                  )[],
                }
              : undefined,
            limits: registry.discoveryRateLimit
              ? {
                  rateLimit: registry.discoveryRateLimit,
                  costPerAction: registry.discoveryCostPerAction,
                }
              : undefined,
          }
        : null,
      onChainData: registry.onChainTokenId
        ? {
            tokenId: parseInt(registry.onChainTokenId, 10) || 0,
            txHash: registry.onChainTxHash ?? '',
            serverWallet: registry.onChainServerWallet ?? '',
            reputationScore: registry.onChainReputationScore ?? 0,
            chainId:
              typeof registry.onChainChainId === 'string'
                ? parseInt(registry.onChainChainId, 10)
                : (registry.onChainChainId ?? 31337),
            contracts: {
              identityRegistry: registry.onChainIdentityRegistry ?? '',
              reputationSystem: registry.onChainReputationSystem ?? '',
            },
          }
        : null,
      agent0Data: registry.agent0TokenId
        ? {
            tokenId: registry.agent0TokenId,
            metadataCID: registry.agent0MetadataCID ?? '',
            subgraphData: registry.agent0SubgraphOwner
              ? {
                  owner: registry.agent0SubgraphOwner,
                  metadataURI: registry.agent0SubgraphMetadataURI ?? '',
                  timestamp:
                    registry.agent0SubgraphTimestamp instanceof Date
                      ? registry.agent0SubgraphTimestamp.getTime()
                      : typeof registry.agent0SubgraphTimestamp === 'number'
                        ? registry.agent0SubgraphTimestamp
                        : 0,
                }
              : undefined,
            discoveryEndpoint: registry.agent0DiscoveryEndpoint ?? '',
          }
        : null,
      runtimeInstanceId: registry.runtimeInstanceId,
      registeredAt: registry.registeredAt ?? new Date(),
      lastActiveAt: registry.lastActiveAt,
      terminatedAt: registry.terminatedAt,
    }
  }

  /**
   * Encrypt credentials for secure storage
   * Uses AES-256-CBC encryption with random IV
   */
  private encryptCredentials(credentials: string): string {
    const iv = randomBytes(16)
    const key = Buffer.from(getEncryptionKey().padEnd(32).slice(0, 32))
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(credentials, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return `${iv.toString('hex')}:${encrypted}`
  }

  /**
   * Decrypt credentials
   */
  private decryptCredentials(encrypted: string): string {
    const [ivHex, encryptedHex] = encrypted.split(':')
    if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted format')

    const iv = Buffer.from(ivHex, 'hex')
    const key = Buffer.from(getEncryptionKey().padEnd(32).slice(0, 32))
    const decipher = createDecipheriv(ALGORITHM, key, iv)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistryService()
