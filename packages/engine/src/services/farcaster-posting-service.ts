/**
 * Farcaster Posting Service
 *
 * Bridge between Babylon's game engine and Farcaster network.
 * When enabled, posts are created both locally AND on Farcaster.
 *
 * This service handles:
 * - NPC posts to Farcaster via their registered FIDs
 * - User posts to Farcaster (if user has linked Farcaster account)
 * - Automatic fallback to local-only if Farcaster is unavailable
 */

import { logger } from '@babylon/shared'
import { getFarcasterHubUrl, getKMSEndpoint } from '@babylon/shared/config'
import type { Hex } from 'viem'

/** Configuration for the Farcaster posting service */
export interface FarcasterPostingConfig {
  /** Enable Farcaster integration (default: true if FARCASTER_ENABLED=true) */
  enabled: boolean
  /** Hub URL for posting (default: mainnet hub) */
  hubUrl: string
  /** Fallback hub URLs */
  fallbackHubUrls?: string[]
  /** Network (mainnet, testnet, devnet) */
  network: 'mainnet' | 'testnet' | 'devnet'
  /** KMS endpoint for secure key management */
  kmsEndpoint?: string
  /** Signer seed for development (NOT for production) */
  signerSeed?: string
}

/** Result of posting to Farcaster */
export interface FarcasterPostResult {
  success: boolean
  /** Farcaster cast hash if successful */
  hash?: string
  /** Error message if failed */
  error?: string
  /** Whether the post was also saved locally */
  savedLocally: boolean
}

/** NPC identity for Farcaster posting */
interface NPCFarcasterIdentity {
  actorId: string
  fid: number
  signerPrivateKey: Hex
}

/**
 * Service for posting to Farcaster from Babylon
 */
class FarcasterPostingService {
  private config: FarcasterPostingConfig
  private npcIdentityCache = new Map<string, NPCFarcasterIdentity>()
  private initialized = false

  constructor() {
    this.config = {
      enabled:
        (typeof process !== 'undefined'
          ? process.env.FARCASTER_ENABLED
          : undefined) === 'true',
      hubUrl:
        (typeof process !== 'undefined'
          ? process.env.FARCASTER_HUB_URL
          : undefined) ?? getFarcasterHubUrl(),
      fallbackHubUrls:
        typeof process !== 'undefined' && process.env.FARCASTER_FALLBACK_HUBS
          ? process.env.FARCASTER_FALLBACK_HUBS.split(',')
          : undefined,
      network:
        ((typeof process !== 'undefined'
          ? process.env.FARCASTER_NETWORK
          : undefined) as FarcasterPostingConfig['network'] | undefined) ??
        'mainnet',
      kmsEndpoint: getKMSEndpoint(),
      // Signer seed is a secret - keep as env var
      signerSeed:
        typeof process !== 'undefined' ? process.env.SIGNER_SEED : undefined,
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (!this.config.enabled) {
      logger.info(
        'Farcaster posting disabled (set FARCASTER_ENABLED=true to enable)',
        undefined,
        'FarcasterPostingService',
      )
      this.initialized = true
      return
    }

    logger.info(
      'Farcaster posting enabled',
      {
        hubUrl: this.config.hubUrl,
        network: this.config.network,
        hasKMS: !!this.config.kmsEndpoint,
      },
      'FarcasterPostingService',
    )

    this.initialized = true
  }

  /**
   * Check if Farcaster posting is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get or load NPC Farcaster identity
   */
  private async getNPCIdentity(
    actorId: string,
  ): Promise<NPCFarcasterIdentity | null> {
    // Check cache
    const cached = this.npcIdentityCache.get(actorId)
    if (cached) return cached

    // Try to get from KMS if configured
    if (this.config.kmsEndpoint) {
      try {
        const keyId = `fc-signer:${actorId}`
        const fidResponse = await fetch(
          `${this.config.kmsEndpoint}/keys/${keyId}/metadata`,
          {
            signal: AbortSignal.timeout(5000),
          },
        )

        if (!fidResponse.ok) {
          logger.debug(
            `No Farcaster identity for NPC ${actorId}`,
            undefined,
            'FarcasterPostingService',
          )
          return null
        }

        const metadata: { fid?: number } = await fidResponse.json()
        if (!metadata.fid) return null

        // Get signer key
        const keyResponse = await fetch(
          `${this.config.kmsEndpoint}/keys/${keyId}/export`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000),
          },
        )

        if (!keyResponse.ok) return null

        const keyData: { privateKey?: string } = await keyResponse.json()
        if (!keyData.privateKey) return null

        const identity: NPCFarcasterIdentity = {
          actorId,
          fid: metadata.fid,
          signerPrivateKey: keyData.privateKey as Hex,
        }

        this.npcIdentityCache.set(actorId, identity)
        return identity
      } catch (error) {
        logger.warn(
          `Failed to get Farcaster identity for NPC ${actorId}`,
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'FarcasterPostingService',
        )
        return null
      }
    }

    // Development fallback: derive from seed
    if (this.config.signerSeed && process.env.NODE_ENV !== 'production') {
      logger.warn(
        'Using development fallback for Farcaster identity - NOT for production',
        { actorId },
        'FarcasterPostingService',
      )

      // Generate deterministic FID and key from seed
      const encoder = new TextEncoder()
      const seed = encoder.encode(
        `fc-signer:${actorId}:${this.config.signerSeed}`,
      )
      const hashBuffer = await crypto.subtle.digest('SHA-256', seed)
      const hashArray = new Uint8Array(hashBuffer)

      // Use first 4 bytes for FID (mock), rest for key
      const fid =
        ((hashArray[0] ?? 0) << 24) |
        ((hashArray[1] ?? 0) << 16) |
        ((hashArray[2] ?? 0) << 8) |
        (hashArray[3] ?? 0)
      const signerPrivateKey: Hex = `0x${Buffer.from(hashArray).toString('hex')}`

      const identity: NPCFarcasterIdentity = {
        actorId,
        fid: (Math.abs(fid) % 1000000) + 100000, // Keep FID reasonable
        signerPrivateKey,
      }

      this.npcIdentityCache.set(actorId, identity)
      return identity
    }

    return null
  }

  /**
   * Post as an NPC to Farcaster
   *
   * @param actorId - NPC actor ID
   * @param content - Post content
   * @returns Post result with hash if successful
   */
  async postAsNPC(
    actorId: string,
    content: string,
  ): Promise<FarcasterPostResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Farcaster posting disabled',
        savedLocally: true,
      }
    }

    const identity = await this.getNPCIdentity(actorId)
    if (!identity) {
      return {
        success: false,
        error: `NPC ${actorId} has no Farcaster identity`,
        savedLocally: true,
      }
    }

    try {
      // Dynamically import to avoid loading Farcaster deps if not enabled
      const { createPoster, DEFAULT_HUBS } = await import(
        '@jejunetwork/messaging'
      )

      const poster = createPoster(
        identity.fid,
        identity.signerPrivateKey,
        this.config.hubUrl || DEFAULT_HUBS.mainnet,
        {
          fallbackHubUrls: this.config.fallbackHubUrls,
          network: this.config.network,
        },
      )

      const result = await poster.cast(content)

      logger.info(
        `NPC ${actorId} posted to Farcaster`,
        { hash: result.hash, fid: result.fid },
        'FarcasterPostingService',
      )

      return {
        success: true,
        hash: result.hash,
        savedLocally: true,
      }
    } catch (error) {
      logger.error(
        `Failed to post to Farcaster for NPC ${actorId}`,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'FarcasterPostingService',
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        savedLocally: true,
      }
    }
  }

  /**
   * Post as a user to Farcaster
   *
   * @param userId - User ID
   * @param fid - User's Farcaster FID
   * @param signerPrivateKey - User's Farcaster signer key
   * @param content - Post content
   */
  async postAsUser(
    userId: string,
    fid: number,
    signerPrivateKey: Hex,
    content: string,
  ): Promise<FarcasterPostResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Farcaster posting disabled',
        savedLocally: true,
      }
    }

    try {
      const { createPoster, DEFAULT_HUBS } = await import(
        '@jejunetwork/messaging'
      )

      const poster = createPoster(
        fid,
        signerPrivateKey,
        this.config.hubUrl || DEFAULT_HUBS.mainnet,
        {
          fallbackHubUrls: this.config.fallbackHubUrls,
          network: this.config.network,
        },
      )

      const result = await poster.cast(content)

      logger.info(
        `User ${userId} posted to Farcaster`,
        { hash: result.hash, fid: result.fid },
        'FarcasterPostingService',
      )

      return {
        success: true,
        hash: result.hash,
        savedLocally: true,
      }
    } catch (error) {
      logger.error(
        `Failed to post to Farcaster for user ${userId}`,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'FarcasterPostingService',
      )

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        savedLocally: true,
      }
    }
  }

  /**
   * Clear identity cache (for testing)
   */
  clearCache(): void {
    this.npcIdentityCache.clear()
  }
}

// Singleton instance
let farcasterPostingService: FarcasterPostingService | null = null

/**
 * Get the Farcaster posting service singleton
 */
export function getFarcasterPostingService(): FarcasterPostingService {
  if (!farcasterPostingService) {
    farcasterPostingService = new FarcasterPostingService()
  }
  return farcasterPostingService
}

/**
 * Reset the service (for testing)
 */
export function resetFarcasterPostingService(): void {
  if (farcasterPostingService) {
    farcasterPostingService.clearCache()
  }
  farcasterPostingService = null
}
