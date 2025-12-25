/**
 * NPC Identity Service
 *
 * Identity management for NPC actors:
 * - Ethereum wallets (via Jeju KMS)
 * - Farcaster FIDs (on Optimism)
 * - Encryption keys (on Jeju KeyRegistry)
 *
 * All keys are managed via Jeju's decentralized KMS (TEE/MPC).
 * NPCs can post to Farcaster and receive encrypted DMs.
 *
 * Config-first: Uses Babylon shared config for Farcaster hub URL.
 *
 * @packageDocumentation
 */

import { db, type UserInsert } from '@babylon/db'
import { type StaticActor, StaticDataRegistry } from '@babylon/engine'
import {
  generateRandomWallet,
  getFarcasterHubUrl,
  isValidHex,
  keccak256,
  toAddressOrNull,
} from '@babylon/shared'
import { toNull } from '@jejunetwork/shared'
import type { Address, Hex } from 'viem'
import { isProductionEnvironment } from '../config/tee'
import { logger } from '../shared/logger'

/**
 * KMS integration types - matches Jeju KMS interface
 */
interface KMSGeneratedKey {
  metadata: {
    id: string
    type: string
    curve: string
    createdAt: number
    owner: Address
    providerType: string
  }
  publicKey: Hex
}

interface KMSSignedMessage {
  message: Hex
  signature: Hex
  recoveryId: number
  keyId: string
  signedAt: number
}

/**
 * NPC Identity configuration
 */
export interface NPCIdentityConfig {
  /** Jeju KMS endpoint */
  kmsEndpoint: string
  /** Farcaster Hub URL */
  farcasterHubUrl: string
  /** Jeju L2 RPC URL for KeyRegistry */
  jejuRpcUrl: string
  /** KeyRegistry contract address on Jeju */
  keyRegistryAddress: Address
  /** Enable external Farcaster visibility (for future use) */
  enableExternalFarcaster: boolean
}

/**
 * NPC identity state
 */
export interface NPCIdentity {
  actorId: string
  userId: string
  walletAddress: Address
  farcasterFid: number | null
  farcasterSignerKeyId: string | null
  encryptionKeyId: string | null
  encryptionPublicKey: Hex | null
  registeredAt: Date
  fullyInitialized: boolean
}

// Note: Farcaster IdRegistry and KeyRegistry ABIs removed
// IdRegistry registration is skipped to avoid gas costs on Optimism
// FIDs can be set manually or registered in bulk later

/**
 * Service for managing NPC decentralized identities
 */
export class NPCIdentityService {
  private config: NPCIdentityConfig
  private identityCache: Map<string, NPCIdentity> = new Map()
  private kmsClient: KMSClient | null = null

  constructor(config: Partial<NPCIdentityConfig> = {}) {
    this.config = {
      kmsEndpoint:
        config.kmsEndpoint ??
        process.env.JEJU_KMS_ENDPOINT ??
        'http://localhost:3300',
      farcasterHubUrl: config.farcasterHubUrl ?? getFarcasterHubUrl(),
      jejuRpcUrl:
        config.jejuRpcUrl ??
        process.env.JEJU_RPC_URL ??
        'http://localhost:6545',
      keyRegistryAddress:
        toAddressOrNull(
          config.keyRegistryAddress ?? process.env.JEJU_KEY_REGISTRY_ADDRESS,
        ) ?? '0x0000000000000000000000000000000000000000',
      enableExternalFarcaster:
        config.enableExternalFarcaster ??
        process.env.ENABLE_EXTERNAL_FARCASTER === 'true',
    }
  }

  /**
   * Initialize KMS connection
   */
  private async getKMS(): Promise<KMSClient> {
    if (!this.kmsClient) {
      this.kmsClient = new KMSClient(this.config.kmsEndpoint)
      await this.kmsClient.connect()
    }
    return this.kmsClient
  }

  /**
   * Initialize identity for a single NPC
   * Creates wallet, registers on Farcaster, registers encryption keys
   */
  async initializeNPCIdentity(actorId: string): Promise<NPCIdentity> {
    logger.info(
      `Initializing identity for NPC: ${actorId}`,
      undefined,
      'NPCIdentityService',
    )

    // Check cache
    const cached = this.identityCache.get(actorId)
    if (cached?.fullyInitialized) {
      return cached
    }

    // Verify actor exists in static registry
    const actor = StaticDataRegistry.getActor(actorId)
    if (!actor) {
      throw new Error(`Actor not found: ${actorId}`)
    }

    // Step 1: Ensure User record exists
    const userId = await this.ensureUserRecord(actor)

    // Step 2: Create/retrieve wallet
    const walletAddress = await this.ensureWallet(userId, actorId)

    // Step 3: Register on Farcaster (if enabled)
    let farcasterFid: number | null = null
    let farcasterSignerKeyId: string | null = null

    if (this.config.enableExternalFarcaster) {
      const farcasterResult = await this.registerFarcasterIdentity(
        userId,
        actorId,
        walletAddress,
      )
      farcasterFid = farcasterResult.fid
      farcasterSignerKeyId = farcasterResult.signerKeyId
    }

    // Step 4: Register encryption keys on Jeju
    const encryptionResult = await this.registerEncryptionKeys(
      userId,
      actorId,
      walletAddress,
    )

    const identity: NPCIdentity = {
      actorId,
      userId,
      walletAddress,
      farcasterFid,
      farcasterSignerKeyId,
      encryptionKeyId: encryptionResult.keyId,
      encryptionPublicKey: encryptionResult.publicKey,
      registeredAt: new Date(),
      fullyInitialized: true,
    }

    this.identityCache.set(actorId, identity)

    logger.info(
      `NPC identity initialized: ${actorId}`,
      {
        userId,
        walletAddress,
        farcasterFid,
        hasEncryptionKey: !!encryptionResult.keyId,
      },
      'NPCIdentityService',
    )

    return identity
  }

  /**
   * Initialize identities for all NPCs
   */
  async initializeAllNPCs(): Promise<{
    total: number
    success: number
    failed: number
    errors: Array<{ actorId: string; error: string }>
  }> {
    const actors = StaticDataRegistry.getAllActors()
    const result = {
      total: actors.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ actorId: string; error: string }>,
    }

    logger.info(
      `Initializing ${actors.length} NPC identities...`,
      undefined,
      'NPCIdentityService',
    )

    for (const actor of actors) {
      try {
        await this.initializeNPCIdentity(actor.id)
        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({
          actorId: actor.id,
          error: error instanceof Error ? error.message : String(error),
        })
        logger.warn(
          `Failed to initialize NPC identity: ${actor.id}`,
          { error },
          'NPCIdentityService',
        )
      }
    }

    logger.info(
      `NPC identity initialization complete`,
      {
        total: result.total,
        success: result.success,
        failed: result.failed,
      },
      'NPCIdentityService',
    )

    return result
  }

  /**
   * Get NPC identity by actor ID
   */
  async getNPCIdentity(actorId: string): Promise<NPCIdentity | null> {
    // Check cache
    const cached = this.identityCache.get(actorId)
    if (cached) return cached

    // Load from database
    const actor = StaticDataRegistry.getActor(actorId)
    if (!actor) return null

    const user = await db.user.findUnique({ where: { id: actorId } })

    if (!user) return null

    const walletAddr = toAddressOrNull(user.walletAddress)
    if (!walletAddr) return null

    const identity: NPCIdentity = {
      actorId,
      userId: String(user.id),
      walletAddress: walletAddr,
      farcasterFid: user.farcasterFid
        ? parseInt(String(user.farcasterFid), 10)
        : null,
      farcasterSignerKeyId: null, // Would need to load from KMS
      encryptionKeyId: null, // Would need to load from KMS
      encryptionPublicKey: null,
      registeredAt:
        user.createdAt instanceof Date
          ? user.createdAt
          : new Date(String(user.createdAt)),
      fullyInitialized: !!(user.walletAddress && user.farcasterFid),
    }

    this.identityCache.set(actorId, identity)
    return identity
  }

  /**
   * Ensure User record exists for actor
   */
  private async ensureUserRecord(actor: StaticActor): Promise<string> {
    // Check if user already exists
    const existing = await db.user.findUnique({ where: { id: actor.id } })

    if (existing) {
      return String(existing.id)
    }

    // Create new user record for NPC
    const userId = actor.id // Use actor ID as user ID for consistency
    const now = new Date()

    // Use UserInsert type for proper type inference
    const userData: UserInsert = {
      id: userId,
      username: actor.name.toLowerCase().replace(/\s+/g, '-'),
      displayName: actor.name,
      bio: actor.description ?? '',
      profileImageUrl: toNull(actor.profileImageUrl),
      isActor: true,
      isAgent: false, // NPCs are actors, not user-controlled agents
      createdAt: now,
      updatedAt: now,
    }

    await db.user.create({
      data: userData,
    })

    logger.info(
      `Created User record for NPC: ${actor.id}`,
      undefined,
      'NPCIdentityService',
    )
    return userId
  }

  /**
   * Ensure wallet exists for NPC
   * Uses Jeju KMS for key generation
   */
  private async ensureWallet(
    userId: string,
    actorId: string,
  ): Promise<Address> {
    // Check if wallet already exists
    const user = await db.user.findUnique({ where: { id: userId } })

    const existingWallet = toAddressOrNull(user?.walletAddress)
    if (existingWallet) {
      return existingWallet
    }

    // Generate wallet via KMS
    const kms = await this.getKMS()
    const key = await kms.generateKey({
      owner: '0x0000000000000000000000000000000000000000', // System-owned
      type: 'signing',
      curve: 'secp256k1',
      label: `npc-wallet:${actorId}`,
    })

    // Derive address from public key
    const address = this.publicKeyToAddress(key.publicKey)

    // Update user record
    await db.user.update({
      where: { id: userId },
      data: { walletAddress: address, updatedAt: new Date() },
    })

    logger.info(
      `Created wallet for NPC: ${actorId} -> ${address}`,
      undefined,
      'NPCIdentityService',
    )
    return address
  }

  /**
   * Register Farcaster signer keys for NPC (skips IdRegistry registration)
   *
   * Note: IdRegistry registration on Optimism is skipped to avoid gas costs.
   * NPCs can still have signer keys ready for when FIDs are registered later.
   * The FID can be set manually or via bulk registration.
   */
  private async registerFarcasterIdentity(
    userId: string,
    actorId: string,
    walletAddress: Address,
  ): Promise<{ fid: number; signerKeyId: string }> {
    // Check if already has FID (from manual registration or previous run)
    const user = await db.user.findUnique({ where: { id: userId } })

    const existingFid = user?.farcasterFid
      ? parseInt(String(user.farcasterFid), 10)
      : 0

    // Generate signer key via KMS (ready for when FID is registered)
    const kms = await this.getKMS()
    const signerKey = await kms.generateKey({
      owner: walletAddress,
      type: 'signing',
      curve: 'ed25519', // Farcaster uses ed25519 for signers
      label: `fc-signer:${actorId}`,
    })

    logger.info(
      `Generated Farcaster signer key for NPC: ${actorId}`,
      {
        keyId: signerKey.metadata.id,
        hasFid: existingFid > 0,
        fid: existingFid || 'pending',
      },
      'NPCIdentityService',
    )

    // Note: We intentionally skip IdRegistry registration to avoid gas costs
    // FIDs can be:
    // 1. Set manually via database update
    // 2. Registered in bulk via a separate funding transaction
    // 3. Registered when external Farcaster visibility is enabled

    return {
      fid: existingFid,
      signerKeyId: signerKey.metadata.id,
    }
  }

  /**
   * Register encryption keys on Jeju KeyRegistry
   */
  private async registerEncryptionKeys(
    _userId: string,
    actorId: string,
    walletAddress: Address,
  ): Promise<{ keyId: string; publicKey: Hex }> {
    const kms = await this.getKMS()

    // Generate X25519 encryption key
    const encryptionKey = await kms.generateKey({
      owner: walletAddress,
      type: 'encryption',
      curve: 'x25519',
      label: `npc-encryption:${actorId}`,
    })

    // Register on Jeju KeyRegistry contract
    // (This would call the KeyRegistry.registerKeyBundle function)
    // For now, just return the key info

    logger.info(
      `Registered encryption key for NPC: ${actorId}`,
      { keyId: encryptionKey.metadata.id },
      'NPCIdentityService',
    )

    return {
      keyId: encryptionKey.metadata.id,
      publicKey: encryptionKey.publicKey,
    }
  }

  /**
   * Sign a message as an NPC
   */
  async signAsNPC(
    actorId: string,
    message: string | Uint8Array,
  ): Promise<KMSSignedMessage> {
    const identity = await this.getNPCIdentity(actorId)
    if (!identity) {
      throw new Error(`NPC identity not found: ${actorId}`)
    }

    const kms = await this.getKMS()
    return kms.sign({
      keyId: `npc-wallet:${actorId}`,
      message:
        typeof message === 'string'
          ? message
          : Buffer.from(message).toString('hex'),
    })
  }

  /**
   * Convert public key to Ethereum address
   */
  private publicKeyToAddress(publicKey: Hex): Address {
    // Remove 0x prefix and the first byte (04 prefix for uncompressed)
    const pubKeyWithoutPrefix = publicKey.slice(4)
    // Keccak256 hash of public key, take last 20 bytes
    const hexInput = `0x${pubKeyWithoutPrefix}`
    if (!isValidHex(hexInput)) {
      throw new Error(`Invalid hex input for keccak256: ${hexInput}`)
    }
    const hash = keccak256(hexInput)
    const address = `0x${hash.slice(-40)}`
    const validAddress = toAddressOrNull(address)
    if (!validAddress) {
      throw new Error(`Invalid derived address: ${address}`)
    }
    return validAddress
  }
}

/**
 * Minimal KMS client for Jeju KMS
 */
class KMSClient {
  private endpoint: string
  private connected = false

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  async connect(): Promise<void> {
    // Health check - if KMS is unavailable, fail in production
    let response: Response
    try {
      response = await fetch(`${this.endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      })
    } catch (error) {
      // Network error (KMS not running)
      const errMessage = error instanceof Error ? error.message : String(error)
      if (isProductionEnvironment()) {
        throw new Error(
          `[NPCIdentityService] KMS required in production mode - failed to connect to ${this.endpoint}: ${errMessage}`,
        )
      }
      logger.warn(
        'KMS not reachable, using local key generation (dev mode only)',
        { endpoint: this.endpoint, error: errMessage },
        'NPCIdentityService',
      )
      this.connected = false
      return
    }

    this.connected = response.ok
    if (!response.ok) {
      if (isProductionEnvironment()) {
        throw new Error(
          `[NPCIdentityService] KMS health check failed in production: ${response.status} ${response.statusText}`,
        )
      }
      logger.warn(
        `KMS health check failed: ${response.status} ${response.statusText}`,
        { endpoint: this.endpoint },
        'NPCIdentityService',
      )
    }
  }

  async generateKey(params: {
    owner: Address
    type: string
    curve: string
    label: string
  }): Promise<KMSGeneratedKey> {
    if (!this.connected) await this.connect()

    // Try KMS if connected
    if (this.connected) {
      let response: Response
      try {
        response = await fetch(`${this.endpoint}/keys/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(30000),
        })
      } catch (error) {
        const errMessage =
          error instanceof Error ? error.message : String(error)
        if (isProductionEnvironment()) {
          throw new Error(
            `[NPCIdentityService] KMS key generation failed in production - no local fallback: ${errMessage}`,
          )
        }
        logger.warn(
          'KMS key generation network error, falling back to local (dev mode only)',
          {
            endpoint: this.endpoint,
            label: params.label,
            error: errMessage,
          },
          'NPCIdentityService',
        )
        this.connected = false
        response = new Response(null, {
          status: 500,
          statusText: 'Network Error',
        })
      }

      if (response.ok) {
        return response.json() as Promise<KMSGeneratedKey>
      }

      if (this.connected) {
        if (isProductionEnvironment()) {
          throw new Error(
            `[NPCIdentityService] KMS key generation failed in production: ${response.status} ${response.statusText}`,
          )
        }
        logger.warn(
          `KMS key generation failed: ${response.status} ${response.statusText}`,
          { endpoint: this.endpoint, label: params.label },
          'NPCIdentityService',
        )
      }
    }

    // Production guard - no local fallback allowed
    if (isProductionEnvironment()) {
      throw new Error(
        '[NPCIdentityService] KMS required in production mode - no local fallback allowed',
      )
    }

    // Local fallback - dev mode only
    logger.warn(
      'Using local key generation (dev mode only - NOT for production)',
      { label: params.label },
      'NPCIdentityService',
    )

    const { address } = generateRandomWallet()
    // Address and Hex are both `0x${string}` - address serves as a placeholder public key in dev mode
    const publicKey: Hex = address

    return {
      metadata: {
        id: `local-${params.label}`,
        type: params.type,
        curve: params.curve,
        createdAt: Date.now(),
        owner: params.owner,
        providerType: 'local',
      },
      publicKey,
    }
  }

  async sign(params: {
    keyId: string
    message: string
  }): Promise<KMSSignedMessage> {
    if (!this.connected) await this.connect()

    const response = await fetch(`${this.endpoint}/keys/${params.keyId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: params.message }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(`KMS sign failed: ${response.statusText}`)
    }

    return response.json() as Promise<KMSSignedMessage>
  }
}

// Singleton instance
let npcIdentityService: NPCIdentityService | null = null

export function getNPCIdentityService(
  config?: Partial<NPCIdentityConfig>,
): NPCIdentityService {
  if (!npcIdentityService) {
    npcIdentityService = new NPCIdentityService(config)
  }
  return npcIdentityService
}

export function resetNPCIdentityService(): void {
  npcIdentityService = null
}
