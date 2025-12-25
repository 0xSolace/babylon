/**
 * OAuth Types
 */

export interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
  state: string
  nonce: string
}

export interface OAuthProvider {
  name: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenType: string
}

export interface OAuthUserInfo {
  id: string
  email?: string
  name?: string
  picture?: string
  provider: string
}

export interface OAuthCallbackResult {
  success: boolean
  tokens?: OAuthTokens
  userInfo?: OAuthUserInfo
  error?: string
}
