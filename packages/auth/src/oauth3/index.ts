/**
 * OAuth3 Module Exports
 *
 * Decentralized authentication using Jeju OAuth3.
 * NO FALLBACKS - OAuth3 replaces Privy.
 */

export {
  AuthProvider,
  type AuthResult,
  getOAuth3Client,
  type IdentityMetadata,
  initializeOAuth3,
  type LinkedProvider,
  OAuth3Client,
  type OAuth3Config,
  type OAuth3Identity,
  type OAuth3Session,
  resetOAuth3Client,
} from './client';
