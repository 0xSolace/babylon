/**
 * OAuth Module
 *
 * PKCE-based OAuth implementations for social login.
 * All OAuth flows are user-side (decentralized).
 *
 * Includes:
 * - SIWE (Sign-In with Ethereum) - EIP-4361
 * - SIWF (Sign-In with Farcaster)
 * - OAuth2 with PKCE (Twitter, Discord)
 */

// Import SIWF internals for use in classes below
import {
  createSIWFMessage as createSIWFMessageInternal,
  type SIWFConfig as SIWFConfigInternal,
  type SIWFMessage as SIWFMessageInternal,
  verifySIWF as verifySIWFInternal,
} from './siwf'

// PKCE utilities
export { generatePKCE, PKCEUtils } from './pkce'

// SIWE (Sign-In with Ethereum)
export {
  createSIWEMessage,
  SIWE,
  type SIWEConfig,
  type SIWEMessage,
  type SIWEVerificationResult,
  verifySIWE,
} from './siwe'

// SIWF (Sign-In with Farcaster)
export {
  createSIWFMessage,
  type SIWFConfig,
  type SIWFMessage,
  verifySIWF,
} from './siwf'
// Types
export type {
  OAuthCallbackResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
  PKCEParams,
} from './types'

// Farcaster types (used by main index.ts)
export interface FarcasterAuthConfig {
  neynarApiKey?: string
  hubUrl?: string
}

export interface FarcasterSignInRequest {
  message: string
  nonce: string
  domain: string
  expiresAt: number
}

export interface FarcasterSignInResult {
  success: boolean
  fid?: number
  username?: string
  displayName?: string
  pfpUrl?: string
  bio?: string
  custodyAddress?: string
  error?: string
}

// Stub types for planned OAuth providers (Twitter, Discord)
// These will be implemented using @jejunetwork/auth providers

export interface TwitterOAuthConfig {
  clientId: string
  redirectUri: string
}

export interface DiscordOAuthConfig {
  clientId: string
  redirectUri: string
}

/**
 * Twitter OAuth provider
 * Uses PKCE flow for secure authentication
 */
export class TwitterOAuth {
  constructor(private config: TwitterOAuthConfig) {}

  async getAuthorizationUrl(
    state: string,
    codeChallenge: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'tweet.read users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  }
}

/**
 * Discord OAuth provider
 * Uses PKCE flow for secure authentication
 */
export class DiscordOAuth {
  constructor(private config: DiscordOAuthConfig) {}

  async getAuthorizationUrl(
    state: string,
    codeChallenge: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'identify email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`
  }
}

// Provider aliases for backwards compatibility
export const TwitterProvider = TwitterOAuth
export const DiscordProvider = DiscordOAuth

/**
 * Farcaster Auth helper class
 * Wraps FarcasterProvider from @jejunetwork/auth
 */
export class FarcasterAuth {
  private config: FarcasterAuthConfig

  constructor(config: FarcasterAuthConfig = {}) {
    this.config = config
  }

  /**
   * Create a sign-in request
   */
  createSignInRequest(
    domain: string,
    expiresInSeconds = 300,
  ): FarcasterSignInRequest {
    return createSIWFMessageInternal(domain, expiresInSeconds)
  }

  /**
   * Verify a sign-in response
   */
  async verifySignIn(
    request: FarcasterSignInRequest,
    signature: `0x${string}`,
    fid: number,
  ): Promise<FarcasterSignInResult> {
    try {
      const profile = await verifySIWFInternal(
        request,
        signature,
        fid,
        this.config.neynarApiKey,
      )
      return {
        success: true,
        fid: profile.fid,
        username: profile.username,
        displayName: profile.displayName,
        pfpUrl: profile.pfpUrl,
        bio: profile.bio,
        custodyAddress: profile.custodyAddress,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      }
    }
  }
}

// Instance for convenience
export const farcasterProvider = new FarcasterAuth()

// SIWF verification result type (for compatibility)
export interface SIWFVerificationResult {
  valid: boolean
  fid?: number
  username?: string
  displayName?: string
  error?: string
}

/**
 * Alternative SIWF class (mirrors SIWE API)
 */
export class SIWF {
  private config: SIWFConfigInternal

  constructor(config: SIWFConfigInternal = {}) {
    this.config = config
  }

  createMessage(domain: string, expiresInSeconds = 300): SIWFMessageInternal {
    return createSIWFMessageInternal(domain, expiresInSeconds)
  }

  async verify(
    request: SIWFMessageInternal,
    signature: `0x${string}`,
    fid: number,
  ): Promise<SIWFVerificationResult> {
    try {
      const profile = await verifySIWFInternal(
        request,
        signature,
        fid,
        this.config.neynarApiKey,
      )
      return {
        valid: true,
        fid: profile.fid,
        username: profile.username,
        displayName: profile.displayName,
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      }
    }
  }
}
