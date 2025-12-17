/**
 * Discord OAuth (PKCE)
 *
 * Implements Discord OAuth 2.0 with PKCE.
 * No server-side client secret required.
 */

import { generatePKCE, PKCEUtils } from './pkce';
import type {
  OAuthCallbackResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
} from './types';

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

export interface DiscordOAuthConfig {
  clientId: string;
  scopes?: string[];
}

const DEFAULT_SCOPES = ['identify', 'email'];

/**
 * Discord OAuth Provider
 */
export class DiscordOAuth implements OAuthProvider {
  name = 'discord' as const;
  private config: DiscordOAuthConfig;

  constructor(config: DiscordOAuthConfig) {
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
    PKCEUtils.store({ ...pkce, state }, `discord_pkce_${state}`);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: this.config.scopes!.join(' '),
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${DISCORD_AUTH_URL}?${params.toString()}`;
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

    const response = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

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
    const response = await fetch(DISCORD_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user info: ${error}`);
    }

    const data = (await response.json()) as {
      id: string;
      username: string;
      global_name?: string;
      email?: string;
      avatar?: string;
      verified?: boolean;
    };

    return {
      id: data.id,
      username: data.username,
      displayName: data.global_name ?? data.username,
      email: data.email,
      avatar: data.avatar
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : undefined,
      verified: data.verified,
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
    const pkce = PKCEUtils.retrieve(`discord_pkce_${state}`);
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
