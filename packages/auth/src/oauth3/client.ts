/**
 * OAuth3 Client for Babylon
 *
 * Decentralized authentication using Jeju's OAuth3 protocol.
 * Replaces Privy with TEE-backed MPC authentication.
 *
 * Features:
 * - Multi-provider auth (Farcaster, Google, Twitter, GitHub, Discord, Wallet)
 * - TEE-backed key management
 * - MPC threshold signing
 * - Smart account abstraction
 * - Verifiable credentials
 */

import { logger } from '@babylon/shared';
import type { Address, Hex } from 'viem';

// ============================================================================
// Types (from @jeju/oauth3)
// ============================================================================

export enum AuthProvider {
  WALLET = 'wallet',
  FARCASTER = 'farcaster',
  GOOGLE = 'google',
  APPLE = 'apple',
  TWITTER = 'twitter',
  GITHUB = 'github',
  DISCORD = 'discord',
}

export interface OAuth3Identity {
  id: Hex;
  owner: Address;
  smartAccount: Address;
  providers: LinkedProvider[];
  createdAt: number;
  updatedAt: number;
  metadata: IdentityMetadata;
}

export interface LinkedProvider {
  provider: AuthProvider;
  providerId: string;
  providerHandle: string;
  linkedAt: number;
  verified: boolean;
}

export interface IdentityMetadata {
  name: string;
  avatar: string;
  bio: string;
  url: string;
  jnsName: string | null;
}

export interface OAuth3Session {
  sessionId: Hex;
  identityId: Hex;
  smartAccount: Address;
  expiresAt: number;
  signingKey: Hex;
}

export interface AuthResult {
  identity: OAuth3Identity;
  session: OAuth3Session;
  accessToken: string;
  refreshToken: string;
}

export interface OAuth3Config {
  serviceUrl: string;
  appId: string;
  redirectUri: string;
  chainId: number;
}

// ============================================================================
// OAuth3 Client
// ============================================================================

class OAuth3Client {
  private config: OAuth3Config;
  private initialized = false;
  private currentSession: OAuth3Session | null = null;

  constructor() {
    const serviceUrl = process.env.JEJU_OAUTH3_SERVICE_URL;
    if (!serviceUrl) {
      throw new Error(
        '[OAuth3] JEJU_OAUTH3_SERVICE_URL is required. ' +
          'Decentralized auth is mandatory - no Privy fallback.'
      );
    }

    this.config = {
      serviceUrl,
      appId: process.env.BABYLON_OAUTH3_APP_ID ?? 'babylon',
      redirectUri:
        process.env.BABYLON_OAUTH3_REDIRECT_URI ??
        'http://localhost:5007/auth/callback',
      chainId: parseInt(process.env.CHAIN_ID ?? '420691', 10),
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const healthy = await this.healthCheck();
    if (!healthy) {
      throw new Error(
        `[OAuth3] OAuth3 service at ${this.config.serviceUrl} is not healthy. ` +
          'Start Jeju services: cd /path/to/jeju && bun run dev'
      );
    }

    logger.info(
      '[OAuth3] Connected to Jeju OAuth3',
      { url: this.config.serviceUrl },
      'OAuth3'
    );
    this.initialized = true;
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[OAuth3] Client not initialized. Call initialize() first.'
      );
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serviceUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Authentication Flow
  // ============================================================================

  getAuthUrl(provider: AuthProvider, state?: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      provider,
      redirect_uri: this.config.redirectUri,
      chain_id: String(this.config.chainId),
    });
    if (state) params.set('state', state);
    return `${this.config.serviceUrl}/auth/authorize?${params}`;
  }

  async handleCallback(code: string, state?: string): Promise<AuthResult> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        app_id: this.config.appId,
        state,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Token exchange failed (${response.status}): ${text}`
      );
    }

    const result = (await response.json()) as AuthResult;
    this.currentSession = result.session;
    return result;
  }

  async refreshSession(refreshToken: string): Promise<AuthResult> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        app_id: this.config.appId,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Token refresh failed (${response.status}): ${text}`
      );
    }

    const result = (await response.json()) as AuthResult;
    this.currentSession = result.session;
    return result;
  }

  // ============================================================================
  // Wallet Auth (Primary)
  // ============================================================================

  async loginWithWallet(
    address: Address,
    signature: Hex,
    message: string
  ): Promise<AuthResult> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/auth/wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        signature,
        message,
        app_id: this.config.appId,
        chain_id: this.config.chainId,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Wallet login failed (${response.status}): ${text}`
      );
    }

    const result = (await response.json()) as AuthResult;
    this.currentSession = result.session;
    return result;
  }

  getWalletSignMessage(nonce: string): string {
    return `Sign in to Babylon\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
  }

  async getWalletNonce(address: Address): Promise<string> {
    this.requireInitialized();

    const response = await fetch(
      `${this.config.serviceUrl}/auth/nonce?address=${address}`,
      {
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Get nonce failed (${response.status}): ${text}`
      );
    }

    const data = (await response.json()) as { nonce: string };
    return data.nonce;
  }

  // ============================================================================
  // Identity Management
  // ============================================================================

  async getIdentity(accessToken: string): Promise<OAuth3Identity> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/identity`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Get identity failed (${response.status}): ${text}`
      );
    }

    return response.json() as Promise<OAuth3Identity>;
  }

  async linkProvider(
    accessToken: string,
    provider: AuthProvider,
    providerToken: string
  ): Promise<OAuth3Identity> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/identity/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ provider, provider_token: providerToken }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Link provider failed (${response.status}): ${text}`
      );
    }

    return response.json() as Promise<OAuth3Identity>;
  }

  async unlinkProvider(
    accessToken: string,
    provider: AuthProvider
  ): Promise<OAuth3Identity> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/identity/unlink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ provider }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Unlink provider failed (${response.status}): ${text}`
      );
    }

    return response.json() as Promise<OAuth3Identity>;
  }

  async updateMetadata(
    accessToken: string,
    metadata: Partial<IdentityMetadata>
  ): Promise<OAuth3Identity> {
    this.requireInitialized();

    const response = await fetch(
      `${this.config.serviceUrl}/identity/metadata`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Update metadata failed (${response.status}): ${text}`
      );
    }

    return response.json() as Promise<OAuth3Identity>;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async validateSession(accessToken: string): Promise<OAuth3Session | null> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/session/validate`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401) return null;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Validate session failed (${response.status}): ${text}`
      );
    }

    const session = (await response.json()) as OAuth3Session;
    this.currentSession = session;
    return session;
  }

  async revokeSession(accessToken: string): Promise<void> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/session/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Revoke session failed (${response.status}): ${text}`
      );
    }

    this.currentSession = null;
  }

  getCurrentSession(): OAuth3Session | null {
    return this.currentSession;
  }

  // ============================================================================
  // Signing (via TEE/MPC)
  // ============================================================================

  async signMessage(accessToken: string, message: string): Promise<Hex> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/sign/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Sign message failed (${response.status}): ${text}`
      );
    }

    const data = (await response.json()) as { signature: Hex };
    return data.signature;
  }

  async signTypedData(accessToken: string, typedData: unknown): Promise<Hex> {
    this.requireInitialized();

    const response = await fetch(`${this.config.serviceUrl}/sign/typed-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ typed_data: typedData }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[OAuth3] Sign typed data failed (${response.status}): ${text}`
      );
    }

    const data = (await response.json()) as { signature: Hex };
    return data.signature;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let oauth3Client: OAuth3Client | null = null;

export function getOAuth3Client(): OAuth3Client {
  if (!oauth3Client) {
    oauth3Client = new OAuth3Client();
  }
  return oauth3Client;
}

export async function initializeOAuth3(): Promise<OAuth3Client> {
  const client = getOAuth3Client();
  await client.initialize();
  return client;
}

export function resetOAuth3Client(): void {
  oauth3Client = null;
}

export { OAuth3Client };
