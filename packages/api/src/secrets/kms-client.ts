/**
 * Jeju KMS Client
 *
 * ALL secrets are stored in Jeju KMS (Key Management System).
 * NO FALLBACKS - Environment variables are only for bootstrapping.
 *
 * Features:
 * - MPC threshold key sharing
 * - TEE hardware enclaves
 * - Policy-based encryption/decryption
 * - Secret versioning and rotation
 */

import { logger } from '@babylon/shared'
import type { Hex } from 'viem'

// ============================================================================
// Types
// ============================================================================

export interface KMSConfig {
  serviceUrl: string
  namespace: string
  privateKey?: Hex
}

export interface Secret {
  id: string
  name: string
  version: number
  encryptedValue: Hex
  metadata: Record<string, string>
  createdAt: number
  expiresAt: number | null
  policy: SecretPolicy
}

export interface SecretPolicy {
  conditions: PolicyCondition[]
  operator: 'and' | 'or'
}

export interface PolicyCondition {
  type: 'timestamp' | 'address' | 'signature' | 'tee'
  value: string | number
}

export interface EncryptRequest {
  data: string
  name?: string
  policy?: SecretPolicy
  metadata?: Record<string, string>
  expiresIn?: number
}

export interface EncryptResult {
  id: string
  encryptedPayload: Hex
  version: number
}

export interface DecryptRequest {
  payload: Hex
  proof?: Hex
}

export interface SignRequest {
  message: Hex
  keyId?: string
}

export interface SignResult {
  signature: Hex
  publicKey: Hex
}

// ============================================================================
// KMS Client
// ============================================================================

class KMSClient {
  private config: KMSConfig
  private initialized = false
  private accessToken: string | null = null

  constructor() {
    const serviceUrl = process.env.JEJU_KMS_SERVICE_URL
    if (!serviceUrl) {
      throw new Error(
        '[KMS] JEJU_KMS_SERVICE_URL is required. ' +
          'Decentralized KMS is mandatory - no env var fallback for secrets.',
      )
    }

    this.config = {
      serviceUrl,
      namespace: process.env.KMS_NAMESPACE ?? 'babylon',
      privateKey: process.env.KMS_PRIVATE_KEY as Hex | undefined,
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const healthy = await this.healthCheck()
    if (!healthy) {
      throw new Error(
        `[KMS] KMS service at ${this.config.serviceUrl} is not healthy. ` +
          'Start Jeju services: cd /path/to/jeju && bun run dev',
      )
    }

    // Authenticate with KMS
    if (this.config.privateKey) {
      await this.authenticate()
    }

    logger.info(
      '[KMS] Connected to Jeju KMS',
      { url: this.config.serviceUrl },
      'KMS',
    )
    this.initialized = true
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error('[KMS] Client not initialized. Call initialize() first.')
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`
    }
    return headers
  }

  // ============================================================================
  // Health & Auth
  // ============================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serviceUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.config.serviceUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namespace: this.config.namespace,
        private_key: this.config.privateKey,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `[KMS] Authentication failed (${response.status}): ${text}`,
      )
    }

    const data = (await response.json()) as { access_token: string }
    this.accessToken = data.access_token
  }

  // ============================================================================
  // Secret Management
  // ============================================================================

  async encrypt(request: EncryptRequest): Promise<EncryptResult> {
    this.requireInitialized()

    const response = await fetch(`${this.config.serviceUrl}/encrypt`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        data: request.data,
        name: request.name,
        policy: request.policy ?? {
          conditions: [{ type: 'timestamp', value: 0 }],
          operator: 'and',
        },
        metadata: request.metadata,
        expires_in: request.expiresIn,
        namespace: this.config.namespace,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Encrypt failed (${response.status}): ${text}`)
    }

    return response.json() as Promise<EncryptResult>
  }

  async decrypt(request: DecryptRequest): Promise<string> {
    this.requireInitialized()

    const response = await fetch(`${this.config.serviceUrl}/decrypt`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        payload: request.payload,
        proof: request.proof,
        namespace: this.config.namespace,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Decrypt failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as { data: string }
    return data.data
  }

  async storeSecret(
    name: string,
    value: string,
    options: {
      policy?: SecretPolicy
      metadata?: Record<string, string>
      expiresIn?: number
    } = {},
  ): Promise<Secret> {
    this.requireInitialized()

    const response = await fetch(`${this.config.serviceUrl}/secrets`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name,
        value,
        policy: options.policy,
        metadata: options.metadata,
        expires_in: options.expiresIn,
        namespace: this.config.namespace,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Store secret failed (${response.status}): ${text}`)
    }

    return response.json() as Promise<Secret>
  }

  async getSecret(name: string, version?: number): Promise<string> {
    this.requireInitialized()

    const params = new URLSearchParams({ namespace: this.config.namespace })
    if (version !== undefined) params.set('version', String(version))

    const response = await fetch(
      `${this.config.serviceUrl}/secrets/${encodeURIComponent(name)}?${params}`,
      {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Get secret failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as { value: string }
    return data.value
  }

  async deleteSecret(name: string): Promise<void> {
    this.requireInitialized()

    const response = await fetch(
      `${this.config.serviceUrl}/secrets/${encodeURIComponent(name)}?namespace=${encodeURIComponent(this.config.namespace)}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok && response.status !== 404) {
      const text = await response.text()
      throw new Error(
        `[KMS] Delete secret failed (${response.status}): ${text}`,
      )
    }
  }

  async listSecrets(): Promise<Secret[]> {
    this.requireInitialized()

    const response = await fetch(
      `${this.config.serviceUrl}/secrets?namespace=${encodeURIComponent(this.config.namespace)}`,
      {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] List secrets failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as { secrets: Secret[] }
    return data.secrets
  }

  async rotateSecret(name: string, newValue: string): Promise<Secret> {
    this.requireInitialized()

    const response = await fetch(
      `${this.config.serviceUrl}/secrets/${encodeURIComponent(name)}/rotate`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          value: newValue,
          namespace: this.config.namespace,
        }),
        signal: AbortSignal.timeout(30000),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `[KMS] Rotate secret failed (${response.status}): ${text}`,
      )
    }

    return response.json() as Promise<Secret>
  }

  // ============================================================================
  // Signing
  // ============================================================================

  async sign(request: SignRequest): Promise<SignResult> {
    this.requireInitialized()

    const response = await fetch(`${this.config.serviceUrl}/sign`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        message: request.message,
        key_id: request.keyId,
        namespace: this.config.namespace,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Sign failed (${response.status}): ${text}`)
    }

    return response.json() as Promise<SignResult>
  }

  async verify(message: Hex, signature: Hex, publicKey: Hex): Promise<boolean> {
    this.requireInitialized()

    const response = await fetch(`${this.config.serviceUrl}/verify`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ message, signature, public_key: publicKey }),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Verify failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as { valid: boolean }
    return data.valid
  }

  // ============================================================================
  // Key Management
  // ============================================================================

  async generateKey(
    name: string,
    keyType: 'secp256k1' | 'ed25519' = 'secp256k1',
  ): Promise<{ keyId: string; publicKey: Hex }> {
    this.requireInitialized()

    const response = await fetch(`${this.config.serviceUrl}/keys`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name,
        key_type: keyType,
        namespace: this.config.namespace,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`[KMS] Generate key failed (${response.status}): ${text}`)
    }

    return response.json() as Promise<{ keyId: string; publicKey: Hex }>
  }

  async getPublicKey(keyId: string): Promise<Hex> {
    this.requireInitialized()

    const response = await fetch(
      `${this.config.serviceUrl}/keys/${encodeURIComponent(keyId)}/public?namespace=${encodeURIComponent(this.config.namespace)}`,
      {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `[KMS] Get public key failed (${response.status}): ${text}`,
      )
    }

    const data = (await response.json()) as { publicKey: Hex }
    return data.publicKey
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let kmsClient: KMSClient | null = null

export function getKMSClient(): KMSClient {
  if (!kmsClient) {
    kmsClient = new KMSClient()
  }
  return kmsClient
}

export async function initializeKMS(): Promise<KMSClient> {
  const client = getKMSClient()
  await client.initialize()
  return client
}

export function resetKMSClient(): void {
  kmsClient = null
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function getSecretValue(name: string): Promise<string> {
  const client = getKMSClient()
  if (!client.isInitialized()) await client.initialize()
  return client.getSecret(name)
}

export async function setSecretValue(
  name: string,
  value: string,
): Promise<void> {
  const client = getKMSClient()
  if (!client.isInitialized()) await client.initialize()
  await client.storeSecret(name, value)
}

export { KMSClient }
