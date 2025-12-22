/**
 * Farcaster Auth
 *
 * Farcaster authentication using Sign-In With Farcaster (SIWF).
 * No OAuth needed - uses Farcaster custody address signatures.
 */

import {
  AuthenticationError,
  ExternalServiceError,
  NotFoundError,
  retryIfRetryable,
} from '@babylon/shared';
import { type Address, type Hex, verifyMessage } from 'viem';
import type { OAuthUserInfo } from './types';

const FARCASTER_HUB_URL = 'https://hub.farcaster.xyz';
const NEYNAR_API_URL = 'https://api.neynar.com/v2';

export interface FarcasterAuthConfig {
  /** Neynar API key (optional, for enhanced features) */
  neynarApiKey?: string;
  /** Hub URL override */
  hubUrl?: string;
}

export interface FarcasterSignInRequest {
  /** The message to sign */
  message: string;
  /** Nonce for replay protection */
  nonce: string;
  /** Domain making the request */
  domain: string;
  /** When the request expires */
  expiresAt: number;
}

export interface FarcasterSignInResult {
  /** Farcaster ID */
  fid: number;
  /** Custody address that signed */
  custodyAddress: Address;
  /** Username */
  username?: string;
  /** Display name */
  displayName?: string;
  /** Profile picture URL */
  pfpUrl?: string;
  /** Signature */
  signature: Hex;
}

/**
 * Farcaster Auth Provider
 *
 * Uses Sign-In With Farcaster (SIWF) for authentication.
 * No centralized OAuth flow required.
 */
export class FarcasterAuth {
  private config: FarcasterAuthConfig;

  constructor(config: FarcasterAuthConfig = {}) {
    this.config = {
      hubUrl: config.hubUrl ?? FARCASTER_HUB_URL,
      ...config,
    };
  }

  /**
   * Generate a sign-in request
   */
  generateSignInRequest(
    domain: string,
    expiresInSeconds = 300
  ): FarcasterSignInRequest {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const nonce = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    const message = this.buildSignInMessage(domain, nonce, expiresAt);

    return {
      message,
      nonce,
      domain,
      expiresAt,
    };
  }

  /**
   * Build the SIWF message
   */
  private buildSignInMessage(
    domain: string,
    nonce: string,
    expiresAt: number
  ): string {
    const expirationDate = new Date(expiresAt).toISOString();

    return `${domain} wants you to sign in with your Farcaster account.

Nonce: ${nonce}
Expires: ${expirationDate}

This request will not trigger a blockchain transaction or cost any gas fees.`;
  }

  /**
   * Verify a sign-in response
   */
  async verifySignIn(
    request: FarcasterSignInRequest,
    signature: Hex,
    fid: number
  ): Promise<FarcasterSignInResult> {
    // Check expiration
    if (Date.now() > request.expiresAt) {
      throw new AuthenticationError('Sign-in request expired', 'EXPIRED_TOKEN');
    }

    // Get the FID's custody address
    const custodyAddress = await this.getCustodyAddress(fid);

    // Verify the signature
    const isValid = await verifyMessage({
      address: custodyAddress,
      message: request.message,
      signature,
    });

    if (!isValid) {
      throw new AuthenticationError(
        'Invalid Farcaster signature',
        'INVALID_CREDENTIALS'
      );
    }

    // Get user profile
    const profile = await this.getUserProfile(fid);

    return {
      fid,
      custodyAddress,
      username: profile.username,
      displayName: profile.displayName,
      pfpUrl: profile.avatar,
      signature,
    };
  }

  /**
   * Get custody address for an FID
   */
  async getCustodyAddress(fid: number): Promise<Address> {
    const response = await retryIfRetryable(
      async () => {
        const res = await fetch(
          `${this.config.hubUrl}/v1/custodyAddressByFid?fid=${fid}`
        );

        if (!res.ok) {
          const errorWithStatus = new Error(
            `Farcaster Hub custody address failed: ${res.status}`
          ) as Error & { status: number };
          errorWithStatus.status = res.status;
          throw errorWithStatus;
        }

        return res;
      },
      { maxAttempts: 3, initialDelayMs: 100 }
    );

    if (!response.ok) {
      throw new ExternalServiceError(
        'Farcaster Hub',
        `Failed to get custody address for FID ${fid}`,
        response.status
      );
    }

    const data = (await response.json()) as { custodyAddress: string };
    return data.custodyAddress as Address;
  }

  /**
   * Get user profile for an FID
   */
  async getUserProfile(fid: number): Promise<OAuthUserInfo> {
    // Use Neynar API if available, otherwise use Hub
    if (this.config.neynarApiKey) {
      return this.getUserProfileFromNeynar(fid);
    }

    return this.getUserProfileFromHub(fid);
  }

  /**
   * Get user profile from Farcaster Hub
   */
  private async getUserProfileFromHub(fid: number): Promise<OAuthUserInfo> {
    const response = await retryIfRetryable(
      async () => {
        const res = await fetch(
          `${this.config.hubUrl}/v1/userDataByFid?fid=${fid}`
        );

        // For this endpoint, non-2xx is not retryable - just return minimal info
        return res;
      },
      { maxAttempts: 3, initialDelayMs: 100 }
    );

    if (!response.ok) {
      // Return minimal info if Hub query fails
      return {
        id: String(fid),
      };
    }

    const data = (await response.json()) as {
      messages: Array<{
        data: {
          userDataBody: {
            type: string;
            value: string;
          };
        };
      }>;
    };

    const userData: Record<string, string> = {};
    for (const msg of data.messages) {
      const { type, value } = msg.data.userDataBody;
      userData[type] = value;
    }

    return {
      id: String(fid),
      username: userData['USER_DATA_TYPE_USERNAME'],
      displayName: userData['USER_DATA_TYPE_DISPLAY'],
      avatar: userData['USER_DATA_TYPE_PFP'],
    };
  }

  /**
   * Get user profile from Neynar API
   */
  private async getUserProfileFromNeynar(fid: number): Promise<OAuthUserInfo> {
    const response = await retryIfRetryable(
      async () => {
        const res = await fetch(
          `${NEYNAR_API_URL}/farcaster/user/bulk?fids=${fid}`,
          {
            headers: {
              api_key: this.config.neynarApiKey!,
            },
          }
        );

        if (!res.ok) {
          const errorWithStatus = new Error(
            `Neynar API failed: ${res.status}`
          ) as Error & { status: number };
          errorWithStatus.status = res.status;
          throw errorWithStatus;
        }

        return res;
      },
      { maxAttempts: 3, initialDelayMs: 100 }
    ).catch(() => null);

    if (!response) {
      return this.getUserProfileFromHub(fid);
    }

    const data = (await response.json()) as {
      users: Array<{
        fid: number;
        username: string;
        display_name: string;
        pfp_url: string;
        verified_addresses?: {
          eth_addresses?: string[];
        };
      }>;
    };

    const user = data.users[0];
    if (!user) {
      throw new NotFoundError('Farcaster User', fid);
    }

    return {
      id: String(user.fid),
      username: user.username,
      displayName: user.display_name,
      avatar: user.pfp_url,
      verified: true,
    };
  }

  /**
   * Look up FID by username
   */
  async getFidByUsername(username: string): Promise<number | null> {
    if (this.config.neynarApiKey) {
      const response = await retryIfRetryable(
        async () => {
          const res = await fetch(
            `${NEYNAR_API_URL}/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
            {
              headers: {
                api_key: this.config.neynarApiKey!,
              },
            }
          );

          // Non-2xx is not retryable for username lookup
          return res;
        },
        { maxAttempts: 3, initialDelayMs: 100 }
      ).catch(() => null);

      if (!response || !response.ok) {
        return null;
      }

      const data = (await response.json()) as { user: { fid: number } };
      return data.user.fid;
    }

    // Without Neynar, would need to query the Hub directly
    return null;
  }
}
