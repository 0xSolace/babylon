/**
 * Twitter OAuth (PKCE)
 *
 * Implements Twitter OAuth 2.0 with PKCE.
 * No server-side client secret required.
 */

import { ExternalServiceError, retryIfRetryable } from '@babylon/shared';
import {
  OAuthTokenResponseSchema,
  TwitterUserResponseSchema,
} from '../schemas/index';
import { generatePKCE, PKCEUtils } from './pkce';
import type {
  OAuthCallbackResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
} from './types';

const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_USER_URL = 'https://api.twitter.com/2/users/me';

export interface TwitterOAuthConfig {
  clientId: string;
  scopes?: string[];
}

const DEFAULT_SCOPES = ['tweet.read', 'users.read', 'offline.access'];

/**
 * Twitter OAuth Provider
 */
export class TwitterOAuth implements OAuthProvider {
  name = 'twitter' as const;
  private config: TwitterOAuthConfig;

  constructor(config: TwitterOAuthConfig) {
    this.config = {
      ...config,
      scopes: config.scopes ?? DEFAULT_SCOPES,
    };
  }

  /**
   * Get authorization URL
   */
  async getAuthorizationUrl(
    redirectUri: string,
    state: string
  ): Promise<string> {
    const pkce = await generatePKCE();

    // Store PKCE params with state as key
    PKCEUtils.store({ ...pkce, state }, `twitter_pkce_${state}`);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: this.config.scopes!.join(' '),
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${TWITTER_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
    });

    const response = await retryIfRetryable(
      async () => {
        const res = await fetch(TWITTER_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        if (!res.ok) {
          const errorWithStatus = new Error(
            `Twitter token exchange failed: ${res.status}`
          ) as Error & { status: number };
          errorWithStatus.status = res.status;
          throw errorWithStatus;
        }

        return res;
      },
      { maxAttempts: 3, initialDelayMs: 100 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ExternalServiceError(
        'Twitter OAuth',
        `Token exchange failed: ${errorText}`,
        response.status
      );
    }

    const data = OAuthTokenResponseSchema.parse(await response.json());

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  }

  /**
   * Get user info from access token
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await retryIfRetryable(
      async () => {
        const res = await fetch(
          `${TWITTER_USER_URL}?user.fields=id,name,username,profile_image_url,verified`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!res.ok) {
          const errorWithStatus = new Error(
            `Twitter user info failed: ${res.status}`
          ) as Error & { status: number };
          errorWithStatus.status = res.status;
          throw errorWithStatus;
        }

        return res;
      },
      { maxAttempts: 3, initialDelayMs: 100 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ExternalServiceError(
        'Twitter OAuth',
        `Failed to get user info: ${errorText}`,
        response.status
      );
    }

    const data = TwitterUserResponseSchema.parse(await response.json());

    return {
      id: data.data.id,
      username: data.data.username,
      displayName: data.data.name,
      avatar: data.data.profile_image_url,
      verified: data.data.verified,
    };
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    code: string,
    state: string,
    redirectUri: string
  ): Promise<OAuthCallbackResult> {
    // Retrieve stored PKCE params
    const pkce = PKCEUtils.retrieve(`twitter_pkce_${state}`);
    if (!pkce) {
      return {
        success: false,
        error: 'PKCE params not found - state mismatch or expired',
      };
    }

    // Validate state
    if (!PKCEUtils.validateState(state, pkce.state)) {
      return { success: false, error: 'State mismatch - possible CSRF attack' };
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCode(
      code,
      pkce.codeVerifier,
      redirectUri
    );

    // Get user info
    const user = await this.getUserInfo(tokens.accessToken);

    return {
      success: true,
      tokens,
      user,
    };
  }
}
