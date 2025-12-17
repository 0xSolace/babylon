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

export { DiscordOAuth } from './discord';
export {
  FarcasterAuth,
  type FarcasterAuthConfig,
  type FarcasterSignInRequest,
  type FarcasterSignInResult,
} from './farcaster';
export { generatePKCE, PKCEUtils } from './pkce';
export {
  createSIWEMessage,
  SIWE,
  type SIWEConfig,
  type SIWEMessage,
  type SIWEVerificationResult,
  verifySIWE,
} from './siwe';
export {
  createSIWFMessage,
  SIWF,
  type SIWFConfig,
  type SIWFMessage,
  type SIWFVerificationResult,
  verifySIWF,
} from './siwf';
export { TwitterOAuth } from './twitter';
export type {
  OAuthCallbackResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUserInfo,
} from './types';
