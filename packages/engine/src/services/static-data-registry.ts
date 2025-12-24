/**
 * Static Data Registry
 *
 * Provides in-memory access to all static game data that doesn't change during gameplay.
 * This eliminates database queries for immutable entity properties.
 *
 * STATIC DATA (never changes during gameplay):
 * - Actor: name, description, domain, personality, tier, affiliations, postStyle, postExample, role
 * - Organization: name, ticker, description, type, canBeInvolved, initialPrice
 * - Character Mappings: real name → parody name
 * - Organization Mappings: real org → parody org
 *
 * DYNAMIC DATA (still requires DB):
 * - Actor: tradingBalance, reputationPoints, hasPool
 * - Organization: currentPrice
 * - Positions, trades, posts, etc.
 *
 * Usage:
 * ```typescript
 * import { StaticDataRegistry } from '@babylon/engine';
 *
 * // Get static actor data (no DB call)
 * const actor = StaticDataRegistry.getActor('elon-usk');
 * console.log(actor.name, actor.tier, actor.personality);
 *
 * // Get all actors
 * const allActors = StaticDataRegistry.getAllActors();
 *
 * // Get organization
 * const org = StaticDataRegistry.getOrganization('pear-inc');
 * ```
 */

import type { ActorTier } from '@babylon/shared'
import { actors as actorsData } from '../data/actors'
import { organizations as organizationsData } from '../data/organizations'

/** Raw actor data type from imported data files */
interface RawActorData {
  id: string
  name: string
  realName?: string
  description?: string
  domain?: string[]
  personality?: string
  tier?: string
  affiliations?: string[]
  postStyle?: string
  postExample?: string[]
  role?: string
  initialLuck?: string
  initialMood?: number
}

/** Raw organization data type from imported data files */
interface RawOrgData {
  id: string
  name: string
  ticker?: string
  description?: string
  type?: string
  canBeInvolved?: boolean
  initialPrice?: number
  originalName?: string
  originalHandle?: string
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Static actor data - immutable properties that don't change during gameplay
 */
export interface StaticActor {
  id: string
  name: string
  realName?: string
  description?: string
  domain: string[]
  personality?: string
  tier: ActorTier | null
  affiliations: string[]
  postStyle?: string
  postExample: string[]
  role?: string
  initialLuck: string
  initialMood: number
  profileImageUrl?: string
  isTest: boolean
}

/** Organization type enum matching @babylon/shared */
export type OrgType =
  | 'company'
  | 'media'
  | 'government'
  | 'vc'
  | 'organization'
  | 'financial'

/**
 * Static organization data - immutable properties
 */
export interface StaticOrganization {
  id: string
  name: string
  ticker?: string
  description: string
  type: OrgType
  canBeInvolved: boolean
  initialPrice: number | null
  imageUrl?: string
  originalName?: string
  originalHandle?: string
}

/**
 * Character mapping - real name to parody name
 */
export interface CharacterMapping {
  realName: string
  parodyName: string
  category: string
  aliases: string[]
  priority: number
}

/**
 * Organization mapping - real org to parody org
 */
export interface OrganizationMapping {
  realName: string
  parodyName: string
  category: string
  aliases: string[]
  priority: number
}

// =============================================================================
// STATIC DATA REGISTRY
// =============================================================================

// biome-ignore lint/complexity/noStaticOnlyClass: Service pattern uses static methods for stateless operations
export class StaticDataRegistry {
  // In-memory caches
  private static actorMap: Map<string, StaticActor> | null = null
  private static actorList: StaticActor[] | null = null
  private static orgMap: Map<string, StaticOrganization> | null = null
  private static orgList: StaticOrganization[] | null = null
  private static charMappings: Map<string, CharacterMapping> | null = null
  private static orgMappings: Map<string, OrganizationMapping> | null = null
  private static actorsByTier: Map<ActorTier | 'NONE', StaticActor[]> | null =
    null
  private static actorsByDomain: Map<string, StaticActor[]> | null = null

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private static initialize(): void {
    if (StaticDataRegistry.actorMap !== null) return

    StaticDataRegistry.actorMap = new Map()
    StaticDataRegistry.actorList = []
    StaticDataRegistry.actorsByTier = new Map([
      ['S_TIER', []],
      ['A_TIER', []],
      ['B_TIER', []],
      ['C_TIER', []],
      ['NONE', []],
    ])
    StaticDataRegistry.actorsByDomain = new Map()

    // Load actors from TypeScript data (readonly array from static JSON)
    for (const actorRaw of actorsData as readonly RawActorData[]) {
      const staticActor: StaticActor = {
        id: actorRaw.id,
        name: actorRaw.name,
        realName: actorRaw.realName,
        description: actorRaw.description,
        domain: actorRaw.domain ?? [],
        personality: actorRaw.personality,
        tier: (actorRaw.tier as ActorTier) ?? null,
        affiliations: actorRaw.affiliations ?? [],
        postStyle: actorRaw.postStyle,
        postExample: actorRaw.postExample ?? [],
        role: actorRaw.role,
        initialLuck: actorRaw.initialLuck ?? 'medium',
        initialMood: actorRaw.initialMood ?? 0,
        profileImageUrl: StaticDataRegistry.getActorImageUrl(actorRaw.id),
        isTest: actorRaw.id.startsWith('test-'),
      }

      StaticDataRegistry.actorMap.set(actorRaw.id, staticActor)
      StaticDataRegistry.actorList.push(staticActor)

      // Index by tier
      const tierKey = (staticActor.tier ?? 'NONE') as ActorTier | 'NONE'
      StaticDataRegistry.actorsByTier.get(tierKey)?.push(staticActor)

      // Index by domain
      for (const domain of staticActor.domain) {
        if (!StaticDataRegistry.actorsByDomain.has(domain)) {
          StaticDataRegistry.actorsByDomain.set(domain, [])
        }
        StaticDataRegistry.actorsByDomain.get(domain)?.push(staticActor)
      }
    }

    StaticDataRegistry.orgMap = new Map()
    StaticDataRegistry.orgList = []

    // Load organizations from TypeScript data
    for (const orgRaw of organizationsData as readonly RawOrgData[]) {
      const staticOrg: StaticOrganization = {
        id: orgRaw.id,
        name: orgRaw.name,
        ticker: orgRaw.ticker,
        description: orgRaw.description ?? '',
        type: (orgRaw.type as OrgType) ?? 'company',
        canBeInvolved: orgRaw.canBeInvolved !== false,
        initialPrice: orgRaw.initialPrice ?? null,
        imageUrl: StaticDataRegistry.getOrgImageUrl(orgRaw.id),
        originalName: orgRaw.originalName,
        originalHandle: orgRaw.originalHandle,
      }

      StaticDataRegistry.orgMap.set(orgRaw.id, staticOrg)
      StaticDataRegistry.orgList.push(staticOrg)
    }

    // Build character mappings
    StaticDataRegistry.charMappings = new Map()
    for (const actor of StaticDataRegistry.actorList) {
      if (actor.realName) {
        const mapping: CharacterMapping = {
          realName: actor.realName,
          parodyName: actor.name,
          category: StaticDataRegistry.mapDomainToCategory(actor.domain),
          aliases: StaticDataRegistry.generateActorAliases(actor),
          priority: StaticDataRegistry.mapTierToPriority(actor.tier),
        }
        StaticDataRegistry.charMappings.set(
          actor.realName.toLowerCase(),
          mapping,
        )
      }
    }

    // Build organization mappings
    StaticDataRegistry.orgMappings = new Map()
    for (const org of StaticDataRegistry.orgList) {
      if (org.originalName) {
        const mapping: OrganizationMapping = {
          realName: org.originalName,
          parodyName: org.name,
          category: StaticDataRegistry.mapOrgTypeToCategory(org.type),
          aliases: org.originalHandle ? [org.originalHandle] : [],
          priority: StaticDataRegistry.getOrganizationPriority(
            org.originalName,
            org.type,
          ),
        }
        StaticDataRegistry.orgMappings.set(
          org.originalName.toLowerCase(),
          mapping,
        )
      }
    }
  }

  // ==========================================================================
  // ACTOR ACCESSORS
  // ==========================================================================

  /**
   * Get a static actor by ID - NO DATABASE CALL
   */
  static getActor(id: string): StaticActor | null {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.actorMap?.get(id) ?? null
  }

  /**
   * Get all static actors - NO DATABASE CALL
   */
  static getAllActors(): StaticActor[] {
    StaticDataRegistry.initialize()
    return [...(StaticDataRegistry.actorList ?? [])]
  }

  /**
   * Get actors by tier - NO DATABASE CALL
   */
  static getActorsByTier(tier: ActorTier): StaticActor[] {
    StaticDataRegistry.initialize()
    return [...(StaticDataRegistry.actorsByTier?.get(tier) ?? [])]
  }

  /**
   * Get actors by domain - NO DATABASE CALL
   */
  static getActorsByDomain(domain: string): StaticActor[] {
    StaticDataRegistry.initialize()
    return [...(StaticDataRegistry.actorsByDomain?.get(domain) ?? [])]
  }

  /**
   * Get all actor IDs - NO DATABASE CALL
   */
  static getActorIds(): string[] {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.actorList?.map((a) => a.id) ?? []
  }

  /**
   * Get actor count - NO DATABASE CALL
   */
  static getActorCount(): number {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.actorList?.length ?? 0
  }

  /**
   * Check if actor exists - NO DATABASE CALL
   */
  static hasActor(id: string): boolean {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.actorMap?.has(id) ?? false
  }

  /**
   * Get random actors - NO DATABASE CALL
   */
  static getRandomActors(count: number): StaticActor[] {
    StaticDataRegistry.initialize()
    const actors = [...(StaticDataRegistry.actorList ?? [])]
    const shuffled = actors.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  /**
   * Get top actors by tier (S_TIER first) - NO DATABASE CALL
   */
  static getTopActors(count: number): StaticActor[] {
    StaticDataRegistry.initialize()
    const result: StaticActor[] = []
    const tiers: (ActorTier | 'NONE')[] = [
      'S_TIER',
      'A_TIER',
      'B_TIER',
      'C_TIER',
      'NONE',
    ]

    for (const tier of tiers) {
      const tierActors = StaticDataRegistry.actorsByTier?.get(tier) ?? []
      for (const actor of tierActors) {
        if (result.length >= count) break
        result.push(actor)
      }
      if (result.length >= count) break
    }

    return result
  }

  // ==========================================================================
  // ORGANIZATION ACCESSORS
  // ==========================================================================

  /**
   * Get a static organization by ID - NO DATABASE CALL
   */
  static getOrganization(id: string): StaticOrganization | null {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.orgMap?.get(id) ?? null
  }

  /**
   * Get all static organizations - NO DATABASE CALL
   */
  static getAllOrganizations(): StaticOrganization[] {
    StaticDataRegistry.initialize()
    return [...(StaticDataRegistry.orgList ?? [])]
  }

  /**
   * Get all organization IDs - NO DATABASE CALL
   */
  static getOrganizationIds(): string[] {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.orgList?.map((o) => o.id) ?? []
  }

  /**
   * Get organization count - NO DATABASE CALL
   */
  static getOrganizationCount(): number {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.orgList?.length ?? 0
  }

  /**
   * Check if organization exists - NO DATABASE CALL
   */
  static hasOrganization(id: string): boolean {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.orgMap?.has(id) ?? false
  }

  /**
   * Get organizations by type - NO DATABASE CALL
   */
  static getOrganizationsByType(type: string): StaticOrganization[] {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.orgList?.filter((o) => o.type === type) ?? []
  }

  // ==========================================================================
  // CHARACTER MAPPING ACCESSORS
  // ==========================================================================

  /**
   * Get parody name for a real person - NO DATABASE CALL
   */
  static getParodyName(realName: string): string | null {
    StaticDataRegistry.initialize()
    return (
      StaticDataRegistry.charMappings?.get(realName.toLowerCase())
        ?.parodyName ?? null
    )
  }

  /**
   * Get full character mapping - NO DATABASE CALL
   */
  static getCharacterMapping(realName: string): CharacterMapping | null {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.charMappings?.get(realName.toLowerCase()) ?? null
  }

  /**
   * Get all character mappings - NO DATABASE CALL
   */
  static getAllCharacterMappings(): CharacterMapping[] {
    StaticDataRegistry.initialize()
    return [...(StaticDataRegistry.charMappings?.values() ?? [])]
  }

  // ==========================================================================
  // ORGANIZATION MAPPING ACCESSORS
  // ==========================================================================

  /**
   * Get parody name for a real organization - NO DATABASE CALL
   */
  static getParodyOrgName(realName: string): string | null {
    StaticDataRegistry.initialize()
    return (
      StaticDataRegistry.orgMappings?.get(realName.toLowerCase())?.parodyName ??
      null
    )
  }

  /**
   * Get full organization mapping - NO DATABASE CALL
   */
  static getOrganizationMapping(realName: string): OrganizationMapping | null {
    StaticDataRegistry.initialize()
    return StaticDataRegistry.orgMappings?.get(realName.toLowerCase()) ?? null
  }

  /**
   * Get all organization mappings - NO DATABASE CALL
   */
  static getAllOrganizationMappings(): OrganizationMapping[] {
    StaticDataRegistry.initialize()
    return [...(StaticDataRegistry.orgMappings?.values() ?? [])]
  }

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Clear all caches (useful for testing)
   */
  static clearCache(): void {
    StaticDataRegistry.actorMap = null
    StaticDataRegistry.actorList = null
    StaticDataRegistry.orgMap = null
    StaticDataRegistry.orgList = null
    StaticDataRegistry.charMappings = null
    StaticDataRegistry.orgMappings = null
    StaticDataRegistry.actorsByTier = null
    StaticDataRegistry.actorsByDomain = null
  }

  /**
   * Get statistics about loaded data
   */
  static getStats(): {
    actors: number
    organizations: number
    characterMappings: number
    organizationMappings: number
    actorsByTier: Record<string, number>
    topDomains: Array<{ domain: string; count: number }>
  } {
    StaticDataRegistry.initialize()

    const tierCounts: Record<string, number> = {}
    for (const [tier, actors] of StaticDataRegistry.actorsByTier?.entries() ??
      []) {
      tierCounts[tier] = actors.length
    }

    const domainCounts: Array<{ domain: string; count: number }> = []
    for (const [
      domain,
      actors,
    ] of StaticDataRegistry.actorsByDomain?.entries() ?? []) {
      domainCounts.push({ domain, count: actors.length })
    }
    domainCounts.sort((a, b) => b.count - a.count)

    return {
      actors: StaticDataRegistry.actorList?.length ?? 0,
      organizations: StaticDataRegistry.orgList?.length ?? 0,
      characterMappings: StaticDataRegistry.charMappings?.size ?? 0,
      organizationMappings: StaticDataRegistry.orgMappings?.size ?? 0,
      actorsByTier: tierCounts,
      topDomains: domainCounts.slice(0, 10),
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private static getActorImageUrl(actorId: string): string | undefined {
    // Always return URL - browser/CSS will handle missing images with fallbacks
    return `/images/actors/${actorId}.jpg`
  }

  private static getOrgImageUrl(orgId: string): string | undefined {
    // Always return URL - browser/CSS will handle missing images with fallbacks
    return `/images/organizations/${orgId}.jpg`
  }

  private static mapDomainToCategory(domains: string[]): string {
    if (domains.length === 0) return 'general'
    if (domains.includes('crypto')) return 'crypto'
    if (domains.includes('politics') || domains.includes('government'))
      return 'politics'
    if (
      domains.includes('tech') ||
      domains.includes('ai') ||
      domains.includes('technology')
    )
      return 'tech'
    return domains[0] ?? 'general'
  }

  private static mapTierToPriority(tier: ActorTier | null): number {
    switch (tier) {
      case 'S_TIER':
        return 100
      case 'A_TIER':
        return 90
      case 'B_TIER':
        return 80
      case 'C_TIER':
        return 70
      default:
        return 50
    }
  }

  private static mapOrgTypeToCategory(orgType: string): string {
    switch (orgType) {
      case 'company':
        return 'tech'
      case 'media':
        return 'media'
      case 'government':
        return 'government'
      default:
        return 'general'
    }
  }

  private static getOrganizationPriority(
    orgName: string,
    orgType: string,
  ): number {
    const majorTechOrgs = [
      'OpenAI',
      'Meta',
      'Google',
      'Microsoft',
      'Apple',
      'Amazon',
      'Tesla',
      'Twitter',
      'Anthropic',
      'NVIDIA',
    ]
    if (
      majorTechOrgs.some((n) => orgName.toLowerCase().includes(n.toLowerCase()))
    )
      return 100

    const majorCryptoOrgs = ['Binance', 'Coinbase', 'Ethereum']
    if (
      majorCryptoOrgs.some((n) =>
        orgName.toLowerCase().includes(n.toLowerCase()),
      )
    )
      return 90

    const majorMedia = ['New York Times', 'Washington Post', 'CNN', 'Fox News']
    if (majorMedia.some((n) => orgName.toLowerCase().includes(n.toLowerCase())))
      return 85

    if (orgType === 'government') return 80
    return 70
  }

  private static generateActorAliases(actor: StaticActor): string[] {
    const aliases: string[] = []
    // Extract last name from parody name if it has spaces
    const nameParts = actor.name.split(' ')
    if (nameParts.length > 1) {
      const lastName = nameParts[nameParts.length - 1]
      if (lastName) aliases.push(lastName)
    }
    return aliases
  }
}

// Export convenience functions for common operations
export const getActor = StaticDataRegistry.getActor.bind(StaticDataRegistry)
export const getAllActors =
  StaticDataRegistry.getAllActors.bind(StaticDataRegistry)
export const getOrganization =
  StaticDataRegistry.getOrganization.bind(StaticDataRegistry)
export const getAllOrganizations =
  StaticDataRegistry.getAllOrganizations.bind(StaticDataRegistry)
export const getParodyName =
  StaticDataRegistry.getParodyName.bind(StaticDataRegistry)
export const getParodyOrgName =
  StaticDataRegistry.getParodyOrgName.bind(StaticDataRegistry)
