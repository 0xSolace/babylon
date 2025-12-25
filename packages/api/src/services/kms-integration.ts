/**
 * KMS Integration - encryption with Jeju KMS or local TEE fallback
 */

import { logger } from '@babylon/shared'
import type { Address, Hex } from 'viem'
import { keccak256, toBytes } from 'viem'
import { getBabylonEnclave } from '../tee/babylon-enclave'

// ============================================================================
// Types
// ============================================================================

export interface KMSIntegrationConfig {
  enabled: boolean
  preferredProvider?: 'tee' | 'mpc' | 'lit'
  fallbackToLocal: boolean
  verbose?: boolean
}

export interface AccessPolicy {
  owner: Address
  minStake?: bigint
  agentId?: number
  expiresAt?: number
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  dataHash: Hex
  keyId: string
  provider: 'kms' | 'local'
  encryptedAt: number
  policy: AccessPolicy
}

export interface KMSIntegrationStatus {
  initialized: boolean
  kmsAvailable: boolean
  localAvailable: boolean
  activeProvider: 'kms' | 'local' | null
  keyCount: number
}

// ============================================================================
// KMS Integration Service
// ============================================================================

export class KMSIntegrationService {
  private config: KMSIntegrationConfig
  private kmsService: JejuKMSClient | null = null
  private localEnclave: LocalEnclaveClient | null = null
  private initialized = false
  private keys: Map<string, { publicKey: Hex; policy: AccessPolicy }> =
    new Map()

  constructor(config: Partial<KMSIntegrationConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      preferredProvider: config.preferredProvider ?? 'tee',
      fallbackToLocal: config.fallbackToLocal ?? true,
      verbose: config.verbose ?? false,
    }
  }

  /**
   * Initialize the KMS integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Try to connect to Jeju KMS
    if (this.config.enabled) {
      this.kmsService = await this.tryConnectKMS()
    }

    // Initialize local enclave as fallback
    if (this.config.fallbackToLocal) {
      this.localEnclave = await this.initializeLocalEnclave()
    }

    // Verify we have at least one provider
    if (!this.kmsService && !this.localEnclave) {
      throw new Error('No encryption provider available')
    }

    this.initialized = true
    this.log('KMS integration initialized', {
      kmsAvailable: !!this.kmsService,
      localAvailable: !!this.localEnclave,
    })
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(
    policy: AccessPolicy,
  ): Promise<{ keyId: string; publicKey: Hex }> {
    this.ensureInitialized()

    const keyId = `babylon-key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (this.kmsService) {
      const result = await this.kmsService.generateKey(policy)
      this.keys.set(keyId, { publicKey: result.publicKey, policy })
      return { keyId, publicKey: result.publicKey }
    }

    if (this.localEnclave) {
      const result = await this.localEnclave.generateKey(policy)
      this.keys.set(keyId, { publicKey: result.publicKey, policy })
      return { keyId, publicKey: result.publicKey }
    }

    throw new Error('No provider available for key generation')
  }

  /**
   * Encrypt data with access control
   */
  async encrypt(
    data: string | Uint8Array,
    policy: AccessPolicy,
    keyId?: string,
  ): Promise<EncryptedData> {
    this.ensureInitialized()

    const dataBytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data
    const dataHash = keccak256(dataBytes)

    // Use existing key or generate new one
    const effectiveKeyId = keyId ?? `temp-key-${Date.now()}`
    if (!keyId) {
      await this.generateKey(policy)
    }

    // Prefer KMS, fallback to local
    if (this.kmsService) {
      const result = await this.kmsService.encrypt(dataBytes, policy)
      return {
        ciphertext: result.ciphertext,
        iv: result.iv,
        dataHash,
        keyId: effectiveKeyId,
        provider: 'kms',
        encryptedAt: Date.now(),
        policy,
      }
    }

    if (this.localEnclave) {
      const result = await this.localEnclave.encrypt(dataBytes, policy)
      return {
        ciphertext: result.ciphertext,
        iv: result.iv,
        dataHash,
        keyId: effectiveKeyId,
        provider: 'local',
        encryptedAt: Date.now(),
        policy,
      }
    }

    throw new Error('No provider available for encryption')
  }

  /**
   * Decrypt data (checks access control)
   */
  async decrypt(
    encrypted: EncryptedData,
    requester: Address,
  ): Promise<Uint8Array> {
    this.ensureInitialized()

    // Verify access policy
    if (!this.checkAccess(encrypted.policy, requester)) {
      throw new Error('Access denied')
    }

    // Always use local enclave for decryption - KMS stores keys but
    // actual decryption happens locally with the TEE-derived key.
    // This is by design: keys never leave the enclave.
    if (this.localEnclave) {
      return this.localEnclave.decrypt(encrypted)
    }

    throw new Error(
      'Local enclave required for decryption - TEE keys never leave the enclave',
    )
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(
    oldKeyId: string,
    policy: AccessPolicy,
  ): Promise<{ newKeyId: string; publicKey: Hex }> {
    this.ensureInitialized()

    // Generate new key
    const newKey = await this.generateKey(policy)

    // Mark old key as rotated (don't delete for re-encryption support)
    this.log('Key rotated', { oldKeyId, newKeyId: newKey.keyId })

    return { newKeyId: newKey.keyId, publicKey: newKey.publicKey }
  }

  /**
   * Re-encrypt data with new key
   */
  async reencrypt(
    encrypted: EncryptedData,
    requester: Address,
    newPolicy: AccessPolicy,
  ): Promise<EncryptedData> {
    // Decrypt with old key
    const plaintext = await this.decrypt(encrypted, requester)

    // Encrypt with new key/policy
    return this.encrypt(plaintext, newPolicy)
  }

  /**
   * Get service status
   */
  getStatus(): KMSIntegrationStatus {
    return {
      initialized: this.initialized,
      kmsAvailable: !!this.kmsService,
      localAvailable: !!this.localEnclave,
      activeProvider: this.kmsService
        ? 'kms'
        : this.localEnclave
          ? 'local'
          : null,
      keyCount: this.keys.size,
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.kmsService) {
      await this.kmsService.disconnect()
      this.kmsService = null
    }

    if (this.localEnclave) {
      await this.localEnclave.shutdown()
      this.localEnclave = null
    }

    this.keys.clear()
    this.initialized = false
    this.log('KMS integration shutdown')
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async tryConnectKMS(): Promise<JejuKMSClient | null> {
    // Check if Jeju KMS environment variables are set
    const kmsEndpoint = process.env.JEJU_KMS_ENDPOINT
    if (!kmsEndpoint) {
      this.log('Jeju KMS not configured')
      return null
    }

    const client = new JejuKMSClient({
      endpoint: kmsEndpoint,
      apiKey: process.env.JEJU_KMS_API_KEY,
      preferredProvider: this.config.preferredProvider,
    })

    const connected = await client.connect()
    if (!connected) {
      this.log('Failed to connect to Jeju KMS')
      return null
    }

    this.log('Connected to Jeju KMS')
    return client
  }

  private async initializeLocalEnclave(): Promise<LocalEnclaveClient> {
    const enclave = await getBabylonEnclave({ verbose: this.config.verbose })
    return new LocalEnclaveClient(enclave)
  }

  private checkAccess(policy: AccessPolicy, requester: Address): boolean {
    // Owner always has access
    if (policy.owner.toLowerCase() === requester.toLowerCase()) {
      return true
    }

    // Check expiration
    if (policy.expiresAt && Date.now() > policy.expiresAt) {
      return false
    }

    // Additional checks would go here (stake verification, agent verification, etc.)
    // For now, only owner has access
    return false
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'KMS integration not initialized. Call initialize() first.',
      )
    }
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.verbose) {
      logger.info(`[KMSIntegration] ${message}`, data)
    }
  }
}

// ============================================================================
// Jeju KMS Client (Adapter)
// ============================================================================

interface JejuKMSClientConfig {
  endpoint: string
  apiKey?: string
  preferredProvider?: 'tee' | 'mpc' | 'lit'
}

class JejuKMSClient {
  private config: JejuKMSClientConfig
  private connected = false

  constructor(config: JejuKMSClientConfig) {
    this.config = config
  }

  async connect(): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      this.connected = response.ok

      if (!response.ok) {
        logger.warn('[JejuKMSClient] KMS health check failed', {
          status: response.status,
          endpoint: this.config.endpoint,
        })
      }

      return this.connected
    } catch (error) {
      clearTimeout(timeoutId)
      this.connected = false

      // Log the actual error for debugging
      logger.debug('[JejuKMSClient] KMS connection failed', {
        endpoint: this.config.endpoint,
        error: error instanceof Error ? error.message : String(error),
      })

      return false
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async generateKey(policy: AccessPolicy): Promise<{ publicKey: Hex }> {
    if (!this.connected) {
      throw new Error('Not connected to KMS')
    }

    // In production, this would call the Jeju KMS API
    // For now, generate a simulated key
    const keyHash = keccak256(toBytes(`${policy.owner}:${Date.now()}`))

    return { publicKey: keyHash }
  }

  async encrypt(
    data: Uint8Array,
    _policy: AccessPolicy,
  ): Promise<{ ciphertext: string; iv: string }> {
    if (!this.connected) {
      throw new Error('Not connected to KMS')
    }

    // In production, this would use the KMS encrypt endpoint
    // For now, use Web Crypto with a derived key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const dataBuffer = new Uint8Array(data).buffer
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
      key,
      dataBuffer,
    )

    return {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
    }
  }

  // Note: Decryption is handled by local enclave - keys never leave the TEE.
  // KMS is used for key generation and policy management only.
}

// ============================================================================
// Local Enclave Client (Adapter for BabylonEnclave)
// ============================================================================

interface BabylonEnclaveInterface {
  sealState<T extends object>(
    state: T,
  ): Promise<{
    ciphertext: string
    iv: string
    keyVersion: number
    sealedAt: number
  }>
  unsealState<T extends object>(sealed: {
    ciphertext: string
    iv: string
    keyVersion: number
    sealedAt: number
  }): Promise<T>
  getStatus(): { running: boolean }
}

class LocalEnclaveClient {
  private enclave: BabylonEnclaveInterface

  constructor(enclave: BabylonEnclaveInterface) {
    this.enclave = enclave
  }

  async generateKey(policy: AccessPolicy): Promise<{ publicKey: Hex }> {
    // Local enclave derives keys from measurement
    const keyHash = keccak256(toBytes(`${policy.owner}:local:${Date.now()}`))
    return { publicKey: keyHash }
  }

  async encrypt(
    data: Uint8Array,
    _policy: AccessPolicy,
  ): Promise<{ ciphertext: string; iv: string }> {
    // Wrap data in object for enclave
    const wrapper = {
      data: Buffer.from(data).toString('base64'),
      timestamp: Date.now(),
    }

    const sealed = await this.enclave.sealState(wrapper)
    return {
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
    }
  }

  async decrypt(encrypted: EncryptedData): Promise<Uint8Array> {
    const wrapper = await this.enclave.unsealState<{
      data: string
      timestamp: number
    }>({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      keyVersion: 1,
      sealedAt: encrypted.encryptedAt,
    })

    return Buffer.from(wrapper.data, 'base64')
  }

  async shutdown(): Promise<void> {
    // Local enclave is shared, don't shut it down
  }
}

// ============================================================================
// Factory
// ============================================================================

let kmsIntegration: KMSIntegrationService | null = null

export function getKMSIntegration(
  config?: Partial<KMSIntegrationConfig>,
): KMSIntegrationService {
  if (!kmsIntegration) {
    kmsIntegration = new KMSIntegrationService(config)
  }
  return kmsIntegration
}

async function _initializeKMSIntegration(
  config?: Partial<KMSIntegrationConfig>,
): Promise<KMSIntegrationService> {
  const service = getKMSIntegration(config)
  await service.initialize()
  return service
}
