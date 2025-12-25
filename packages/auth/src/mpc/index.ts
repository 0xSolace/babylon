/**
 * MPC Network Client
 *
 * Provides threshold signing, key generation, and coordinator access.
 */

import type { JsonValue } from '@babylon/shared'
import { hasStringProperty, isHexAddress, isObject } from '@babylon/shared'
import type { Hex } from 'viem'
import { keccak256, toHex } from 'viem'
import { isHex } from '../types/guards'

// ============================================================================
// API Response Type Guards
// These guards are defined for future use to replace `as` casts.
// Currently marked with _ prefix to indicate intentional non-use.
// ============================================================================

export interface KeyIdResponse {
  keyId: string
}

export function isKeyIdResponse(value: unknown): value is KeyIdResponse {
  return isObject(value) && hasStringProperty(value, 'keyId')
}

export interface SignResponse {
  signature: Hex
  mode: 'mpc' | 'development'
}

export function isSignResponse(value: unknown): value is SignResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'signature')) return false
  if (!isHex(value.signature)) return false
  return true
}

export interface KeyGenResponse {
  keyId: string
  publicKey: Hex
}

export function isKeyGenResponse(value: unknown): value is KeyGenResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'keyId')) return false
  if (!hasStringProperty(value, 'publicKey')) return false
  if (!isHex(value.publicKey)) return false
  return true
}

export interface KeyRotationResponse {
  newKeyId: string
}

export function isKeyRotationResponse(
  value: unknown,
): value is KeyRotationResponse {
  return isObject(value) && hasStringProperty(value, 'newKeyId')
}

export interface MPCSignatureResponse {
  signature: Hex
  recoveryId: number
  participants: string[]
}

export function isMPCSignatureResponse(
  value: unknown,
): value is MPCSignatureResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'signature')) return false
  if (!isHex(value.signature)) return false
  return true
}

// ============================================================================
// Types
// ============================================================================

export interface ThresholdSignerConfig {
  endpoints: string[]
  networkId: string
  threshold: number
  timeout: number
  devMode?: boolean
}

export interface SignResult {
  signature: Hex
  participants: string[]
}

// MPC Coordinator types
export interface MPCCoordinatorConfig {
  endpoints: string[]
  networkId: string
  threshold: number
  timeout: number
  devMode?: boolean
}

export interface MPCParty {
  id: string
  endpoint: string
  publicKey: Hex
}

export interface MPCKeyGenParams {
  userId: string
  threshold: number
  parties: MPCParty[]
}

export interface MPCKeyGenResult {
  success: boolean
  publicKey?: Hex
  keyId?: string
  error?: string
}

export interface MPCSignRequest {
  keyId: string
  messageHash: Hex
  parties?: string[]
}

export interface MPCSignSession {
  sessionId: string
  status: 'pending' | 'signing' | 'complete' | 'failed'
  participants: string[]
}

export interface MPCSignatureResult {
  signature: Hex
  recoveryId: number
  participants: string[]
}

export interface KeyVersion {
  version: number
  keyId: string
  createdAt: Date
  status: 'active' | 'rotating' | 'deprecated'
}

export interface KeyRotationParams {
  keyId: string
  newThreshold?: number
  reason?: string
}

export interface KeyRotationResult {
  success: boolean
  newKeyId?: string
  oldKeyId?: string
  error?: string
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_MPC_CONFIG: MPCCoordinatorConfig = {
  endpoints: ['http://localhost:4200'],
  networkId: 'babylon-local',
  threshold: 2,
  timeout: 30000,
  devMode: true,
}

// ============================================================================
// ThresholdSigner Class
// ============================================================================

/**
 * Threshold Signer for MPC-based message signing.
 *
 * Connects to DWS KMS for actual MPC signing.
 */
export class ThresholdSigner {
  private readonly userId: `0x${string}`
  private readonly config: ThresholdSignerConfig
  private initialized = false
  private keyId: string | null = null

  constructor(userId: string, config: ThresholdSignerConfig) {
    if (!isHexAddress(userId)) {
      throw new Error(
        `Invalid userId format: ${userId}. Must be a hex address.`,
      )
    }
    this.userId = userId
    this.config = config
  }

  /**
   * Initialize the signer by connecting to DWS and creating/retrieving an MPC key
   */
  async initialize(): Promise<void> {
    const endpoint = this.config.endpoints[0]
    if (!endpoint) {
      throw new Error('No MPC endpoint configured')
    }

    // Create or get existing key for this user
    const response = await fetch(`${endpoint}/kms/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': this.userId as `0x${string}`,
      },
      body: JSON.stringify({
        threshold: this.config.threshold,
        totalParties: this.config.threshold + 2,
        metadata: { userId: this.userId },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `Failed to initialize MPC key: ${error}. Ensure DWS is running at ${endpoint}`,
      )
    }

    const result = (await response.json()) as { keyId: string }
    this.keyId = result.keyId
    this.initialized = true
  }

  /**
   * Sign a message using threshold signatures via DWS KMS
   */
  async signMessage(message: string): Promise<SignResult> {
    if (!this.initialized || !this.keyId) {
      throw new Error(
        'ThresholdSigner not initialized. Call initialize() first.',
      )
    }

    const endpoint = this.config.endpoints[0]
    const messageHash = keccak256(toHex(new TextEncoder().encode(message)))

    const response = await fetch(`${endpoint}/kms/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': this.userId as `0x${string}`,
      },
      body: JSON.stringify({
        keyId: this.keyId,
        messageHash,
        encoding: 'hex',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MPC signing failed: ${error}`)
    }

    const result = (await response.json()) as {
      signature: Hex
      mode: 'mpc' | 'development'
    }

    return {
      signature: result.signature,
      participants: result.mode === 'mpc' ? ['mpc-cluster'] : ['dws-local'],
    }
  }

  /**
   * Sign typed data (EIP-712) via DWS KMS
   */
  async signTypedData(
    typedData: Record<string, JsonValue>,
  ): Promise<SignResult> {
    const message = JSON.stringify(typedData)
    return this.signMessage(message)
  }

  /**
   * Get the signer's user ID
   */
  getUserId(): string {
    return this.userId
  }

  /**
   * Check if the signer is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get the MPC key ID (after initialization)
   */
  getKeyId(): string | null {
    return this.keyId
  }
}

// ============================================================================
// MPCCoordinator Class
// ============================================================================

/**
 * MPC Coordinator manages threshold key operations.
 *
 * Uses DWS KMS service for key management and signing coordination.
 */
export class MPCCoordinator {
  private config: MPCCoordinatorConfig
  private initialized = false

  constructor(config: MPCCoordinatorConfig = DEFAULT_MPC_CONFIG) {
    this.config = config
  }

  /**
   * Initialize the coordinator
   */
  async initialize(): Promise<void> {
    const endpoint = this.config.endpoints[0]
    if (!endpoint) {
      throw new Error('No MPC endpoint configured')
    }

    // Check if KMS service is healthy
    const response = await fetch(`${endpoint}/health`)
    if (!response.ok) {
      throw new Error(`MPC coordinator not healthy at ${endpoint}`)
    }

    this.initialized = true
  }

  /**
   * Generate a new threshold key
   */
  async generateKey(params: MPCKeyGenParams): Promise<MPCKeyGenResult> {
    if (!this.initialized) {
      throw new Error('Coordinator not initialized')
    }

    const endpoint = this.config.endpoints[0]
    const response = await fetch(`${endpoint}/kms/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        threshold: params.threshold,
        parties: params.parties,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    const result = (await response.json()) as { keyId: string; publicKey: Hex }
    return {
      success: true,
      keyId: result.keyId,
      publicKey: result.publicKey,
    }
  }

  /**
   * Request a signature
   */
  async requestSignature(request: MPCSignRequest): Promise<MPCSignatureResult> {
    if (!this.initialized) {
      throw new Error('Coordinator not initialized')
    }

    const endpoint = this.config.endpoints[0]
    const response = await fetch(`${endpoint}/kms/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Signing failed: ${error}`)
    }

    return (await response.json()) as MPCSignatureResult
  }

  /**
   * Rotate a key
   */
  async rotateKey(params: KeyRotationParams): Promise<KeyRotationResult> {
    if (!this.initialized) {
      throw new Error('Coordinator not initialized')
    }

    const endpoint = this.config.endpoints[0]
    const response = await fetch(
      `${endpoint}/kms/keys/${params.keyId}/rotate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newThreshold: params.newThreshold,
          reason: params.reason,
        }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error, oldKeyId: params.keyId }
    }

    const result = (await response.json()) as { newKeyId: string }
    return {
      success: true,
      newKeyId: result.newKeyId,
      oldKeyId: params.keyId,
    }
  }

  /**
   * Get key versions
   */
  async getKeyVersions(keyId: string): Promise<KeyVersion[]> {
    if (!this.initialized) {
      throw new Error('Coordinator not initialized')
    }

    const endpoint = this.config.endpoints[0]
    const response = await fetch(`${endpoint}/kms/keys/${keyId}/versions`)

    if (!response.ok) {
      return []
    }

    return (await response.json()) as KeyVersion[]
  }

  /**
   * Check if coordinator is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let coordinatorInstance: MPCCoordinator | null = null

/**
 * Get the MPC coordinator instance
 */
export function getMPCCoordinator(
  config: MPCCoordinatorConfig = DEFAULT_MPC_CONFIG,
): MPCCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new MPCCoordinator(config)
  }
  return coordinatorInstance
}

/**
 * Reset the MPC coordinator (for testing)
 */
export function resetMPCCoordinator(): void {
  coordinatorInstance = null
}

/**
 * Get MPC config from environment or defaults
 */
export function getMPCConfig(): MPCCoordinatorConfig {
  const endpoint = process.env.JEJU_KMS_SERVICE_URL || 'http://localhost:4200'
  const networkId = process.env.JEJU_NETWORK || 'localnet'
  const devMode = process.env.NODE_ENV !== 'production'

  return {
    endpoints: [endpoint],
    networkId,
    threshold: 2,
    timeout: 30000,
    devMode,
  }
}
