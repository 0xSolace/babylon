/**
 * Browser-safe stubs for server-side Jeju packages
 *
 * The @jejunetwork/oauth3 and @jejunetwork/kms packages include server-side
 * TEE code that uses Node.js APIs like node:fs. These stubs provide
 * browser-compatible implementations that:
 *
 * 1. OAuth Providers: Generate authorization URLs directly in the browser
 * 2. MPC Coordinator: Calls server APIs for key generation and signing
 *
 * This allows the auth provider to work in the browser without bundling
 * server-side code.
 */

import { hasStringProperty, isObject } from '@babylon/shared'
import type { Address, Hex } from 'viem'
import { isAddress, isHex } from '../types/guards'

// =============================================================================
// API Response Type Guards
// These guards are defined for future use to replace `as` casts.
// =============================================================================

interface KeyGenApiResponse {
  keyId: string
  address: Address
  publicKey: Hex
}

function _isKeyGenApiResponse(value: unknown): value is KeyGenApiResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'keyId')) return false
  if (!hasStringProperty(value, 'address') || !isAddress(value.address))
    return false
  if (!hasStringProperty(value, 'publicKey') || !isHex(value.publicKey))
    return false
  return true
}

interface SignApiResponse {
  signature: Hex
  keyId: string
  signedAt: number
}

function _isSignApiResponse(value: unknown): value is SignApiResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'signature') || !isHex(value.signature))
    return false
  if (!hasStringProperty(value, 'keyId')) return false
  return true
}

interface SignatureOnlyResponse {
  signature: Hex
}

function _isSignatureOnlyResponse(
  value: unknown,
): value is SignatureOnlyResponse {
  if (!isObject(value)) return false
  if (!hasStringProperty(value, 'signature') || !isHex(value.signature))
    return false
  return true
}

// Export unused guards to prevent warnings (for future use)
export const _browser_guards_reserved = {
  _isKeyGenApiResponse,
  _isSignApiResponse,
  _isSignatureOnlyResponse,
}

// =============================================================================
// OAuth Provider Stubs
// =============================================================================

interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes?: string[]
}

interface OAuthState {
  state: string
  nonce: string
  provider: 'twitter' | 'discord'
  appId: Hex
  createdAt: number
}

/**
 * Browser-safe Twitter OAuth provider
 */
export class TwitterProvider {
  private config: OAuthConfig

  constructor(config: OAuthConfig) {
    this.config = config
  }

  async getAuthorizationUrlAsync(state: OAuthState): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: (this.config.scopes ?? ['tweet.read', 'users.read']).join(' '),
      state: state.state,
      code_challenge: state.nonce,
      code_challenge_method: 'S256',
    })
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  }
}

/**
 * Browser-safe Discord OAuth provider
 */
export class DiscordProvider {
  private config: OAuthConfig

  constructor(config: OAuthConfig) {
    this.config = config
  }

  getAuthorizationUrl(state: OAuthState): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: (this.config.scopes ?? ['identify', 'email']).join(' '),
      state: state.state,
    })
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`
  }
}

// =============================================================================
// MPC Coordinator Stub
// =============================================================================

interface MPCKey {
  keyId: string
  address: Address
  publicKey: Hex
}

interface GenerateKeyParams {
  keyId: string
  threshold: number
  totalParties: number
  partyIds: string[]
  curve: 'secp256k1'
}

interface SignatureRequest {
  keyId: string
  message: Hex
  messageHash: Hex
  requester: Address
}

interface SignatureSession {
  sessionId: string
  participants: string[]
}

interface PartialSignature {
  partyId: string
  partialR: Hex
  partialS: Hex
  commitment: Hex
}

interface SignatureResult {
  signature: {
    signature: Hex
    v: number
  } | null
}

interface MPCParty {
  id: string
  index: number
  endpoint: string
  publicKey: Hex
  address: Address
  stake: bigint
  registeredAt: number
}

interface MPCCoordinatorConfig {
  network?: 'localnet' | 'testnet' | 'mainnet'
}

/**
 * Browser-safe MPC Coordinator
 *
 * In the browser, MPC operations should be done via server API calls.
 * This stub provides the interface but calls the backend to perform
 * the actual cryptographic operations in a TEE.
 */
export class BrowserMPCCoordinator {
  private keys: Map<string, MPCKey> = new Map()
  private parties: Map<string, MPCParty> = new Map()
  private apiBase: string

  constructor(config: MPCCoordinatorConfig = {}) {
    // Determine API base URL from environment
    const network = config.network ?? 'localnet'
    this.apiBase =
      typeof window !== 'undefined'
        ? window.location.origin
        : network === 'localnet'
          ? 'http://localhost:5008'
          : network === 'testnet'
            ? 'https://api.testnet.babylon.game'
            : 'https://api.babylon.game'
  }

  registerParty(party: MPCParty): void {
    this.parties.set(party.id, party)
  }

  async generateKey(params: GenerateKeyParams): Promise<MPCKey> {
    // Call DWS KMS API to generate key
    const response = await fetch(`${this.apiBase}/kms/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address':
          params.partyIds[0] || '0x0000000000000000000000000000000000000000',
      },
      body: JSON.stringify({
        threshold: params.threshold,
        totalParties: params.totalParties,
        metadata: { keyId: params.keyId },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `MPC key generation failed: ${error}. Ensure DWS is running.`,
      )
    }

    const result = (await response.json()) as {
      keyId: string
      address: Address
      publicKey: Hex
    }
    const key: MPCKey = {
      keyId: result.keyId,
      address: result.address,
      publicKey: result.publicKey,
    }
    this.keys.set(result.keyId, key)
    return key
  }

  getKey(keyId: string): MPCKey | undefined {
    return this.keys.get(keyId)
  }

  async requestSignature(request: SignatureRequest): Promise<SignatureSession> {
    // Call DWS KMS API to initiate signing
    const response = await fetch(`${this.apiBase}/kms/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': request.requester,
      },
      body: JSON.stringify({
        keyId: request.keyId,
        messageHash: request.messageHash,
        encoding: 'hex',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `MPC signature request failed: ${error}. Ensure DWS is running.`,
      )
    }

    const result = (await response.json()) as {
      signature: Hex
      keyId: string
      signedAt: number
    }

    // For browser stubs, we get the signature directly (DWS handles MPC internally)
    return {
      sessionId: `session-${result.signedAt}`,
      participants: ['dws-coordinator'],
    }
  }

  async submitPartialSignature(
    _sessionId: string,
    _partyId: string,
    _partial: PartialSignature,
  ): Promise<SignatureResult> {
    // DWS handles MPC signing internally - no partial submission needed from browser
    // The signature is returned directly from requestSignature via /kms/sign
    throw new Error(
      'Partial signature submission not supported from browser. ' +
        'DWS handles MPC coordination internally.',
    )
  }

  /**
   * Sign a message directly through DWS KMS
   * This is the preferred method for browser clients
   */
  async sign(
    request: SignatureRequest,
  ): Promise<{ signature: Hex; v: number }> {
    const response = await fetch(`${this.apiBase}/kms/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-jeju-address': request.requester,
      },
      body: JSON.stringify({
        keyId: request.keyId,
        messageHash: request.messageHash,
        encoding: 'hex',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MPC signing failed: ${error}. Ensure DWS is running.`)
    }

    const result = (await response.json()) as { signature: Hex }
    // Parse v from the signature (last byte)
    const sigHex = result.signature.slice(2)
    const v = parseInt(sigHex.slice(-2), 16)

    return {
      signature: result.signature,
      v,
    }
  }
}

// Singleton instance
let mpcCoordinator: BrowserMPCCoordinator | null = null

export function getMPCCoordinator(
  config?: MPCCoordinatorConfig,
): BrowserMPCCoordinator {
  if (!mpcCoordinator) {
    mpcCoordinator = new BrowserMPCCoordinator(config)
  }
  return mpcCoordinator
}
