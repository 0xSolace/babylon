/**
 * OAuth Types
 *
 * Types for OAuth providers and callbacks.
 */

// OAuth Types

export interface OAuthProvider {
  /** Provider name */
  name: 'twitter' | 'discord' | 'farcaster';
  /** Get authorization URL */
  getAuthorizationUrl(redirectUri: string, state: string): Promise<string>;
  /** Exchange code for tokens */
  exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<OAuthTokens>;
  /** Get user info */
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
}

export interface OAuthUserInfo {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  verified?: boolean;
}

export interface OAuthCallbackResult {
  success: boolean;
  tokens?: OAuthTokens;
  user?: OAuthUserInfo;
  error?: string;
}

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  nonce: string;
}
